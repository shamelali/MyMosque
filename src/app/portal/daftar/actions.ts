"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const BASE = "/portal/daftar";
type Tab = "profil" | "pegawai" | "ajk" | "mesyuarat";

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

export async function updateMosque(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("profil", "Akaun anda belum dikaitkan dengan masjid.");

  const name = text(formData, "name");
  const district = text(formData, "district");
  if (!name || !district) fail("profil", "Nama dan daerah masjid wajib diisi.");

  const status = text(formData, "status");
  if (!["AKTIF", "TUTUP", "PROJEK"].includes(status)) fail("profil", "Status masjid tidak sah.");

  const capacityRaw = text(formData, "capacity");
  const capacity = capacityRaw ? Number.parseInt(capacityRaw, 10) : null;
  if (capacityRaw && (!Number.isFinite(capacity) || Number(capacity) < 0)) {
    fail("profil", "Kapasiti jemaah mesti nombor yang sah.");
  }

  const before = await prisma.mosque.findUnique({ where: { id: user.mosqueId } });
  if (!before) fail("profil", "Rekod masjid tidak dijumpai.");

  const data = {
    name,
    district,
    address: text(formData, "address") || null,
    phone: text(formData, "phone") || null,
    email: text(formData, "email") || null,
    capacity: capacity ?? null,
    status,
  };

  await prisma.mosque.update({ where: { id: user.mosqueId }, data });
  await audit({
    actor: user,
    action: "UPDATE",
    entity: "Mosque",
    entityId: user.mosqueId,
    mosqueId: user.mosqueId,
    before,
    after: data,
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  done("profil");
}

export async function addOfficer(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("pegawai", "Akaun anda belum dikaitkan dengan masjid.");

  const name = text(formData, "name");
  const position = text(formData, "position");
  const positions = ["PENGERUSI", "TIMBALAN", "SETIAUSAHA", "BENDAHARI", "AJK"];
  if (!name) fail("pegawai", "Nama pegawai wajib diisi.");
  if (!positions.includes(position)) fail("pegawai", "Jawatan pegawai tidak sah.");

  const appointmentDate = parseDate(formData.get("appointmentDate")) ?? new Date();
  const officer = await prisma.officer.create({
    data: {
      mosqueId: user.mosqueId,
      name,
      position,
      phone: text(formData, "phone") || null,
      email: text(formData, "email") || null,
      appointmentDate,
      status: "AKTIF",
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Officer",
    entityId: officer.id,
    mosqueId: user.mosqueId,
    after: officer,
  });

  revalidatePath(BASE);
  done("pegawai");
}

export async function endOfficer(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("pegawai", "Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const officer = await prisma.officer.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!officer) fail("pegawai", "Rekod pegawai tidak dijumpai.");
  if (officer.status === "TAMAT") fail("pegawai", "Pegawai ini sudah ditamatkan.");

  await prisma.officer.update({ where: { id: officer.id }, data: { status: "TAMAT" } });
  await audit({
    actor: user,
    action: "UPDATE",
    entity: "Officer",
    entityId: officer.id,
    mosqueId: user.mosqueId,
    before: { status: officer.status },
    after: { status: "TAMAT" },
  });

  revalidatePath(BASE);
  done("pegawai");
}

export async function scheduleMeeting(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("mesyuarat", "Akaun anda belum dikaitkan dengan masjid.");

  const title = text(formData, "title");
  const date = parseDate(formData.get("date"));
  if (!title) fail("mesyuarat", "Tajuk mesyuarat wajib diisi.");
  if (!date) fail("mesyuarat", "Tarikh dan masa mesyuarat tidak sah.");

  const meeting = await prisma.meeting.create({
    data: {
      mosqueId: user.mosqueId,
      title,
      date,
      location: text(formData, "location") || null,
      agenda: text(formData, "agenda") || null,
      status: "DIRANCANG",
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Meeting",
    entityId: meeting.id,
    mosqueId: user.mosqueId,
    after: meeting,
  });

  revalidatePath(BASE);
  done("mesyuarat");
}

export async function completeMeeting(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("mesyuarat", "Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const decisions = text(formData, "decisions");
  if (!decisions) fail("mesyuarat", "Sila catatkan keputusan mesyuarat.");

  const meeting = await prisma.meeting.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!meeting) fail("mesyuarat", "Rekod mesyuarat tidak dijumpai.");

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { status: "SELESAI", decisions },
  });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "Meeting",
    entityId: meeting.id,
    mosqueId: user.mosqueId,
    before: { status: meeting.status, decisions: meeting.decisions },
    after: { status: "SELESAI", decisions },
  });

  revalidatePath(BASE);
  done("mesyuarat");
}
