"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { confirmPayment, createIntent, integrationMode, type PaymentPurpose } from "@/lib/payments";
import { rm } from "@/lib/utils";

const KINDS: PaymentPurpose[] = ["DONATION", "QURBAN", "QURAN_BOOKING", "STORE"];
const METHODS = ["QR", "FPX", "KAD"];

const ENTITY: Record<PaymentPurpose, string> = {
  DONATION: "Donation",
  QURBAN: "QurbanOrder",
  QURAN_BOOKING: "QuranBooking",
  STORE: "Order",
};

const PURPOSE_LABEL: Record<PaymentPurpose, string> = {
  DONATION: "derma",
  QURBAN: "tempahan qurban",
  QURAN_BOOKING: "tempahan kelas Al-Quran",
  STORE: "belian kedai",
};

/** Human-readable intent description sent to the gateway (HitPay/Billplz). */
function intentDescription(kind: PaymentPurpose, id: string, method: string): string {
  return `SPMJ ${PURPOSE_LABEL[kind]} · ${method} · ${id.slice(-6).toUpperCase()}`;
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function isKind(value: string): value is PaymentPurpose {
  return (KINDS as string[]).includes(value);
}

type Payer = {
  name: string;
  email: string | null;
  amountSen: number;
  canPay: boolean;
  paid: boolean;
};

async function payerFor(kind: PaymentPurpose, id: string): Promise<Payer | null> {
  if (kind === "DONATION") {
    const donation = await prisma.donation.findUnique({
      where: { id },
      select: { donorName: true, donorEmail: true, amountSen: true, status: true, anonymous: true },
    });
    if (!donation) return null;
    return {
      name: donation.anonymous ? "Penderma Tanpa Nama" : donation.donorName,
      email: donation.donorEmail,
      amountSen: donation.amountSen,
      canPay: donation.status === "MENUNGGU",
      paid: donation.status === "DIBAYAR",
    };
  }

  if (kind === "QURBAN") {
    const order = await prisma.qurbanOrder.findUnique({
      where: { id },
      select: { customerName: true, email: true, amountSen: true, status: true },
    });
    if (!order) return null;
    return {
      name: order.customerName,
      email: order.email,
      amountSen: order.amountSen,
      canPay: order.status === "MENUNGGU",
      paid: order.status === "DIBAYAR",
    };
  }

  if (kind === "QURAN_BOOKING") {
    const booking = await prisma.quranBooking.findUnique({
      where: { id },
      select: { parentName: true, parentEmail: true, amountSen: true, status: true },
    });
    if (!booking) return null;
    return {
      name: booking.parentName,
      email: booking.parentEmail,
      amountSen: booking.amountSen,
      canPay: booking.status === "MENUNGGU_BAYARAN",
      paid: booking.status === "DISAHKAN" || booking.status === "SELESAI",
    };
  }

  const storeOrder = await prisma.order.findUnique({
    where: { id },
    select: { buyerName: true, buyerEmail: true, totalSen: true, status: true, mosqueId: true },
  });
  if (!storeOrder) return null;
  return {
    name: storeOrder.buyerName,
    email: storeOrder.buyerEmail,
    amountSen: storeOrder.totalSen,
    canPay: storeOrder.status === "MENUNGGU_BAYARAN",
    paid: storeOrder.status === "DIBAYAR",
  };
}

export async function payNow(formData: FormData) {
  const user = await requirePageUser();

  const kindRaw = text(formData, "kind");
  if (!isKind(kindRaw)) redirect("/jemaah");
  const kind = kindRaw;

  const id = text(formData, "id");
  if (!id) redirect("/jemaah");

  const base = `/jemaah/bayar/${kind}/${id}`;
  const fail = (message: string): never => redirect(`${base}?ralat=${encodeURIComponent(message)}`);

  const methodRaw = text(formData, "method");
  const method = METHODS.includes(methodRaw) ? methodRaw : "QR";

  const payer = await payerFor(kind, id);
  if (!payer) return fail("Rekod pembayaran tidak dijumpai.");
  if (!payer.canPay) {
    if (payer.paid) redirect(`${base}/selesai`);
    fail("Rekod ini tidak boleh dibayar pada masa ini.");
  }

  let result: Awaited<ReturnType<typeof confirmPayment>> | null = null;
  try {
    const mode = await integrationMode("gateway");
    if (mode === "LIVE") {
      const intent = await createIntent({
        amountSen: payer.amountSen,
        purpose: kind,
        description: intentDescription(kind, id, method),
        payerName: payer.name,
        payerEmail: payer.email ?? user.email ?? "",
        entityId: id,
      });
      if (intent.checkoutUrl) {
        await audit({
          actor: user,
          action: "CREATE",
          entity: "PaymentIntent",
          entityId: intent.ref,
          mosqueId: null,
          after: {
            kind,
            entityId: id,
            amountSen: payer.amountSen,
            provider: intent.provider,
            method,
          },
        });
        revalidatePath(base);
        redirect(intent.checkoutUrl);
      }
      fail("Gerbang LIVE tidak mengembalikan pautan pembayaran.");
    }
    result = await confirmPayment({ kind, id, actorEmail: user.email ?? "sistem" });
  } catch (error) {
    fail(error instanceof Error ? error.message : "Pembayaran gagal. Sila cuba semula.");
  }

  if (!result) return fail("Pembayaran gagal. Sila cuba semula.");

  const receiptNumber = "receiptNumber" in result ? result.receiptNumber : null;

  if (!result.already) {
    await notify({
      channel: "EMAIL",
      to: payer.email ?? user.email ?? "demo@spmj.local",
      template: "pembayaran_diterima",
      subject: "Pembayaran diterima — SPMJ",
      body: `Terima kasih. Bayaran ${rm(payer.amountSen)} bagi ${PURPOSE_LABEL[kind]} telah diterima${
        receiptNumber ? ` dan resit ${receiptNumber} telah dijana` : ""
      }. Dana diselesaikan terus kepada penerima manfaat.`,
      mosqueId: result.mosqueId ?? null,
      userId: user.id,
      payload: { kind, id, method, receiptNumber },
    });
  }

  await audit({
    actor: user,
    action: "PAY",
    entity: ENTITY[kind],
    entityId: id,
    mosqueId: result.mosqueId ?? null,
    after: {
      kind,
      method,
      amountSen: payer.amountSen,
      receiptNumber,
      alreadyPaid: result.already,
      actorEmail: user.email,
    },
  });

  revalidatePath(base);
  revalidatePath(`${base}/selesai`);
  revalidatePath("/jemaah/derma");
  revalidatePath("/jemaah/qurban");
  revalidatePath("/jemaah/quran");
  revalidatePath("/jemaah/kedai");
  revalidatePath("/portal/derma");
  revalidatePath("/portal/qurban");
  revalidatePath("/portal/quran");
  revalidatePath("/portal/kedai");

  const query = receiptNumber ? `?resit=${encodeURIComponent(receiptNumber)}` : "";
  redirect(`${base}/selesai${query}`);
}
