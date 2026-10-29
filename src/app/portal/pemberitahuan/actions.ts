"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { deliverQueued, notify } from "@/lib/notifications";
import type { Role } from "@/lib/roles";

const BASE = "/portal/pemberitahuan";
const MANAGERS: Role[] = ["SETIAUSAHA", "BENDAHARI", "KETUA"];
const CHANNELS = ["SMS", "WHATSAPP", "EMAIL", "INAP"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^\+?[0-9][0-9\s()-]{6,}$/;

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

export async function sendMessage(formData: FormData) {
  const user = await requirePageUser(MANAGERS);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const channelRaw = text(formData, "channel");
  if (!CHANNELS.includes(channelRaw as (typeof CHANNELS)[number])) {
    fail("Saluran mesej tidak sah.");
  }
  const channel = channelRaw as (typeof CHANNELS)[number];

  const subject = text(formData, "subject");
  const body = text(formData, "body");
  if (!body) fail("Kandungan mesej wajib diisi.");
  if (body.length > 4000) fail("Kandungan mesej terlalu panjang (maksimum 4000 aksara).");

  let to = text(formData, "recipient");
  let userId: string | null = null;

  if (channel === "INAP") {
    const targetId = text(formData, "userId");
    if (!targetId) fail("Pilih pengguna untuk mesej dalam aplikasi.");

    const target = await prisma.user.findFirst({
      where: { id: targetId, mosqueId: user.mosqueId },
      select: { id: true, email: true },
    });
    if (!target) fail("Pengguna sasaran tidak sah untuk masjid ini.");
    if (!subject) fail("Subjek diperlukan untuk mesej dalam aplikasi.");

    to = target.email;
    userId = target.id;
  } else {
    if (!to) fail("Penerima wajib diisi.");
    if (channel === "EMAIL" && !EMAIL_RE.test(to)) {
      fail("Alamat e-mel penerima tidak sah.");
    }
    if (channel === "EMAIL" && !subject) fail("Subjek diperlukan untuk mesej e-mel.");
    if ((channel === "SMS" || channel === "WHATSAPP") && !PHONE_RE.test(to)) {
      fail("Nombor telefon penerima tidak sah.");
    }
  }

  const template = channel === "INAP" ? "dalam_aplikasi" : "manual";
  const notification = await notify({
    channel,
    to,
    template,
    subject: subject || null,
    body,
    userId,
    mosqueId: user.mosqueId,
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Notification",
    entityId: notification?.id ?? null,
    mosqueId: user.mosqueId,
    after: {
      channel,
      to,
      template,
      subject: subject || null,
      userId,
      status: notification?.status ?? "BERGILIR",
    },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(`${BASE}?selesai=hantar`);
}

export async function processQueue() {
  const user = await requirePageUser(MANAGERS);

  const results = await deliverQueued(50);
  const sent = results.filter((row) => row?.status === "DIHANTAR").length;
  const failed = results.filter((row) => row?.status === "GAGAL").length;

  await audit({
    actor: user,
    action: "SYNC",
    entity: "Notification",
    mosqueId: user.mosqueId,
    after: { processed: results.length, sent, failed },
  });

  revalidatePath(BASE);
  redirect(`${BASE}?selesai=barisan&diproses=${results.length}`);
}
