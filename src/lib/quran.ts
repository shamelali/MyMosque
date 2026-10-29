import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";

// S08 Quran booking. Slot engine: a slot is locked while the parent pays, so two
// families cannot book the same hour. Pricing is hourly rate x hours, tiered by
// number of students. Bookings involving minors require recorded guardian consent.

export const LOCK_MINUTES = 10;
export const PAYMENT_WINDOW_MINUTES = 30;

const TIERS = [
  { max: 1, multiplier: 1 },
  { max: 2, multiplier: 1.5 },
  { max: 99, multiplier: 1.8 },
];

export function tierMultiplier(studentCount: number) {
  return TIERS.find((t) => studentCount <= t.max)?.multiplier ?? 1.8;
}

export function priceFor(input: { hourlyRateSen: number; hours: number; studentCount: number }) {
  const rate = input.hourlyRateSen * tierMultiplier(input.studentCount);
  return Math.round(rate * input.hours);
}

export function commissionFor(amountSen: number, pct = 15) {
  return Math.round((amountSen * pct) / 100);
}

export async function releaseExpiredLocks() {
  const now = new Date();
  const expired = await prisma.slotLock.findMany({
    where: { expiresAt: { lt: now } },
    select: { id: true, slotId: true },
  });
  if (!expired.length) return 0;
  await prisma.$transaction([
    prisma.slotLock.deleteMany({ where: { id: { in: expired.map((e) => e.id) } } }),
    prisma.quranSlot.updateMany({
      where: { id: { in: expired.map((e) => e.slotId) }, status: "DIKUNCI" },
      data: { status: "TERBUKA" },
    }),
  ]);
  return expired.length;
}

/** Lock an open slot for this checkout. Throws a BM message if someone beat us to it. */
export async function lockSlot(slotId: string) {
  await releaseExpiredLocks();
  return prisma.$transaction(async (tx) => {
    const slot = await tx.quranSlot.findUnique({ where: { id: slotId }, include: { lock: true } });
    if (!slot) throw new Error("Slot tidak dijumpai.");
    if (slot.status === "DITEMPAH") throw new Error("Slot ini telah ditempah. Sila pilih slot lain.");
    const now = new Date();
    if (slot.lock && slot.lock.expiresAt > now) {
      throw new Error("Slot ini sedang dipegang oleh pemohon lain. Sila pilih slot lain.");
    }
    if (slot.lock) await tx.slotLock.delete({ where: { id: slot.lock.id } });

    const lock = await tx.slotLock.create({
      data: {
        slotId,
        tutorId: slot.tutorId,
        token: randomBytes(16).toString("hex"),
        expiresAt: new Date(now.getTime() + LOCK_MINUTES * 60_000),
      },
    });
    await tx.quranSlot.update({ where: { id: slotId }, data: { status: "DIKUNCI" } });
    return lock;
  });
}

export type BookingInput = {
  lockToken: string;
  parentUserId: string | null;
  parentName: string;
  parentEmail: string;
  parentPhone: string;
  studentName: string;
  studentAge: number;
  studentCount: number;
  hours: number;
  guardianConsent: boolean;
};

export async function bookWithLock(input: BookingInput) {
  await releaseExpiredLocks();
  return prisma.$transaction(async (tx) => {
    const lock = await tx.slotLock.findUnique({
      where: { token: input.lockToken },
      include: { slot: { include: { tutor: true } } },
    });
    if (!lock) throw new Error("Kunci slot tidak sah atau telah tamat. Sila pilih slot semula.");
    if (lock.expiresAt < new Date()) throw new Error("Masa memegang slot telah tamat. Sila pilih slot semula.");
    if (lock.slot.status === "DITEMPAH") throw new Error("Slot telah diambil. Sila pilih slot lain.");
    if (input.studentAge < 18 && !input.guardianConsent) {
      throw new Error("Persetujuan penjaga diperlukan untuk pelajar bawah 18 tahun.");
    }

    const amountSen = priceFor({
      hourlyRateSen: lock.slot.tutor.hourlyRateSen,
      hours: input.hours,
      studentCount: input.studentCount,
    });
    const year = new Date().getFullYear();
    const count = await tx.quranBooking.count();
    const bookingNo = `QRN/${year}/${String(count + 1).padStart(4, "0")}`;
    const consentRef = `CONSENT-${randomBytes(4).toString("hex").toUpperCase()}`;

    const booking = await tx.quranBooking.create({
      data: {
        bookingNo,
        slotId: lock.slotId,
        tutorId: lock.tutorId,
        parentUserId: input.parentUserId,
        parentName: input.parentName,
        parentEmail: input.parentEmail,
        parentPhone: input.parentPhone,
        studentName: input.studentName,
        studentAge: input.studentAge,
        studentCount: input.studentCount,
        hours: input.hours,
        amountSen,
        commissionSen: commissionFor(amountSen),
        guardianConsent: input.guardianConsent,
        consentAt: input.guardianConsent ? new Date() : null,
        consentRef: input.guardianConsent ? consentRef : null,
        status: "MENUNGGU_BAYARAN",
      },
      include: { slot: true },
    });

    await tx.slotLock.delete({ where: { id: lock.id } });
    await tx.quranSlot.update({ where: { id: lock.slotId }, data: { status: "DITEMPAH" } });
    return booking;
  });
}

/** Release unpaid bookings after the payment window, freeing their slots. */
export async function releaseStaleBookings() {
  const cutoff = new Date(Date.now() - PAYMENT_WINDOW_MINUTES * 60_000);
  const stale = await prisma.quranBooking.findMany({
    where: { status: "MENUNGGU_BAYARAN", createdAt: { lt: cutoff } },
    select: { id: true, slotId: true },
  });
  if (!stale.length) return 0;
  await prisma.$transaction([
    prisma.quranBooking.updateMany({
      where: { id: { in: stale.map((s) => s.id) } },
      data: { status: "DIBATAL" },
    }),
    prisma.quranSlot.updateMany({
      where: { id: { in: stale.map((s) => s.slotId) } },
      data: { status: "TERBUKA" },
    }),
  ]);
  return stale.length;
}

export async function addSlots(tutorId: string, date: string, times: string[], durationHours = 1) {
  const base = new Date(`${date}T00:00:00`);
  if (Number.isNaN(base.getTime())) throw new Error("Tarikh tidak sah.");
  const created = [];
  for (const start of times) {
    const [h, m] = start.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) continue;
    const endH = h + durationHours;
    const end = `${String(endH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    const exists = await prisma.quranSlot.findUnique({
      where: { tutorId_date_startTime: { tutorId, date: base, startTime: start } },
    });
    if (exists) continue;
    created.push(
      await prisma.quranSlot.create({
        data: { tutorId, date: base, startTime: start, endTime: end, status: "TERBUKA" },
      }),
    );
  }
  return created;
}

export async function openSlotsForTutor(tutorId: string, days = 14) {
  return prisma.quranSlot.findMany({
    where: { tutorId, status: "TERBUKA", date: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    take: days * 5,
  });
}
