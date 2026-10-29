"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { addSlots } from "@/lib/quran";
import { tarikh } from "@/lib/utils";
import { requireTutor, startOfDay, addDays } from "../_lib";

const BASE = "/tutor/jadual";
const TIMES = ["09:00", "10:30", "14:00", "16:00", "20:00"];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

function maklum(message: string): never {
  redirect(`${BASE}?maklum=${encodeURIComponent(message)}`);
}

export async function createSlots(formData: FormData) {
  const { user, tutor } = await requireTutor();

  const date = text(formData, "date");
  const parsed = new Date(`${date}T00:00:00`);
  if (!date || Number.isNaN(parsed.getTime())) fail("Sila pilih tarikh yang sah.");

  const today = startOfDay();
  if (parsed < today) fail("Tarikh yang telah berlalu tidak boleh dipilih.");
  if (parsed >= addDays(today, 14)) fail("Slot hanya boleh ditambah dalam tempoh 14 hari akan datang.");

  const times = formData
    .getAll("times")
    .map((value) => String(value))
    .filter((value) => TIMES.includes(value));
  if (times.length === 0) fail("Sila pilih sekurang-kurangnya satu masa slot.");

  const created = await addSlots(tutor.id, date, times);
  if (created.length === 0) {
    maklum("Slot untuk tarikh dan masa tersebut sudah wujud. Tiada slot baharu ditambah.");
  }

  await audit({
    actor: user,
    action: "CREATE",
    entity: "QuranSlot",
    entityId: null,
    mosqueId: tutor.mosqueId,
    after: { date, times, slotIds: created.map((slot) => slot.id) },
  });

  revalidatePath(BASE);
  revalidatePath("/tutor");
  revalidatePath("/jemaah/quran");
  maklum(`${created.length} slot baharu ditambah untuk ${tarikh(parsed)}.`);
}

export async function toggleSlot(formData: FormData) {
  const { user, tutor } = await requireTutor();

  const id = text(formData, "id");
  const slot = await prisma.quranSlot.findFirst({ where: { id, tutorId: tutor.id } });
  if (!slot) fail("Slot tidak dijumpai.");
  if (slot.status !== "TERBUKA" && slot.status !== "DITUTUP") {
    fail("Slot yang ditempah atau dikunci tidak boleh dibuka atau ditutup.");
  }

  const next = slot.status === "TERBUKA" ? "DITUTUP" : "TERBUKA";
  await prisma.quranSlot.update({ where: { id: slot.id }, data: { status: next } });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "QuranSlot",
    entityId: slot.id,
    mosqueId: tutor.mosqueId,
    before: { status: slot.status },
    after: { status: next, date: slot.date, startTime: slot.startTime },
  });

  revalidatePath(BASE);
  revalidatePath("/tutor");
  revalidatePath("/jemaah/quran");
  maklum(
    next === "DITUTUP"
      ? `Slot ${slot.startTime} pada ${tarikh(slot.date)} telah ditutup.`
      : `Slot ${slot.startTime} pada ${tarikh(slot.date)} telah dibuka semula.`,
  );
}
