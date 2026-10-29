"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { confirmPayment } from "@/lib/payments";
import { rm, senFromRinggit } from "@/lib/utils";

const BASE = "/portal/qurban";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function back(programId?: string) {
  return programId ? `${BASE}?program=${encodeURIComponent(programId)}` : BASE;
}

function fail(message: string, programId?: string): never {
  const base = back(programId);
  redirect(`${base}${base.includes("?") ? "&" : "?"}ralat=${encodeURIComponent(message)}`);
}

function maklum(message: string, programId?: string): never {
  const base = back(programId);
  redirect(`${base}${base.includes("?") ? "&" : "?"}maklum=${encodeURIComponent(message)}`);
}

export async function createProgram(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "BENDAHARI"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const yearValue = Number.parseInt(text(formData, "year"), 10);
  const currentYear = new Date().getFullYear();
  if (!Number.isFinite(yearValue) || yearValue < currentYear - 1 || yearValue > currentYear + 5) {
    fail("Tahun program qurban tidak sah.");
  }

  const animal = text(formData, "animal");
  if (animal !== "LEMBU" && animal !== "KAMBING") fail("Jenis haiwan qurban tidak sah.");

  const priceSen = senFromRinggit(text(formData, "price"));
  if (!Number.isFinite(priceSen) || priceSen <= 0) fail("Harga per bahagian mesti lebih daripada RM0.00.");

  const totalShares = Number.parseInt(text(formData, "totalShares"), 10);
  if (!Number.isFinite(totalShares) || totalShares < 1 || totalShares > 500) {
    fail("Jumlah bahagian mesti antara 1 hingga 500.");
  }

  const dateRaw = text(formData, "distributionDate");
  const distributionDate = dateRaw ? new Date(`${dateRaw}T08:00:00`) : null;
  if (!distributionDate || Number.isNaN(distributionDate.getTime())) fail("Tarikh agihan tidak sah.");

  const program = await prisma.qurbanProgram.create({
    data: {
      mosqueId: user.mosqueId,
      year: yearValue,
      animal,
      pricePerShareSen: priceSen,
      totalShares,
      availableShares: totalShares,
      permissionStatus: "MENUNGGU",
      distributionDate,
      status: "DIBUKA",
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "QurbanProgram",
    entityId: program.id,
    mosqueId: user.mosqueId,
    after: { year: yearValue, animal, priceSen, totalShares, distributionDate },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  maklum(`Program qurban ${yearValue} (${animal === "LEMBU" ? "lembu" : "kambing"}) dibuka. Kebenaran JAINJ sedang menunggu.`, program.id);
}

export async function setPermission(formData: FormData) {
  const user = await requirePageUser(["KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const program = await prisma.qurbanProgram.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!program) fail("Program qurban tidak dijumpai.");
  if (program.permissionStatus === "DILULUSKAN") {
    fail("Kebenaran program ini sudah direkodkan.", program.id);
  }

  const seq = (await prisma.qurbanProgram.count({ where: { year: program.year } })) + 1;
  const permissionRef = `JAINJ/QBN/${program.year}/${String(seq).padStart(4, "0")}`;

  await prisma.qurbanProgram.update({
    where: { id: program.id },
    data: { permissionStatus: "DILULUSKAN", permissionRef },
  });

  await audit({
    actor: user,
    action: "APPROVE",
    entity: "QurbanProgram",
    entityId: program.id,
    mosqueId: user.mosqueId,
    before: { permissionStatus: program.permissionStatus, permissionRef: program.permissionRef },
    after: { permissionStatus: "DILULUSKAN", permissionRef },
  });

  revalidatePath(BASE);
  maklum(`Kebenaran qurban direkodkan: ${permissionRef}.`, program.id);
}

export async function confirmOrder(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const order = await prisma.qurbanOrder.findFirst({
    where: { id, program: { mosqueId: user.mosqueId } },
    include: { program: true },
  });
  if (!order) fail("Pesanan qurban tidak dijumpai.");
  if (order.status !== "MENUNGGU") fail("Pesanan ini tidak lagi menunggu pembayaran.", order.programId);

  try {
    await confirmPayment({ kind: "QURBAN", id: order.id, actorEmail: user.email ?? "sistem" });
  } catch (error) {
    fail(
      error instanceof Error ? error.message : "Pengesahan pesanan gagal. Sila cuba semula.",
      order.programId,
    );
  }

  await audit({
    actor: user,
    action: "PAY",
    entity: "QurbanOrder",
    entityId: order.id,
    mosqueId: user.mosqueId,
    before: { status: order.status },
    after: { status: "DIBAYAR", amountSen: order.amountSen, shares: order.shares },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  maklum(`Pesanan ${order.orderNo} (${rm(order.amountSen)}) disahkan.`, order.programId);
}

export async function recordDistribution(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const programId = text(formData, "programId");
  const program = await prisma.qurbanProgram.findFirst({ where: { id: programId, mosqueId: user.mosqueId } });
  if (!program) fail("Program qurban tidak dijumpai.");

  const recipientName = text(formData, "recipientName");
  if (!recipientName) fail("Nama penerima wajib diisi.", program.id);

  const count = await prisma.qurbanDistribution.count({ where: { programId: program.id } });
  const packNo = `PK/${program.year}/${String(count + 1).padStart(3, "0")}`;

  const distribution = await prisma.qurbanDistribution.create({
    data: {
      programId: program.id,
      packNo,
      recipientName,
      recipientPhone: text(formData, "recipientPhone") || null,
      area: text(formData, "area") || null,
      deliveredBy: text(formData, "deliveredBy") || user.name || null,
      deliveredAt: null,
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "QurbanDistribution",
    entityId: distribution.id,
    mosqueId: user.mosqueId,
    after: { packNo, recipientName, area: distribution.area },
  });

  revalidatePath(BASE);
  maklum(`Pek ${packNo} untuk ${recipientName} telah direkodkan.`, program.id);
}

export async function markDelivered(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const distribution = await prisma.qurbanDistribution.findFirst({
    where: { id, program: { mosqueId: user.mosqueId } },
  });
  if (!distribution) fail("Rekod agihan tidak dijumpai.");
  if (distribution.deliveredAt) fail("Pek ini sudah ditanda dihantar.", distribution.programId);

  await prisma.qurbanDistribution.update({
    where: { id: distribution.id },
    data: {
      deliveredAt: new Date(),
      deliveredBy: distribution.deliveredBy || user.name || "AJK masjid",
    },
  });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "QurbanDistribution",
    entityId: distribution.id,
    mosqueId: user.mosqueId,
    before: { deliveredAt: null },
    after: { deliveredAt: new Date().toISOString(), packNo: distribution.packNo },
  });

  revalidatePath(BASE);
  maklum(`Pek ${distribution.packNo} ditanda telah dihantar.`, distribution.programId);
}
