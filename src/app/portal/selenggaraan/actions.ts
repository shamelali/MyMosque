"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { senFromRinggit } from "@/lib/utils";

const BASE = "/portal/selenggaraan";
type Tab = "aset" | "aduan" | "pemeriksaan";

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

export async function addAsset(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "AJK"]);
  if (!user.mosqueId) fail("aset", "Akaun anda belum dikaitkan dengan masjid.");

  const name = text(formData, "name");
  const category = text(formData, "category");
  const condition = text(formData, "condition");
  if (!name) fail("aset", "Nama aset wajib diisi.");
  if (!["PERABOT", "ELEKTRIK", "KENDERAAN", "BANGUNAN", "AUDIO"].includes(category)) {
    fail("aset", "Kategori aset tidak sah.");
  }
  if (!["BAIK", "SEDERHANA", "ROSAK"].includes(condition)) fail("aset", "Keadaan aset tidak sah.");

  const valueRaw = text(formData, "value");
  const valueSen = valueRaw ? senFromRinggit(valueRaw) : null;
  if (valueRaw && (!Number.isFinite(valueSen) || (valueSen ?? 0) < 0)) {
    fail("aset", "Nilai aset tidak sah.");
  }

  const asset = await prisma.asset.create({
    data: {
      mosqueId: user.mosqueId,
      name,
      category,
      location: text(formData, "location") || null,
      acquiredAt: parseDate(formData.get("acquiredAt")),
      valueSen,
      condition,
      status: "AKTIF",
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Asset",
    entityId: asset.id,
    mosqueId: user.mosqueId,
    after: asset,
  });

  revalidatePath(BASE);
  done("aset");
}

export async function createRequest(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "AJK"]);
  if (!user.mosqueId) fail("aduan", "Akaun anda belum dikaitkan dengan masjid.");

  const title = text(formData, "title");
  const priority = text(formData, "priority");
  if (!title) fail("aduan", "Tajuk aduan wajib diisi.");
  if (!["RENDAH", "SEDERHANA", "TINGGI"].includes(priority)) fail("aduan", "Keutamaan aduan tidak sah.");

  const assetIdRaw = text(formData, "assetId");
  let assetId: string | null = null;
  if (assetIdRaw) {
    const asset = await prisma.asset.findFirst({ where: { id: assetIdRaw, mosqueId: user.mosqueId } });
    if (!asset) fail("aduan", "Aset yang dipilih tidak sah.");
    assetId = asset.id;
  }

  const request = await prisma.maintenanceRequest.create({
    data: {
      mosqueId: user.mosqueId,
      assetId,
      title,
      description: text(formData, "description") || null,
      priority,
      status: "DIHANTAR",
      reportedBy: text(formData, "reportedBy") || user.name || user.email || null,
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "MaintenanceRequest",
    entityId: request.id,
    mosqueId: user.mosqueId,
    after: { title, priority, assetId },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  done("aduan");
}

export async function approveRequest(formData: FormData) {
  const user = await requirePageUser(["KETUA", "AJK"]);
  if (!user.mosqueId) fail("aduan", "Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const request = await prisma.maintenanceRequest.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!request) fail("aduan", "Aduan tidak dijumpai.");
  if (request.status !== "DIHANTAR") fail("aduan", "Hanya aduan baharu boleh diluluskan.");

  await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { status: "DILULUSKAN" } });
  await audit({
    actor: user,
    action: "APPROVE",
    entity: "MaintenanceRequest",
    entityId: request.id,
    mosqueId: user.mosqueId,
    before: { status: request.status },
    after: { status: "DILULUSKAN" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  done("aduan");
}

export async function startRequest(formData: FormData) {
  const user = await requirePageUser(["KETUA", "AJK"]);
  if (!user.mosqueId) fail("aduan", "Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const request = await prisma.maintenanceRequest.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!request) fail("aduan", "Aduan tidak dijumpai.");
  if (request.status !== "DILULUSKAN") fail("aduan", "Hanya aduan yang diluluskan boleh dimulakan.");

  await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { status: "DALAM_PROSES" } });
  await audit({
    actor: user,
    action: "UPDATE",
    entity: "MaintenanceRequest",
    entityId: request.id,
    mosqueId: user.mosqueId,
    before: { status: request.status },
    after: { status: "DALAM_PROSES" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  done("aduan");
}

export async function completeRequest(formData: FormData) {
  const user = await requirePageUser(["KETUA", "AJK"]);
  if (!user.mosqueId) fail("aduan", "Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const request = await prisma.maintenanceRequest.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!request) fail("aduan", "Aduan tidak dijumpai.");
  if (!["DILULUSKAN", "DALAM_PROSES"].includes(request.status)) {
    fail("aduan", "Aduan ini tidak boleh ditandakan selesai.");
  }

  const costRaw = text(formData, "cost");
  const costSen = senFromRinggit(costRaw);
  if (!costRaw || !Number.isFinite(costSen) || costSen < 0) fail("aduan", "Kos pembaikan tidak sah.");

  await prisma.maintenanceRequest.update({
    where: { id: request.id },
    data: { status: "SELESAI", costSen, completedAt: new Date() },
  });
  await audit({
    actor: user,
    action: "UPDATE",
    entity: "MaintenanceRequest",
    entityId: request.id,
    mosqueId: user.mosqueId,
    before: { status: request.status, costSen: request.costSen },
    after: { status: "SELESAI", costSen },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  done("aduan");
}

export async function rejectRequest(formData: FormData) {
  const user = await requirePageUser(["KETUA", "AJK"]);
  if (!user.mosqueId) fail("aduan", "Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const request = await prisma.maintenanceRequest.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!request) fail("aduan", "Aduan tidak dijumpai.");
  if (!["DIHANTAR", "DILULUSKAN"].includes(request.status)) {
    fail("aduan", "Aduan ini tidak boleh ditolak.");
  }

  await prisma.maintenanceRequest.update({ where: { id: request.id }, data: { status: "DITOLAK" } });
  await audit({
    actor: user,
    action: "REJECT",
    entity: "MaintenanceRequest",
    entityId: request.id,
    mosqueId: user.mosqueId,
    before: { status: request.status },
    after: { status: "DITOLAK" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  done("aduan");
}

export async function addInspection(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "AJK"]);
  if (!user.mosqueId) fail("pemeriksaan", "Akaun anda belum dikaitkan dengan masjid.");

  const date = parseDate(formData.get("date"));
  const inspector = text(formData, "inspector");
  const findings = text(formData, "findings");
  const result = text(formData, "result");
  if (!date) fail("pemeriksaan", "Tarikh pemeriksaan tidak sah.");
  if (!inspector) fail("pemeriksaan", "Nama pemeriksa wajib diisi.");
  if (!findings) fail("pemeriksaan", "Dapatan pemeriksaan wajib diisi.");
  if (!["LULUS", "TINDAKAN"].includes(result)) fail("pemeriksaan", "Keputusan pemeriksaan tidak sah.");

  const assetIdRaw = text(formData, "assetId");
  let assetId: string | null = null;
  if (assetIdRaw) {
    const asset = await prisma.asset.findFirst({ where: { id: assetIdRaw, mosqueId: user.mosqueId } });
    if (!asset) fail("pemeriksaan", "Aset yang dipilih tidak sah.");
    assetId = asset.id;
  }

  const inspection = await prisma.inspection.create({
    data: {
      mosqueId: user.mosqueId,
      assetId,
      date,
      inspector,
      findings,
      result,
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Inspection",
    entityId: inspection.id,
    mosqueId: user.mosqueId,
    after: { date, inspector, result, assetId },
  });

  revalidatePath(BASE);
  done("pemeriksaan");
}
