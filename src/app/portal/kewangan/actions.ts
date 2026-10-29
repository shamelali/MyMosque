"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { issueReceipt } from "@/lib/documents";
import { notify } from "@/lib/notifications";
import { senFromRinggit } from "@/lib/utils";

const BASE = "/portal/kewangan";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function recordEntry(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA"]);
  if (!user.mosqueId) redirect("/portal?ralat=Akaun%20anda%20belum%20dikaitkan%20dengan%20masjid.");

  const monthRaw = text(formData, "bulan");
  const bulan = /^\d{4}-\d{2}$/.test(monthRaw) ? monthRaw : "";
  const back = bulan ? `${BASE}?bulan=${bulan}` : BASE;
  const fail = (message: string): never => redirect(`${back}&ralat=${encodeURIComponent(message)}`);

  const dateRaw = text(formData, "date");
  const date = new Date(dateRaw);
  if (!dateRaw || Number.isNaN(date.getTime())) fail("Tarikh transaksi tidak sah.");

  const description = text(formData, "description");
  if (!description) fail("Keterangan transaksi wajib diisi.");

  const category = text(formData, "category");
  if (!category) fail("Kategori transaksi wajib diisi.");

  const type = text(formData, "type");
  if (type !== "MASUK" && type !== "KELUAR") fail("Jenis transaksi tidak sah.");

  const accountId = text(formData, "accountId");
  const account = await prisma.ledgerAccount.findFirst({
    where: { id: accountId, mosqueId: user.mosqueId },
  });
  if (!account) return fail("Akaun lejar tidak sah.");
  const expectedType = type === "MASUK" ? "HASIL" : "PERBELANJAAN";
  if (account.type !== expectedType) return fail("Akaun yang dipilih tidak sepadan dengan jenis transaksi.");

  const amountSen = senFromRinggit(text(formData, "amount"));
  if (!Number.isFinite(amountSen) || amountSen <= 0) fail("Jumlah transaksi mesti lebih daripada RM0.00.");

  const methodRaw = text(formData, "method");
  const method = ["TUNAI", "BANK", "QR", "FPX", "KAD"].includes(methodRaw) ? methodRaw : "TUNAI";

  const wantReceipt = formData.get("receipt") === "on";
  const payerName = text(formData, "payerName");
  const payerEmail = text(formData, "payerEmail");
  if (wantReceipt && type === "MASUK" && !payerName) {
    fail("Nama pembayar diperlukan untuk menjana resit.");
  }

  let entryId: string | null = null;
  try {
    const entry = await prisma.ledgerEntry.create({
      data: {
        mosqueId: user.mosqueId,
        accountId: account.id,
        date,
        description,
        category,
        type,
        amountSen,
        method,
        status: "POSTED",
        createdById: user.id,
      },
    });
    entryId = entry.id;

    await audit({
      actor: user,
      action: "CREATE",
      entity: "LedgerEntry",
      entityId: entry.id,
      mosqueId: user.mosqueId,
      after: { description, type, amountSen, method, category },
    });
  } catch (error) {
    console.error("[kewangan] gagal menyimpan transaksi", error);
    fail("Transaksi gagal disimpan. Sila cuba semula.");
  }

  if (wantReceipt && type === "MASUK") {
    try {
      const receipt = await issueReceipt({
        mosqueId: user.mosqueId,
        issuedTo: payerName,
        email: payerEmail || null,
        amountSen,
        purpose: description,
        method,
        entryId,
      });

      await audit({
        actor: user,
        action: "CREATE",
        entity: "Receipt",
        entityId: receipt.id,
        mosqueId: user.mosqueId,
        after: { number: receipt.number, amountSen, issuedTo: payerName },
      });

      if (payerEmail) {
        await notify({
          channel: "EMAIL",
          to: payerEmail,
          template: "resit",
          subject: `Resit ${receipt.number} — ${description}`,
          body: `Terima kasih. Resit bagi bayaran ${description} berjumlah RM ${(amountSen / 100).toFixed(2)} telah dijana oleh masjid.`,
          mosqueId: user.mosqueId,
        });
      }
    } catch (error) {
      console.error("[kewangan] gagal menjana resit", error);
      revalidatePath(BASE);
      redirect(`${back}&ralat=${encodeURIComponent("Transaksi disimpan tetapi resit gagal dijana.")}`);
    }
  }

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(back);
}
