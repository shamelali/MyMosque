"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { senFromRinggit } from "@/lib/utils";

const BASE = "/portal/projek";

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
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

export async function createProject(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const title = text(formData, "title");
  if (!title) fail("Tajuk projek wajib diisi.");

  const budgetSen = senFromRinggit(text(formData, "budget"));
  if (!Number.isFinite(budgetSen) || budgetSen <= 0) fail("Anggaran kos projek tidak sah.");

  const startDate = parseDate(formData.get("startDate"));
  const endDate = parseDate(formData.get("endDate"));
  if (startDate && endDate && endDate < startDate) {
    fail("Tarikh siap tidak boleh sebelum tarikh mula.");
  }

  const project = await prisma.project.create({
    data: {
      mosqueId: user.mosqueId,
      title,
      description: text(formData, "description") || null,
      budgetSen,
      contractor: text(formData, "contractor") || null,
      startDate,
      endDate,
      status: "DICADANG",
    },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Project",
    entityId: project.id,
    mosqueId: user.mosqueId,
    after: { title, budgetSen, contractor: project.contractor, status: "DICADANG" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(BASE);
}

export async function approveProject(formData: FormData) {
  const user = await requirePageUser(["KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const project = await prisma.project.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!project) fail("Projek tidak dijumpai.");
  if (project.status !== "DICADANG") fail("Hanya projek bercadang boleh diluluskan.");

  await prisma.project.update({
    where: { id: project.id },
    data: { status: "DILULUSKAN", approvedBy: user.name ?? user.email ?? null },
  });
  await audit({
    actor: user,
    action: "APPROVE",
    entity: "Project",
    entityId: project.id,
    mosqueId: user.mosqueId,
    before: { status: project.status },
    after: { status: "DILULUSKAN" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(BASE);
}

export async function rejectProject(formData: FormData) {
  const user = await requirePageUser(["KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const project = await prisma.project.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!project) fail("Projek tidak dijumpai.");
  if (project.status !== "DICADANG") fail("Hanya projek bercadang boleh ditolak.");

  await prisma.project.update({ where: { id: project.id }, data: { status: "DITOLAK" } });
  await audit({
    actor: user,
    action: "REJECT",
    entity: "Project",
    entityId: project.id,
    mosqueId: user.mosqueId,
    before: { status: project.status },
    after: { status: "DITOLAK" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(BASE);
}

export async function addProjectExpense(formData: FormData) {
  const user = await requirePageUser(["KETUA", "SETIAUSAHA", "BENDAHARI"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = text(formData, "id");
  const description = text(formData, "description");
  const date = parseDate(formData.get("date"));
  const amountSen = senFromRinggit(text(formData, "amount"));

  if (!description) fail("Keterangan perbelanjaan wajib diisi.");
  if (!date) fail("Tarikh perbelanjaan tidak sah.");
  if (!Number.isFinite(amountSen) || amountSen <= 0) fail("Jumlah perbelanjaan tidak sah.");

  const project = await prisma.project.findFirst({ where: { id, mosqueId: user.mosqueId } });
  if (!project) fail("Projek tidak dijumpai.");
  if (project.status === "DITOLAK") fail("Perbelanjaan tidak boleh ditambah pada projek yang ditolak.");

  const expense = await prisma.$transaction(async (tx) => {
    const created = await tx.projectExpense.create({
      data: { projectId: project.id, date, description, amountSen },
    });
    await tx.project.update({
      where: { id: project.id },
      data: { spentSen: { increment: amountSen } },
    });
    return created;
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "ProjectExpense",
    entityId: expense.id,
    mosqueId: user.mosqueId,
    after: { projectId: project.id, description, amountSen, date },
  });
  await audit({
    actor: user,
    action: "UPDATE",
    entity: "Project",
    entityId: project.id,
    mosqueId: user.mosqueId,
    before: { spentSen: project.spentSen },
    after: { spentSen: project.spentSen + amountSen },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(BASE);
}
