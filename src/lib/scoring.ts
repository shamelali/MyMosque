import { prisma } from "@/lib/db";

// P01 scoring engine. Reads other services' data; writes only to the analytics
// store (ScoreSnapshot). A scoring bug can never corrupt financial records.

export type ScoreBreakdown = {
  kewangan: { skor: number; berat: number; nota: string };
  pendaftaran: { skor: number; berat: number; nota: string };
  selenggaraan: { skor: number; berat: number; nota: string };
  program: { skor: number; berat: number; nota: string };
};

const WEIGHTS = { finance: 30, registry: 20, maintenance: 25, program: 25 } as const;

function clamp(n: number) {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export async function computeScoreForMosque(mosqueId: string, month: number, year: number) {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);
  const ninetyDaysAgo = new Date(monthEnd.getTime() - 90 * 86_400_000);

  const [mosque, reports, officers, terms, meetings, requests, inspections, programs, attendance] =
    await Promise.all([
      prisma.mosque.findUniqueOrThrow({ where: { id: mosqueId } }),
      prisma.monthlyReport.findMany({ where: { mosqueId, year, month } }),
      prisma.officer.count({ where: { mosqueId, status: "AKTIF" } }),
      prisma.committeeTerm.count({ where: { mosqueId, status: "AKTIF" } }),
      prisma.meeting.count({ where: { mosqueId, date: { gte: ninetyDaysAgo } } }),
      prisma.maintenanceRequest.findMany({ where: { mosqueId, createdAt: { lt: monthEnd } } }),
      prisma.inspection.count({ where: { mosqueId, date: { gte: ninetyDaysAgo } } }),
      prisma.kuliahProgram.findMany({
        where: { mosqueId, date: { gte: monthStart, lt: monthEnd }, status: { in: ["SAH", "SELESAI"] } },
        select: { id: true },
      }),
      prisma.attendance.count({
        where: { program: { mosqueId, date: { gte: monthStart, lt: monthEnd } } },
      }),
    ]);

  const report = reports[0];
  const financeScore = clamp(
    (report ? (report.status === "DILULUSKAN" ? 70 : report.status === "DIHANTAR" ? 50 : 25) : 20) +
      (report && report.totalInSen + report.totalOutSen > 0 ? 30 : 0),
  );

  const profileFields = [mosque.address, mosque.phone, mosque.email, mosque.capacity].filter(Boolean).length;
  const registryScore = clamp(profileFields * 10 + (officers >= 5 ? 30 : officers * 6) + (terms > 0 ? 20 : 0) + (meetings > 0 ? 20 : 0));

  const total = requests.length;
  const done = requests.filter((r) => r.status === "SELESAI").length;
  const overdue = requests.filter((r) => r.status !== "SELESAI" && r.createdAt < new Date(monthEnd.getTime() - 14 * 86_400_000)).length;
  const maintenanceScore = clamp((total ? (done / total) * 60 : 60) + Math.min(25, inspections * 12) + (overdue === 0 ? 15 : 0));

  const programScore = clamp(Math.min(65, programs.length * 22) + Math.min(35, attendance * 2));

  const totalScore = clamp(
    financeScore * (WEIGHTS.finance / 100) +
      registryScore * (WEIGHTS.registry / 100) +
      maintenanceScore * (WEIGHTS.maintenance / 100) +
      programScore * (WEIGHTS.program / 100),
  );

  const breakdown: ScoreBreakdown = {
    kewangan: {
      skor: financeScore,
      berat: WEIGHTS.finance,
      nota: report
        ? `Laporan ${month}/${year}: ${report.status === "DILULUSKAN" ? "diluluskan" : report.status === "DIHANTAR" ? "menunggu semakan" : "masih draf"}`
        : "Laporan bulanan belum disediakan",
    },
    pendaftaran: {
      skor: registryScore,
      berat: WEIGHTS.registry,
      nota: `${officers} pegawai aktif, ${meetings} mesyuarat dalam 90 hari`,
    },
    selenggaraan: {
      skor: maintenanceScore,
      berat: WEIGHTS.maintenance,
      nota: `${done}/${total} aduan selesai, ${inspections} pemeriksaan, ${overdue} lewat`,
    },
    program: {
      skor: programScore,
      berat: WEIGHTS.program,
      nota: `${programs.length} program bulan ini, ${attendance} kehadiran direkod`,
    },
  };

  return prisma.scoreSnapshot.upsert({
    where: { mosqueId_year_month: { mosqueId, year, month } },
    create: {
      mosqueId,
      month,
      year,
      total: totalScore,
      financeScore,
      registryScore,
      maintenanceScore,
      programScore,
      breakdown: JSON.stringify(breakdown),
    },
    update: {
      total: totalScore,
      financeScore,
      registryScore,
      maintenanceScore,
      programScore,
      breakdown: JSON.stringify(breakdown),
      computedAt: new Date(),
    },
  });
}

export async function computeAllScores(monthsBack = 0) {
  const now = new Date();
  const target = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const month = target.getMonth() + 1;
  const year = target.getFullYear();
  const mosques = await prisma.mosque.findMany({ select: { id: true } });
  const results = [];
  for (const m of mosques) results.push(await computeScoreForMosque(m.id, month, year));
  return results;
}

export function parseBreakdown(json: string): ScoreBreakdown | null {
  try {
    return JSON.parse(json) as ScoreBreakdown;
  } catch {
    return null;
  }
}
