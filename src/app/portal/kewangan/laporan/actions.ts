"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";

const BASE = "/portal/kewangan/laporan";

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

export async function generateReport(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const month = Number(formData.get("month"));
  const year = Number(formData.get("year"));
  if (!Number.isInteger(month) || month < 1 || month > 12) fail("Bulan laporan tidak sah.");
  if (!Number.isInteger(year) || year < 2000 || year > 2100) fail("Tahun laporan tidak sah.");

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  const totals = await prisma.ledgerEntry.groupBy({
    by: ["type"],
    where: { mosqueId: user.mosqueId, status: "POSTED", date: { gte: start, lt: end } },
    _sum: { amountSen: true },
  });
  const totalInSen = totals.find((t) => t.type === "MASUK")?._sum.amountSen ?? 0;
  const totalOutSen = totals.find((t) => t.type === "KELUAR")?._sum.amountSen ?? 0;

  const existing = await prisma.monthlyReport.findUnique({
    where: { mosqueId_month_year: { mosqueId: user.mosqueId, month, year } },
  });
  if (existing && existing.status !== "DRAF") {
    fail("Laporan bulan ini telah dihantar atau disemak dan tidak boleh dijana semula.");
  }

  const report = existing
    ? await prisma.monthlyReport.update({
        where: { id: existing.id },
        data: { totalInSen, totalOutSen },
      })
    : await prisma.monthlyReport.create({
        data: {
          mosqueId: user.mosqueId,
          month,
          year,
          status: "DRAF",
          totalInSen,
          totalOutSen,
        },
      });

  await audit({
    actor: user,
    action: existing ? "UPDATE" : "CREATE",
    entity: "MonthlyReport",
    entityId: report.id,
    mosqueId: user.mosqueId,
    before: existing ? { totalInSen: existing.totalInSen, totalOutSen: existing.totalOutSen } : undefined,
    after: { month, year, totalInSen, totalOutSen, status: "DRAF" },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(BASE);
}

export async function submitReport(formData: FormData) {
  const user = await requirePageUser(["BENDAHARI", "KETUA"]);
  if (!user.mosqueId) fail("Akaun anda belum dikaitkan dengan masjid.");

  const id = String(formData.get("id") ?? "").trim();
  const report = await prisma.monthlyReport.findFirst({
    where: { id, mosqueId: user.mosqueId },
  });
  if (!report) fail("Laporan tidak dijumpai.");
  if (report.status !== "DRAF") fail("Hanya laporan berstatus draf boleh dihantar untuk semakan.");

  const updated = await prisma.monthlyReport.update({
    where: { id: report.id },
    data: { status: "DIHANTAR", submittedAt: new Date() },
  });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "MonthlyReport",
    entityId: report.id,
    mosqueId: user.mosqueId,
    before: { status: report.status },
    after: { status: updated.status, submittedAt: updated.submittedAt },
  });

  revalidatePath(BASE);
  revalidatePath("/portal");
  redirect(BASE);
}
