import { notFound } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";

/** Resolve the signed-in TUTOR user to their Tutor row, or show a 404. */
export async function requireTutor() {
  const user = await requirePageUser(["TUTOR"]);
  const tutor = await prisma.tutor.findUnique({
    where: { userId: user.id },
    include: { mosque: { select: { id: true, name: true, district: true } } },
  });
  if (!tutor) notFound();
  return { user, tutor };
}

export function startOfDay(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
