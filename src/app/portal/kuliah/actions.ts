"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const BASE = "/portal/kuliah";
type Tab = "program" | "penceramah";

function fail(tab: Tab, message: string): never {
  redirect(`${BASE}?tab=${tab}&ralat=${encodeURIComponent(message)}`);
}

function done(tab: Tab): never {
  redirect(`${BASE}?tab=${tab}`);
}

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function parseDate(value: FormDataEntryValue | null) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

const PROGRAM_TYPES = ["KULIAH_MAGHRIB", "CERAMAH", "KELAS_QURAN", "PROGRAM"];

export async function createProgram(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "AJK"]);
  if (!user.mosqueId) fail("program", "Akaun anda belum dikaitkan dengan masjid.");

  const title = text(formData, "title");
  const type = text(formData, "type");
  const date = parseDate(formData.get("date"));
  const startTime = text(formData, "startTime");
  const endTime = text(formData, "endTime");

  if (!title) fail("program", "Tajuk program wajib diisi.");
  if (!PROGRAM_TYPES.includes(type)) fail("program", "Jenis program tidak sah.");
  if (!date) fail("program", "Tarikh program tidak sah.");
  if (!/^\d{2}:\d{2}$/.test(startTime)) fail("program", "Masa mula tidak sah.");
  if (endTime && !/^\d{2}:\d{2}$/.test(endTime)) fail("program", "Masa tamat tidak sah.");

  const speakerIdRaw = text(formData, "speakerId");
  let speakerId: string | null = null;
  if (speakerIdRaw) {
    const speaker = await prisma.speaker.findUnique({ where: { id: speakerIdRaw } });
    if (!speaker) fail("program", "Penceramah yang dipilih tidak sah.");
    speakerId = speaker.id;
  }

  const capacityRaw = text(formData, "capacity");
  const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) : null;
  if (capacityRaw && (!Number.isFinite(capacity) || Number(capacity) < 0)) {
    fail("program", "Kapasiti peserta tidak sah.");
  }

  const program = await prisma.kuliahProgram.create({
    data: {
      mosqueId: user.mosqueId,
      title,
      type,
      speakerId,
      date,
      startTime,
      endTime: endTime || null,
      location: text(formData, "location") || null,
      capacity: capacity ?? null,
      status: "DIRANCANG",
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "KuliahProgram",
    entityId: program.id,
    mosqueId: user.mosqueId,
    after: { title, type, date, startTime, speakerId, status: "DIRANCANG" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  done("program");
}

export async function setProgramStatus(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "AJK"]);
  if (!user.mosqueId) fail("program", "Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const status = text(formData, "status");
  if (!["SAH", "DIBATAL", "SELESAI"].includes(status)) fail("program", "Status program tidak sah.");

  const program = await prisma.kuliahProgram.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!program) fail("program", "Program tidak dijumpai.");

  const allowed =
    (status === "SAH" && program.status === "DIRANCANG") ||
    (status === "DIBATAL" && ["DIRANCANG", "SAH"].includes(program.status)) ||
    (status === "SELESAI" && program.status === "SAH");
  if (!allowed) fail("program", "Peralihan status program ini tidak dibenarkan.");

  await prisma.kuliahProgram.update({ where: { id: program.id }, data: { status } });
  await audit({
    actor: user,
    action: status === "SAH" ? "APPROVE" : status === "DIBATAL" ? "REJECT" : "UPDATE",
    entity: "KuliahProgram",
    entityId: program.id,
    mosqueId: user.mosqueId,
    before: { status: program.status },
    after: { status },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  done("program");
}

export async function recordAttendance(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "AJK"]);
  if (!user.mosqueId) fail("program", "Akaun anda belum dikaitkan dengan masjid.");

  const programId = text(formData, "programId");
  const name = text(formData, "name");
  if (!name) fail("program", "Nama peserta wajib diisi.");

  const program = await prisma.kuliahProgram.findFirst({
    where: { id: programId, mosqueId: user.mosqueId },
  });
  if (!program) fail("program", "Program tidak dijumpai.");
  if (!["SAH", "SELESAI"].includes(program.status)) {
    fail("program", "Kehadiran hanya boleh direkod untuk program yang sah atau selesai.");
  }

  const attendance = await prisma.attendance.create({
    data: {
      programId: program.id,
      name,
      phone: text(formData, "phone") || null,
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Attendance",
    entityId: attendance.id,
    mosqueId: user.mosqueId,
    after: { programId: program.id, name, phone: attendance.phone },
  });

  revalidatePath(BASE);
  done("program");
}

export async function addSpeaker(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "AJK"]);
  if (!user.mosqueId) fail("penceramah", "Akaun anda belum dikaitkan dengan masjid.");

  const name = text(formData, "name");
  const tauliahNo = text(formData, "tauliahNo");
  if (!name) fail("penceramah", "Nama penceramah wajib diisi.");
  if (!tauliahNo) fail("penceramah", "Nombor tauliah wajib diisi.");

  const exists = await prisma.speaker.findUnique({ where: { tauliahNo } });
  if (exists) fail("penceramah", "Nombor tauliah ini sudah didaftarkan.");

  const speaker = await prisma.speaker.create({
    data: {
      name,
      tauliahNo,
      tauliahExpiry: parseDate(formData.get("tauliahExpiry")),
      phone: text(formData, "phone") || null,
      district: text(formData, "district") || null,
      verified: false,
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Speaker",
    entityId: speaker.id,
    mosqueId: user.mosqueId,
    after: { name, tauliahNo, verified: false },
  });

  revalidatePath(BASE);
  done("penceramah");
}
