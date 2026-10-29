"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const BASE = "/jemaah/qurban";

class ShareClaimError extends Error {}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string, programId: string): never {
  const suffix = programId ? `&program=${encodeURIComponent(programId)}` : "";
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}${suffix}`);
}

export async function createOrder(formData: FormData) {
  const user = await requirePageUser();

  const programId = text(formData, "programId");
  const program = await prisma.qurbanProgram.findFirst({
    where: {
      id: programId,
      ...(user.mosqueId ? { mosqueId: user.mosqueId } : {}),
    },
  });
  if (!program) fail("Program qurban tidak dijumpai.", programId);
  if (program.status !== "DIBUKA") fail("Program qurban ini telah ditutup.", programId);

  const shares = Number.parseInt(text(formData, "shares"), 10);
  if (!Number.isFinite(shares) || shares < 1) fail("Bilangan bahagian mesti sekurang-kurangnya 1.", programId);
  if (shares > program.availableShares) {
    fail(`Hanya ${program.availableShares} bahagian masih tersedia untuk program ini.`, programId);
  }

  const customerName = text(formData, "customerName");
  const email = text(formData, "email").toLowerCase();
  if (!customerName) fail("Nama penempah wajib diisi.", programId);
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    fail("Alamat e-mel yang sah diperlukan untuk resit.", programId);
  }
  const phone = text(formData, "phone");

  let orderId: string | null = null;
  let amountSen = 0;
  let orderNo = "";
  try {
    const order = await prisma.$transaction(async (tx) => {
      const claimed = await tx.qurbanProgram.updateMany({
        where: { id: program.id, status: "DIBUKA", availableShares: { gte: shares } },
        data: { availableShares: { decrement: shares } },
      });
      if (claimed.count !== 1) {
        throw new ShareClaimError("Bahagian yang dipilih baru sahaja ditempah orang lain. Sila cuba lagi.");
      }

      const count = await tx.qurbanOrder.count({ where: { program: { year: program.year } } });
      const number = `QB/${program.year}/${String(count + 1).padStart(4, "0")}`;
      const amount = program.pricePerShareSen * shares;

      const created = await tx.qurbanOrder.create({
        data: {
          orderNo: number,
          programId: program.id,
          customerName,
          email,
          phone: phone || null,
          shares,
          amountSen: amount,
          status: "MENUNGGU",
        },
      });
      orderNo = number;
      amountSen = amount;
      return created;
    });
    orderId = order.id;
  } catch (error) {
    fail(
      error instanceof ShareClaimError ? error.message : "Tempahan qurban gagal. Sila cuba semula.",
      programId,
    );
  }

  if (!orderId) fail("Tempahan qurban gagal. Sila cuba semula.", programId);

  await audit({
    actor: user,
    action: "CREATE",
    entity: "QurbanOrder",
    entityId: orderId,
    mosqueId: program.mosqueId,
    after: { orderNo, programId: program.id, shares, amountSen, customerName },
  });

  revalidatePath(BASE);
  revalidatePath("/portal/qurban");
  redirect(`/jemaah/bayar/QURBAN/${orderId}`);
}
