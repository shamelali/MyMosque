"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { senFromRinggit } from "@/lib/utils";

const BASE = "/jemaah/derma";
const FREQUENCIES = ["BULANAN", "MINGGUAN"];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string, campaignId: string): never {
  const suffix = campaignId ? `&kempen=${encodeURIComponent(campaignId)}` : "";
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}${suffix}`);
}

export async function createDonation(formData: FormData) {
  const user = await requirePageUser();

  const campaignId = text(formData, "campaignId");
  const campaign = await prisma.campaign.findFirst({
    where: {
      id: campaignId,
      status: "AKTIF",
      ...(user.mosqueId ? { mosqueId: user.mosqueId } : {}),
    },
  });
  if (!campaign) fail("Kempen ini tidak lagi aktif. Sila pilih kempen lain.", campaignId);

  const donorName = text(formData, "donorName");
  const donorEmail = text(formData, "donorEmail").toLowerCase();
  const donorPhone = text(formData, "donorPhone");
  if (!donorName) fail("Nama penderma wajib diisi.", campaignId);
  if (!donorEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(donorEmail)) {
    fail("Alamat e-mel yang sah diperlukan untuk resit.", campaignId);
  }

  const amountSen = senFromRinggit(text(formData, "amount"));
  if (!Number.isFinite(amountSen) || amountSen <= 0) {
    fail("Jumlah derma mesti lebih daripada RM0.00.", campaignId);
  }

  const anonymous = formData.get("anonymous") === "on";
  const recurring = formData.get("recurring") === "on";
  const frequencyRaw = text(formData, "frequency");
  const frequency = recurring && FREQUENCIES.includes(frequencyRaw) ? frequencyRaw : recurring ? "BULANAN" : null;

  const donation = await prisma.donation.create({
    data: {
      mosqueId: campaign.mosqueId,
      campaignId: campaign.id,
      donorName,
      donorEmail,
      donorPhone: donorPhone || null,
      amountSen,
      anonymous,
      recurring,
      frequency,
      status: "MENUNGGU",
      method: "QR",
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Donation",
    entityId: donation.id,
    mosqueId: campaign.mosqueId,
    after: {
      campaignId: campaign.id,
      amountSen,
      anonymous,
      recurring,
      frequency,
    },
  });

  revalidatePath(BASE);
  revalidatePath("/portal/derma");
  redirect(`/jemaah/bayar/DONATION/${donation.id}`);
}
