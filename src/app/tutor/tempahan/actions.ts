"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { rm, tarikh } from "@/lib/utils";
import { requireTutor, startOfDay } from "../_lib";

const BASE = "/tutor/tempahan";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

function maklum(message: string): never {
  redirect(`${BASE}?maklum=${encodeURIComponent(message)}`);
}

type NotifiableBooking = {
  bookingNo: string;
  parentName: string;
  parentEmail: string;
  parentUserId: string | null;
  studentName: string;
  amountSen: number;
  slot: { date: Date; startTime: string; endTime: string };
};

async function notifyParent(
  booking: NotifiableBooking,
  input: { template: string; subject: string; body: string; mosqueId: string | null },
) {
  await notify({
    channel: "EMAIL",
    to: booking.parentEmail,
    template: input.template,
    subject: input.subject,
    body: input.body,
    mosqueId: input.mosqueId,
    userId: booking.parentUserId,
    payload: { bookingNo: booking.bookingNo },
  });
  if (booking.parentUserId) {
    await notify({
      channel: "INAP",
      to: booking.parentEmail,
      template: input.template,
      subject: input.subject,
      body: input.body,
      mosqueId: input.mosqueId,
      userId: booking.parentUserId,
      payload: { bookingNo: booking.bookingNo },
    });
  }
}

export async function markCompleted(formData: FormData) {
  const { user, tutor } = await requireTutor();

  const id = text(formData, "id");
  const booking = await prisma.quranBooking.findFirst({
    where: { id, tutorId: tutor.id },
    include: { slot: true },
  });
  if (!booking) fail("Tempahan tidak dijumpai.");
  if (booking.status !== "DISAHKAN") fail("Hanya tempahan berstatus disahkan boleh ditandakan selesai.");

  const today = startOfDay();
  if (startOfDay(booking.slot.date) > today) {
    fail("Kelas ini belum berlaku. Hanya kelas hari ini atau yang telah lalu boleh ditandakan selesai.");
  }

  await prisma.quranBooking.update({ where: { id: booking.id }, data: { status: "SELESAI" } });

  await notifyParent(booking, {
    template: "tempahan_selesai",
    subject: `Kelas selesai — ${booking.bookingNo}`,
    body: `Assalamualaikum ${booking.parentName}, kelas ${booking.studentName} bersama ${tutor.name} pada ${tarikh(
      booking.slot.date,
    )} (${booking.slot.startTime}–${booking.slot.endTime}) telah ditandakan selesai. Terima kasih kerana memilih kelas Al-Quran masjid.`,
    mosqueId: tutor.mosqueId,
  });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "QuranBooking",
    entityId: booking.id,
    mosqueId: tutor.mosqueId,
    before: { status: booking.status },
    after: { status: "SELESAI", completedBy: "tutor" },
  });

  revalidatePath(BASE);
  revalidatePath("/tutor");
  revalidatePath("/jemaah/saya");
  revalidatePath("/jemaah");
  maklum(`Tempahan ${booking.bookingNo} ditandakan selesai. Ibu bapa telah dimaklumkan.`);
}

export async function cancelBooking(formData: FormData) {
  const { user, tutor } = await requireTutor();

  const id = text(formData, "id");
  const booking = await prisma.quranBooking.findFirst({
    where: { id, tutorId: tutor.id },
    include: { slot: true },
  });
  if (!booking) fail("Tempahan tidak dijumpai.");
  if (booking.status !== "DISAHKAN") fail("Hanya tempahan berstatus disahkan boleh dibatalkan.");

  await prisma.$transaction([
    prisma.quranBooking.update({ where: { id: booking.id }, data: { status: "DIBATAL" } }),
    prisma.quranSlot.update({ where: { id: booking.slotId }, data: { status: "TERBUKA" } }),
  ]);

  await notifyParent(booking, {
    template: "tempahan_dibatalkan",
    subject: `Kelas dibatalkan — ${booking.bookingNo}`,
    body: `Assalamualaikum ${booking.parentName}, dengan dukacita dimaklumkan kelas ${booking.studentName} bersama ${
      tutor.name
    } pada ${tarikh(booking.slot.date)} (${booking.slot.startTime}–${booking.slot.endTime}) telah dibatalkan oleh tutor. Slot telah dikembalikan sebagai terbuka dan bayaran akan diproses mengikut dasar pemulangan. Hubungi masjid jika anda memerlukan bantuan.`,
    mosqueId: tutor.mosqueId,
  });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "QuranBooking",
    entityId: booking.id,
    mosqueId: tutor.mosqueId,
    before: { status: booking.status, slotStatus: booking.slot.status },
    after: { status: "DIBATAL", slotStatus: "TERBUKA", cancelledBy: "tutor", amountSen: booking.amountSen },
  });

  revalidatePath(BASE);
  revalidatePath("/tutor");
  revalidatePath("/tutor/jadual");
  revalidatePath("/jemaah/saya");
  revalidatePath("/jemaah");
  revalidatePath("/jemaah/quran");
  maklum(
    `Tempahan ${booking.bookingNo} dibatalkan (${rm(booking.amountSen)}). Slot telah dibuka semula dan ibu bapa dimaklumkan.`,
  );
}
