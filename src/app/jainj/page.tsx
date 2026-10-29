import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  BellRing,
  Building2,
  Calculator,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  HandCoins,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, Stat, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { computeAllScores } from "@/lib/scoring";
import { syncJainjMasterData } from "@/lib/integrations";
import { label } from "@/lib/labels";
import { bulanTahun, rm, tarikhMasa } from "@/lib/utils";
import { buildAlerts } from "./amaran/alerts";

export const metadata: Metadata = { title: "Papan Pemuka JAINJ" };

const INTEGRATION_NAMES: Record<string, string> = {
  jainj: "Data Induk JAINJ",
  tpmj: "TPMJ",
  messaging: "Penyedia Mesej",
  gateway: "Gerbang Bayaran",
};

async function runScoringAction() {
  "use server";
  const user = await requirePageUser(["JAINJ"]);
  const results = await computeAllScores(0);
  await audit({
    actor: user,
    action: "SYNC",
    entity: "ScoreSnapshot",
    after: { skop: "bulan semasa", count: results.length },
  });
  revalidatePath("/jainj");
  revalidatePath("/jainj/skor");
  redirect("/jainj?selesai=skor");
}

async function syncJainjAction() {
  "use server";
  const user = await requirePageUser(["JAINJ"]);
  const run = await syncJainjMasterData();
  await audit({
    actor: user,
    action: "SYNC",
    entity: "SyncRun",
    entityId: run.id,
    after: { integration: run.integration, status: run.status, records: run.records },
  });
  revalidatePath("/jainj");
  revalidatePath("/system/ops");
  redirect(`/jainj?selesai=${run.status === "BERJAYA" ? "sync" : "sync-gagal"}`);
}

type AttentionRow = {
  id: string;
  code: string;
  name: string;
  district: string;
  score: number | null;
  reasons: string[];
  severity: "TINGGI" | "SEDERHANA";
};

export default async function JainjDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ selesai?: string }>;
}) {
  const user = await requirePageUser();
  const { selesai } = await searchParams;

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month, 1);

  const [mosques, awaitingReports, syncRuns, alerts] = await Promise.all([
    prisma.mosque.findMany({
      where: { status: { in: ["AKTIF", "PROJEK"] } },
      select: {
        id: true,
        code: true,
        name: true,
        district: true,
        status: true,
        scores: { where: { month, year }, select: { total: true, computedAt: true } },
        reports: { where: { month, year }, select: { id: true, status: true } },
        maintReqs: {
          where: { status: { notIn: ["SELESAI", "DITOLAK"] } },
          select: { id: true, priority: true },
        },
        donations: {
          where: { status: "DIBAYAR", paidAt: { gte: monthStart, lt: nextMonth } },
          select: { amountSen: true },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.monthlyReport.count({ where: { status: "DIHANTAR" } }),
    prisma.syncRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 5,
      include: { mosque: { select: { name: true } } },
    }),
    buildAlerts(),
  ]);

  const scoredValues = mosques.flatMap((m) => m.scores.map((s) => s.total));
  const averageScore = scoredValues.length
    ? Math.round(scoredValues.reduce((sum, value) => sum + value, 0) / scoredValues.length)
    : null;
  const highPriorityOpen = mosques.reduce(
    (sum, m) => sum + m.maintReqs.filter((r) => r.priority === "TINGGI").length,
    0,
  );
  const donationRows = mosques.flatMap((m) => m.donations);
  const donationTotal = donationRows.reduce((sum, d) => sum + d.amountSen, 0);

  type DistrictRow = {
    district: string;
    mosqueCount: number;
    scoreSum: number;
    scored: number;
    raised: number;
    openMaintenance: number;
  };
  const districtMap = new Map<string, DistrictRow>();
  for (const mosque of mosques) {
    const row = districtMap.get(mosque.district) ?? {
      district: mosque.district,
      mosqueCount: 0,
      scoreSum: 0,
      scored: 0,
      raised: 0,
      openMaintenance: 0,
    };
    row.mosqueCount += 1;
    if (mosque.scores[0]) {
      row.scoreSum += mosque.scores[0].total;
      row.scored += 1;
    }
    row.raised += mosque.donations.reduce((sum, d) => sum + d.amountSen, 0);
    row.openMaintenance += mosque.maintReqs.length;
    districtMap.set(mosque.district, row);
  }
  const districts = [...districtMap.values()].sort(
    (a, b) => b.mosqueCount - a.mosqueCount || a.district.localeCompare(b.district),
  );

  const attention: AttentionRow[] = [];
  for (const mosque of mosques) {
    const score = mosque.scores[0]?.total ?? null;
    const report = mosque.reports[0];
    const highOpen = mosque.maintReqs.filter((r) => r.priority === "TINGGI").length;
    const reasons: string[] = [];
    let severity: "TINGGI" | "SEDERHANA" | null = null;

    if (!report) {
      reasons.push("Laporan bulan ini belum disediakan");
      severity = "TINGGI";
    } else if (report.status === "DRAF") {
      reasons.push("Laporan bulan ini masih draf");
      severity = "TINGGI";
    }
    if (score === null) {
      reasons.push("Skor bulan ini belum dikira");
      severity ??= "SEDERHANA";
    } else if (score < 70) {
      reasons.push(`Skor ${score}/100 di bawah ambang 70`);
      severity ??= "SEDERHANA";
    }
    if (highOpen > 0) {
      reasons.push(`${highOpen} aduan keutamaan tinggi belum selesai`);
      severity = "TINGGI";
    }
    if (severity) {
      attention.push({
        id: mosque.id,
        code: mosque.code,
        name: mosque.name,
        district: mosque.district,
        score,
        reasons,
        severity,
      });
    }
  }
  attention.sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "TINGGI" ? -1 : 1;
    return (a.score ?? 101) - (b.score ?? 101);
  });

  return (
    <div className="mobile-pad">
      <PageHeader
        eyebrow="Pemantauan negeri · Johor"
        title="Papan Pemuka JAINJ"
        description={`Ringkasan pematuhan, kewangan dan operasi masjid bagi ${bulanTahun(month, year)}.`}
        actions={
          <>
            <Link href="/jainj/laporan?status=DIHANTAR" className="btn-secondary">
              <ClipboardList className="h-4 w-4" /> Semak laporan
            </Link>
            <Link href="/jainj/amaran" className="btn-primary">
              <BellRing className="h-4 w-4" /> Amaran ({alerts.length})
            </Link>
          </>
        }
      />

      {selesai && (
        <p
          className={
            selesai === "sync-gagal"
              ? "mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15"
              : "mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15"
          }
        >
          {selesai === "skor"
            ? "Skor prestasi bulan semasa telah dikira semula untuk semua masjid."
            : selesai === "sync"
              ? "Penyegerakan data induk JAINJ selesai. Rekod SyncRun telah dikemas kini."
              : selesai === "sync-gagal"
                ? "Penyegerakan data induk JAINJ gagal. Sila semak log di Konsol Operasi."
                : "Tindakan telah direkodkan."}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Masjid dipantau"
          value={mosques.length}
          hint="Status aktif dan dalam projek"
          icon={Building2}
        />
        <Stat
          label="Skor purata bulan ini"
          value={averageScore === null ? "—" : `${averageScore}/100`}
          hint={`${scoredValues.length} daripada ${mosques.length} masjid telah dinilai`}
          icon={Trophy}
        />
        <Stat
          label="Laporan menunggu semakan"
          value={awaitingReports}
          hint="Berstatus dihantar di seluruh negeri"
          icon={ClipboardList}
        />
        <Stat
          label="Aduan keutamaan tinggi"
          value={highPriorityOpen}
          hint="Masih terbuka atau dalam proses"
          icon={Wrench}
        />
        <Stat
          label="Derma bulan ini"
          value={rm(donationTotal)}
          hint={`${donationRows.length} transaksi derma dibayar`}
          icon={HandCoins}
        />
        <Stat
          label="Amaran aktif"
          value={alerts.length}
          hint={`${alerts.filter((a) => a.severity === "TINGGI").length} berkeutamaan tinggi`}
          icon={CircleAlert}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader
            title="Prestasi mengikut daerah"
            description="Purata skor, kutipan derma dan aduan terbuka bulan semasa."
            action={
              <Link href="/jainj/masjid" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
                Senarai masjid
              </Link>
            }
          />
          {districts.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Tiada masjid dipantau"
              description="Daftar masjid melalui portal masjid untuk mula pemantauan."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Daerah</th>
                    <th className="text-center">Masjid</th>
                    <th className="text-center">Skor purata</th>
                    <th className="text-right">Kutipan</th>
                    <th className="text-center">Aduan</th>
                    <th className="w-32">Prestasi</th>
                  </tr>
                </thead>
                <tbody>
                  {districts.map((district) => {
                    const average = district.scored
                      ? Math.round(district.scoreSum / district.scored)
                      : null;
                    return (
                      <tr key={district.district}>
                        <td>
                          <Link
                            href={`/jainj/masjid?daerah=${encodeURIComponent(district.district)}`}
                            className="font-medium text-brand-950 hover:text-brand-700"
                          >
                            {district.district}
                          </Link>
                        </td>
                        <td className="text-center text-xs">{district.mosqueCount}</td>
                        <td className="text-center text-xs font-semibold">
                          {average === null ? "—" : `${average}/100`}
                        </td>
                        <td className="whitespace-nowrap text-right text-xs font-medium">{rm(district.raised)}</td>
                        <td className="text-center text-xs">
                          {district.openMaintenance > 0 ? (
                            <span className="font-semibold text-amber-700">{district.openMaintenance}</span>
                          ) : (
                            <span className="text-brand-900/40">0</span>
                          )}
                        </td>
                        <td>
                          <Progress
                            value={average ?? 0}
                            tone={average === null ? "brand" : average >= 80 ? "brand" : average >= 70 ? "gold" : "danger"}
                            className="h-1.5"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader
            title="Masjid memerlukan perhatian"
            description="Skor rendah, aduan keutamaan tinggi atau laporan belum lengkap."
            action={
              <Link href="/jainj/amaran" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
                Semua amaran
              </Link>
            }
          />
          {attention.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="Tiada isu pematuhan"
              description="Semua masjid memenuhi kriteria pemantauan bulan semasa."
            />
          ) : (
            <ul className="divide-y divide-brand-900/5">
              {attention.map((mosque) => (
                <li key={mosque.id}>
                  <Link
                    href={`/jainj/masjid/${mosque.id}`}
                    className="group flex items-start gap-3 px-5 py-4 transition hover:bg-brand-50/50"
                  >
                    <span
                      className={
                        mosque.severity === "TINGGI"
                          ? "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-red-50 text-red-600 ring-1 ring-inset ring-red-600/15"
                          : "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15"
                      }
                    >
                      <CircleAlert className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-brand-950">{mosque.name}</span>
                        <Badge tone={mosque.severity === "TINGGI" ? "danger" : "warning"}>
                          {mosque.severity === "TINGGI" ? "Tinggi" : "Sederhana"}
                        </Badge>
                        {mosque.score !== null && (
                          <span className="text-[11px] font-semibold text-brand-900/50">
                            Skor {mosque.score}
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-brand-900/45">
                        {mosque.district} · {mosque.code}
                      </span>
                      <span className="mt-1.5 block space-y-0.5">
                        {mosque.reasons.map((reason) => (
                          <span key={reason} className="block text-[11px] leading-relaxed text-brand-900/65">
                            • {reason}
                          </span>
                        ))}
                      </span>
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-brand-900/25 transition group-hover:text-brand-700" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.55fr)]">
        <Card className="self-start">
          <CardHeader
            title="Tindakan pantas"
            description="Operasi pematuhan peringkat negeri untuk pegawai JAINJ."
          />
          <div className="space-y-4 p-5">
            {user.role === "JAINJ" ? (
              <>
                <form action={runScoringAction}>
                  <button type="submit" className="btn-primary w-full justify-start">
                    <Calculator className="h-4 w-4" /> Kira skor bulan ini
                  </button>
                </form>
                <p className="text-[11px] leading-relaxed text-brand-900/50">
                  Mengira semula skor kewangan, pendaftaran, selenggaraan dan program bagi semua masjid
                  bagi {bulanTahun(month, year)}.
                </p>
                <form action={syncJainjAction}>
                  <button type="submit" className="btn-secondary w-full justify-start">
                    <RefreshCw className="h-4 w-4" /> Segerak data induk JAINJ
                  </button>
                </form>
                <p className="text-[11px] leading-relaxed text-brand-900/50">
                  Menyelaraskan profil masjid dan status tauliah penceramah dengan pangkalan data JAINJ.
                </p>
              </>
            ) : (
              <div className="rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
                Anda log masuk sebagai auditor. Semua halaman pemantauan boleh dilihat, tetapi tindakan
                pengiraan dan penyegerakan hanya tersedia untuk pegawai JAINJ.
              </div>
            )}
            <div className="border-t border-brand-900/5 pt-3">
              <Link
                href="/jainj/audit"
                className="flex items-center justify-between text-xs font-semibold text-brand-700 hover:text-brand-900"
              >
                Lihat jejak audit <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </Card>

        <Card className="self-start">
          <CardHeader
            title="Penyegerakan terkini"
            description="Lima rekod SyncRun terbaharu merentas integrasi platform."
            action={
              <Link href="/system/ops" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
                Konsol operasi
              </Link>
            }
          />
          {syncRuns.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title="Belum ada penyegerakan"
              description="Jalankan penyegerakan data induk untuk mula merekod sejarah integrasi."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Masa</th>
                    <th>Integrasi</th>
                    <th>Arah</th>
                    <th className="text-right">Rekod</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {syncRuns.map((run) => (
                    <tr key={run.id}>
                      <td className="whitespace-nowrap text-xs text-brand-900/60">
                        {tarikhMasa(run.startedAt)}
                      </td>
                      <td>
                        <p className="text-xs font-medium text-brand-950">
                          {INTEGRATION_NAMES[run.integration] ?? run.integration}
                        </p>
                        {run.mosque && (
                          <p className="text-[10px] text-brand-900/40">{run.mosque.name}</p>
                        )}
                      </td>
                      <td className="text-xs">{label(run.direction)}</td>
                      <td className="text-right text-xs font-medium">{run.records}</td>
                      <td>
                        <StatusBadge value={run.status} />
                      </td>
                      <td className="text-right">
                        <Link
                          href="/system/ops"
                          className="whitespace-nowrap text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                        >
                          Butiran
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <SectionTitle>Nota pematuhan</SectionTitle>
        <div className="rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
          Skor prestasi dijana daripada data lejar, pendaftaran AJK, selenggaraan dan program masjid.
          Semua tindakan pengiraan dan penyegerakan direkodkan dalam jejak audit untuk tujuan
          pengawasan dan pematuhan.
        </div>
      </div>
    </div>
  );
}
