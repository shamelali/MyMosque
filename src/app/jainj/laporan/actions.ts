"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const BASE = "/jainj/laporan";

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

function reviewerName(user: { name?: string | null; email?: string | null }) {
  return `${user.name ?? user.email ?? "Pegawai JAINJ"} (JAINJ)`;
}

export async function approveReport(formData: FormData) {
  const user = await requirePageUser(["JAINJ"]);
  const id = String(formData.get("id") ?? "").trim();
  if (!id) fail("Laporan tidak sah.");

  const report = await prisma.monthlyReport.findUnique({ where: { id } });
  if (!report) fail("Laporan tidak dijumpai.");
  if (report.status !== "DIHANTAR") {
    fail("Hanya laporan berstatus dihantar boleh diluluskan.");
  }

  const updated = await prisma.monthlyReport.update({
    where: { id: report.id },
    data: {
      status: "DILULUSKAN",
      reviewedAt: new Date(),
      reviewerName: reviewerName(user),
    },
  });

  await audit({
    actor: user,
    action: "APPROVE",
    entity: "MonthlyReport",
    entityId: report.id,
    mosqueId: report.mosqueId,
    before: { status: report.status, notes: report.notes },
    after: {
      status: updated.status,
      reviewedAt: updated.reviewedAt,
      reviewerName: updated.reviewerName,
    },
  });

  revalidatePath(BASE);
  revalidatePath("/jainj");
  revalidatePath("/jainj/amaran");
  redirect(`${BASE}?selesai=lulus`);
}

export async function rejectReport(formData: FormData) {
  const user = await requirePageUser(["JAINJ"]);
  const id = String(formData.get("id") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  if (!id) fail("Laporan tidak sah.");
  if (!notes) fail("Sebab penolakan wajib dinyatakan.");

  const report = await prisma.monthlyReport.findUnique({ where: { id } });
  if (!report) fail("Laporan tidak dijumpai.");
  if (report.status !== "DIHANTAR") {
    fail("Hanya laporan berstatus dihantar boleh ditolak.");
  }

  const updated = await prisma.monthlyReport.update({
    where: { id: report.id },
    data: {
      status: "DITOLAK",
      notes,
      reviewedAt: new Date(),
      reviewerName: reviewerName(user),
    },
  });

  await audit({
    actor: user,
    action: "REJECT",
    entity: "MonthlyReport",
    entityId: report.id,
    mosqueId: report.mosqueId,
    before: { status: report.status, notes: report.notes },
    after: {
      status: updated.status,
      notes: updated.notes,
      reviewedAt: updated.reviewedAt,
      reviewerName: updated.reviewerName,
    },
  });

  revalidatePath(BASE);
  revalidatePath("/jainj");
  revalidatePath("/jainj/amaran");
  redirect(`${BASE}?selesai=tolak`);
}
