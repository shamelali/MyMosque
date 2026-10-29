"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { bookWithLock, lockSlot } from "@/lib/quran";

const BASE = "/jemaah/quran";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function bookClass(formData: FormData) {
  const user = await requirePageUser();

  const slotId = text(formData, "slotId");
  if (!slotId) redirect(`${BASE}?ralat=${encodeURIComponent("Slot tidak sah.")}`);
  const backUrl = `${BASE}/tempah/${slotId}`;
  const fail = (message: string): never => redirect(`${backUrl}?ralat=${encodeURIComponent(message)}`);

  const hours = Number.parseInt(text(formData, "hours"), 10);
  const studentCount = Number.parseInt(text(formData, "studentCount"), 10);
  if (![1, 2, 3].includes(hours)) fail("Tempoh kelas mesti antara 1 hingga 3 jam.");
  if (![1, 2, 3].includes(studentCount)) fail("Bilangan pelajar mesti antara 1 hingga 3 orang.");

  const studentName = text(formData, "studentName");
  const studentAge = Number.parseInt(text(formData, "studentAge"), 10);
  const parentName = text(formData, "parentName");
  const parentEmail = text(formData, "parentEmail").toLowerCase();
  const parentPhone = text(formData, "parentPhone");

  if (!studentName) fail("Nama pelajar wajib diisi.");
  if (!Number.isFinite(studentAge) || studentAge < 1 || studentAge > 99) fail("Umur pelajar tidak sah.");
  if (!parentName) fail("Nama ibu bapa atau penjaga wajib diisi.");
  if (!parentEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(parentEmail)) {
    fail("Alamat e-mel yang sah diperlukan untuk resit.");
  }

  const guardianConsent = formData.get("guardianConsent") === "on";
  if (studentAge < 18 && !guardianConsent) {
    fail("Persetujuan penjaga diperlukan untuk pelajar bawah 18 tahun.");
  }

  const slot = await prisma.quranSlot.findUnique({ where: { id: slotId }, include: { tutor: true } });
  if (!slot) redirect(`${BASE}?ralat=${encodeURIComponent("Slot tidak dijumpai.")}`);
  const [startHour, startMinute] = slot.startTime.split(":").map(Number);
  const slotStart = new Date(slot.date);
  slotStart.setHours(startHour || 0, startMinute || 0, 0, 0);
  if (slotStart.getTime() < Date.now()) fail("Slot ini telah berlalu. Sila pilih slot lain.");
  if (slot.status === "DITEMPAH") fail("Slot ini telah ditempah. Sila pilih slot lain.");
  if (slot.status === "DITUTUP") fail("Slot ini telah ditutup oleh tutor.");
  if (!slot.tutor.verified) fail("Tutor ini belum disahkan oleh masjid.");
  if (slot.tutor.status !== "AKTIF") fail("Tutor ini sedang digantung dan tidak menerima tempahan.");

  let booking: Awaited<ReturnType<typeof bookWithLock>> | null = null;
  try {
    const lock = await lockSlot(slot.id);
    booking = await bookWithLock({
      lockToken: lock.token,
      parentUserId: user.id,
      parentName,
      parentEmail,
      parentPhone,
      studentName,
      studentAge,
      studentCount,
      hours,
      guardianConsent,
    });
  } catch (error) {
    fail(error instanceof Error ? error.message : "Tempahan gagal. Sila cuba semula.");
  }

  if (!booking) return fail("Tempahan gagal. Sila cuba semula.");

  await audit({
    actor: user,
    action: "CREATE",
    entity: "QuranBooking",
    entityId: booking.id,
    mosqueId: slot.tutor.mosqueId,
    after: {
      bookingNo: booking.bookingNo,
      slotId: slot.id,
      tutorId: slot.tutorId,
      hours,
      studentCount,
      studentAge,
      amountSen: booking.amountSen,
      guardianConsent,
    },
  });

  revalidatePath(BASE);
  revalidatePath(backUrl);
  revalidatePath("/portal/quran");
  redirect(`/jemaah/bayar/QURAN_BOOKING/${booking.id}`);
}
