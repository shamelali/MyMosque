"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { confirmPayment } from "@/lib/payments";
import { reconcileTpmj as runTpmjReconcile } from "@/lib/integrations";
import { rm, senFromRinggit } from "@/lib/utils";

const BASE = "/portal/derma";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

function maklum(message: string): never {
  redirect(`${BASE}?maklum=${encodeURIComponent(message)}`);
}

export async function createCampaign(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const title = text(formData, "title");
  const description = text(formData, "description");
  if (!title) fail("Tajuk kempen wajib diisi.");
  if (!description) fail("Keterangan kempen wajib diisi.");

  const targetSen = senFromRinggit(text(formData, "target"));
  if (!Number.isFinite(targetSen) || targetSen <= 0) {
    fail("Sasaran kempen mesti lebih daripada RM0.00.");
  }

  const endRaw = text(formData, "endDate");
  const endDate = endRaw ? new Date(`${endRaw}T23:59:59`) : null;
  if (!endDate || Number.isNaN(endDate.getTime())) fail("Tarikh tamat kempen tidak sah.");

  const qrPayload = `DUITNOW://pay?ref=CMP-${randomBytes(4).toString("hex").toUpperCase()}`;

  const campaign = await prisma.campaign.create({
    data: {
      mosqueId: user.mosqueId,
      title,
      description,
      targetSen,
      raisedSen: 0,
      startDate: new Date(),
      endDate,
      status: "AKTIF",
      qrPayload,
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Campaign",
    entityId: campaign.id,
    mosqueId: user.mosqueId,
    after: { title, targetSen, endDate, qrPayload },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  maklum(`Kempen "${title}" telah dibuka dengan sasaran ${rm(targetSen)}.`);
}

export async function closeCampaign(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const campaign = await prisma.campaign.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!campaign) fail("Kempen tidak dijumpai.");
  if (campaign.status !== "AKTIF") fail("Hanya kempen aktif boleh ditutup.");

  await prisma.campaign.update({ where: { id: campaign.id }, data: { status: "TAMAT" } });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "Campaign",
    entityId: campaign.id,
    mosqueId: user.mosqueId,
    before: { status: campaign.status },
    after: { status: "TAMAT" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  maklum(`Kempen "${campaign.title}" telah ditutup.`);
}

export async function confirmDonation(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const donation = await prisma.donation.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!donation) fail("Rekod derma tidak dijumpai.");
  if (donation.status !== "MENUNGGU") fail("Derma ini tidak lagi menunggu pengesahan.");

  try {
    await confirmPayment({ kind: "DONATION", id: donation.id, actorEmail: user.email ?? "sistem" });
  } catch (error) {
    fail(error instanceof Error ? error.message : "Pengesahan derma gagal. Sila cuba semula.");
  }

  await audit({
    actor: user,
    action: "PAY",
    entity: "Donation",
    entityId: donation.id,
    mosqueId: user.mosqueId,
    before: { status: donation.status },
    after: { status: "DIBAYAR", amountSen: donation.amountSen, sumber: "pengesahan manual portal" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  maklum(`Derma ${rm(donation.amountSen)} telah disahkan dan resit dijana.`);
}

export async function syncTpmj() {
  const user = await requirePageUser(["BENDAHARI", "KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const run = await runTpmjReconcile();

  await audit({
    actor: user,
    action: "SYNC",
    entity: "SyncRun",
    entityId: run.id,
    mosqueId: user.mosqueId,
    after: { integration: "tpmj", status: run.status, records: run.records, log: run.log },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");

  if (run.status !== "BERJAYA") {
    fail(`Penyegerakan TPMJ gagal: ${run.log ?? "ralat tidak diketahui"}`);
  }
  maklum(run.log ?? `${run.records} rekod disegerakkan ke TPMJ.`);
}
