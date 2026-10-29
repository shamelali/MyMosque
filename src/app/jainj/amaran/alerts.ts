import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { bulanTahun, tarikh } from "@/lib/utils";

// Derived monitoring alerts. This module is read-only: it inspects operational
// data and returns alerts for display. Nothing is written to the database.

export type AlertSeverity = "TINGGI" | "SEDERHANA" | "RENDAH";

export type AlertCategory =
  | "LAPORAN"
  | "SKOR"
  | "SELENGGARAAN"
  | "TAULIAH"
  | "QURBAN"
  | "KEMPEN";

export type MonitoringAlert = {
  id: string;
  severity: AlertSeverity;
  category: AlertCategory;
  title: string;
  description: string;
  mosqueId?: string;
  mosqueName?: string;
  href: string;
};

const DAY = 86_400_000;

function monthKey(month: number, year: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function buildAlerts(): Promise<MonitoringAlert[]> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const soon = new Date(now.getTime() + 60 * DAY);
  const stale = new Date(now.getTime() - 14 * DAY);

  const [mosques, reports, scores, staleRequests, expiringSpeakers, qurbanPending, staleCampaigns] =
    await Promise.all([
      prisma.mosque.findMany({
        where: { status: { in: ["AKTIF", "PROJEK"] } },
        select: { id: true, name: true, district: true, code: true },
        orderBy: { name: "asc" },
      }),
      prisma.monthlyReport.findMany({
        where: { month, year },
        select: { mosqueId: true, status: true },
      }),
      prisma.scoreSnapshot.findMany({
        orderBy: [{ year: "desc" }, { month: "desc" }],
        select: { mosqueId: true, total: true, month: true, year: true },
      }),
      prisma.maintenanceRequest.findMany({
        where: { status: { notIn: ["SELESAI", "DITOLAK"] }, createdAt: { lt: stale } },
        select: { id: true, mosqueId: true, title: true, priority: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      prisma.speaker.findMany({
        where: { tauliahExpiry: { not: null, lte: soon } },
        select: { id: true, name: true, tauliahNo: true, tauliahExpiry: true, district: true },
        orderBy: { tauliahExpiry: "asc" },
      }),
      prisma.qurbanProgram.findMany({
        where: { year, permissionStatus: "MENUNGGU" },
        select: { id: true, mosqueId: true, animal: true },
      }),
      prisma.campaign.findMany({
        where: { status: "AKTIF", endDate: { lt: now } },
        select: { id: true, mosqueId: true, title: true, endDate: true },
        orderBy: { endDate: "asc" },
      }),
    ]);

  const mosqueById = new Map(mosques.map((m) => [m.id, m]));
  const reportByMosque = new Map(reports.map((r) => [r.mosqueId, r]));
  const latestScoreByMosque = new Map<string, (typeof scores)[number]>();
  for (const score of scores) {
    if (!latestScoreByMosque.has(score.mosqueId)) latestScoreByMosque.set(score.mosqueId, score);
  }

  const alerts: MonitoringAlert[] = [];

  // 1. Laporan bulanan belum dihantar / masih draf.
  for (const mosque of mosques) {
    const report = reportByMosque.get(mosque.id);
    if (!report) {
      alerts.push({
        id: `laporan-${mosque.id}`,
        severity: "TINGGI",
        category: "LAPORAN",
        title: "Laporan bulanan belum disediakan",
        description: `Tiada laporan bagi ${bulanTahun(month, year)}. Pihak masjid belum menyerahkan laporan kewangan untuk semakan.`,
        mosqueId: mosque.id,
        mosqueName: mosque.name,
        href: `/jainj/laporan?bulan=${monthKey(month, year)}&masjid=${mosque.id}`,
      });
    } else if (report.status === "DRAF") {
      alerts.push({
        id: `laporan-${mosque.id}`,
        severity: "TINGGI",
        category: "LAPORAN",
        title: "Laporan bulanan masih draf",
        description: `Laporan ${bulanTahun(month, year)} belum dihantar untuk semakan JAINJ dan masih berstatus draf.`,
        mosqueId: mosque.id,
        mosqueName: mosque.name,
        href: `/jainj/laporan?bulan=${monthKey(month, year)}&masjid=${mosque.id}`,
      });
    }
  }

  // 2. Skor prestasi terkini di bawah ambang pematuhan.
  for (const mosque of mosques) {
    const score = latestScoreByMosque.get(mosque.id);
    if (score && score.total < 70) {
      alerts.push({
        id: `skor-${mosque.id}`,
        severity: "SEDERHANA",
        category: "SKOR",
        title: `Skor prestasi rendah (${score.total}/100)`,
        description: `Skor ${bulanTahun(score.month, score.year)} berada di bawah ambang pematuhan 70. Semakan tadbir urus diperlukan.`,
        mosqueId: mosque.id,
        mosqueName: mosque.name,
        href: `/jainj/skor?bulan=${monthKey(score.month, score.year)}`,
      });
    }
  }

  // 3. Aduan selenggaraan terbuka melebihi 14 hari.
  for (const request of staleRequests) {
    const mosque = mosqueById.get(request.mosqueId);
    const age = Math.max(1, Math.floor((now.getTime() - request.createdAt.getTime()) / DAY));
    alerts.push({
      id: `selenggara-${request.id}`,
      severity: request.priority === "TINGGI" ? "TINGGI" : "SEDERHANA",
      category: "SELENGGARAAN",
      title: `Aduan selenggaraan melebihi ${age} hari`,
      description: `"${request.title}" masih terbuka dengan keutamaan ${label(request.priority)}. Tindakan susulan diperlukan.`,
      mosqueId: mosque?.id,
      mosqueName: mosque?.name,
      href: `/jainj/masjid/${request.mosqueId}#selenggaraan`,
    });
  }

  // 4. Tauliah penceramah hampir tamat atau telah tamat.
  for (const speaker of expiringSpeakers) {
    if (!speaker.tauliahExpiry) continue;
    const expired = speaker.tauliahExpiry.getTime() < now.getTime();
    alerts.push({
      id: `tauliah-${speaker.id}`,
      severity: expired ? "TINGGI" : "SEDERHANA",
      category: "TAULIAH",
      title: expired
        ? `Tauliah ${speaker.name} telah tamat tempoh`
        : `Tauliah ${speaker.name} akan tamat dalam 60 hari`,
      description: `No. tauliah ${speaker.tauliahNo} · ${speaker.district ?? "Daerah tiada"} · tamat ${tarikh(speaker.tauliahExpiry)}.`,
      href: `/jainj/tauliah?q=${encodeURIComponent(speaker.tauliahNo)}`,
    });
  }

  // 5. Kebenaran qurban tahun semasa masih menunggu kelulusan.
  for (const program of qurbanPending) {
    const mosque = mosqueById.get(program.mosqueId);
    alerts.push({
      id: `qurban-${program.id}`,
      severity: "SEDERHANA",
      category: "QURBAN",
      title: `Kebenaran qurban ${year} belum diluluskan`,
      description: `Program qurban ${label(program.animal)} masih menunggu kebenaran JAINJ sebelum pemasaran dibuka.`,
      mosqueId: mosque?.id,
      mosqueName: mosque?.name,
      href: `/jainj/masjid/${program.mosqueId}`,
    });
  }

  // 6. Kempen derma melepasi tarikh tamat tetapi masih aktif.
  for (const campaign of staleCampaigns) {
    const mosque = mosqueById.get(campaign.mosqueId);
    alerts.push({
      id: `kempen-${campaign.id}`,
      severity: "RENDAH",
      category: "KEMPEN",
      title: `Kempen "${campaign.title}" melepasi tarikh tamat`,
      description: `Tarikh tamat ${tarikh(campaign.endDate)} telah berlalu tetapi status kempen masih aktif.`,
      mosqueId: mosque?.id,
      mosqueName: mosque?.name,
      href: `/jainj/masjid/${campaign.mosqueId}`,
    });
  }

  return alerts;
}
