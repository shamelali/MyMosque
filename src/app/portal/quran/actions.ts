"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const BASE = "/portal/quran";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

function maklum(message: string): never {
  redirect(`${BASE}?maklum=${encodeURIComponent(message)}`);
}

export async function verifyTutor(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const tutor = await prisma.tutor.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!tutor) fail("Tutor tidak dijumpai.");
  if (tutor.verified) fail("Tauliah tutor ini sudah disahkan.");
  if (tutor.tauliahExpiry && tutor.tauliahExpiry < new Date()) {
    fail("Tauliah tutor ini telah tamat tempoh. Sila kemas kini data tauliah terlebih dahulu.");
  }

  const verifiedBy = user.name ?? user.email ?? "Pentadbir masjid";
  await prisma.tutor.update({
    where: { id: tutor.id },
    data: { verified: true, verifiedBy },
  });

  await audit({
    actor: user,
    action: "APPROVE",
    entity: "Tutor",
    entityId: tutor.id,
    mosqueId: user.mosqueId,
    before: { verified: tutor.verified, verifiedBy: tutor.verifiedBy },
    after: { verified: true, verifiedBy, tauliahNo: tutor.tauliahNo },
  });

  revalidatePath(BASE);
  maklum(`Tauliah ${tutor.name} telah disahkan.`);
}

export async function toggleTutor(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const tutor = await prisma.tutor.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!tutor) fail("Tutor tidak dijumpai.");

  const next = tutor.status === "AKTIF" ? "DIGANTUNG" : "AKTIF";
  await prisma.tutor.update({ where: { id: tutor.id }, data: { status: next } });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "Tutor",
    entityId: tutor.id,
    mosqueId: user.mosqueId,
    before: { status: tutor.status },
    after: { status: next },
  });

  revalidatePath(BASE);
  revalidatePath("/jemaah/quran");
  maklum(
    next === "DIGANTUNG"
      ? `${tutor.name} telah digantung daripada menerima tempahan baharu.`
      : `${tutor.name} telah diaktifkan semula.`,
  );
}

export async function markPayoutPaid(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const payout = await prisma.payout.findFirst({
    where: { id, tutor: { mosqueId: user.mosqueId } },
    include: { tutor: { select: { name: true } } },
  });
  if (!payout) fail("Rekod bayaran tutor tidak dijumpai.");
  if (payout.status === "DIBAYAR") fail("Bayaran ini sudah ditanda dibayar.");

  const reference = `MOCK-PAYOUT-${Date.now().toString(36).toUpperCase()}`;
  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: "DIBAYAR", paidAt: new Date(), reference },
  });

  await audit({
    actor: user,
    action: "PAY",
    entity: "Payout",
    entityId: payout.id,
    mosqueId: user.mosqueId,
    before: { status: payout.status },
    after: { status: "DIBAYAR", netSen: payout.netSen, reference },
  });

  revalidatePath(BASE);
  maklum(`Bayaran bersih untuk ${payout.tutor.name} telah ditanda dibayar (${reference}).`);
}
