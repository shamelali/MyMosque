import type { Metadata } from "next";
import Link from "next/link";
import {
  Calculator,
  ChevronRight,
  Minus,
  TrendingDown,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { parseBreakdown, type ScoreBreakdown } from "@/lib/scoring";
import { bulanTahun, tarikhMasa } from "@/lib/utils";
import { recalculateScores } from "./actions";

export const metadata: Metadata = { title: "Skor Prestasi" };

const BREAKDOWN_PARTS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "kewangan", label: "Kewangan" },
  { key: "pendaftaran", label: "Pendaftaran" },
  { key: "selenggaraan", label: "Selenggaraan" },
  { key: "program", label: "Program" },
];

function scoreTone(value: number) {
  return value >= 80 ? "brand" : value >= 70 ? "gold" : "danger";
}

function scoreBadgeTone(value: number) {
  return value >= 80 ? "success" : value >= 70 ? "warning" : "danger";
}

function ScoreBar({ value }: { value: number | null }) {
  return (
    <div className="w-20">
      <p className="text-xs font-medium text-brand-950">{value === null ? "—" : value}</p>
      <Progress
        value={value ?? 0}
        tone={value === null ? "brand" : scoreTone(value)}
        className="mt-1 h-1"
      />
    </div>
  );
}

export default async function SkorPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; selesai?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.bulan ?? "") ? params.bulan! : currentKey;
  const [year, month] = key.split("-").map(Number);

  const anchor = new Date(year, month - 1, 1);
  const trendMonths = [-2, -1, 0].map((offset) => {
    const date = new Date(anchor.getFullYear(), anchor.getMonth() + offset, 1);
    return {
      month: date.getMonth() + 1,
      year: date.getFullYear(),
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`,
    };
  });

  const [mosques, trendScores] = await Promise.all([
    prisma.mosque.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        district: true,
        status: true,
        scores: {
          where: { month, year },
          select: {
            total: true,
            financeScore: true,
            registryScore: true,
            maintenanceScore: true,
            programScore: true,
            breakdown: true,
            computedAt: true,
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.scoreSnapshot.findMany({
      where: {
        OR: trendMonths.map((item) => ({ month: item.month, year: item.year })),
      },
      select: { mosqueId: true, month: true, year: true, total: true },
    }),
  ]);

  const rows = mosques
    .map((mosque) => ({ ...mosque, score: mosque.scores[0] ?? null }))
    .sort((a, b) => (b.score?.total ?? -1) - (a.score?.total ?? -1));

  const scored = rows.filter((row) => row.score);
  const average = scored.length
    ? Math.round(scored.reduce((sum, row) => sum + (row.score?.total ?? 0), 0) / scored.length)
    : null;
  const highest = scored.length ? Math.max(...scored.map((row) => row.score!.total)) : null;
  const lowest = scored.length ? Math.min(...scored.map((row) => row.score!.total)) : null;

  const trendMap = new Map<string, Map<string, number>>();
  for (const snapshot of trendScores) {
    const snapshotKey = `${snapshot.year}-${String(snapshot.month).padStart(2, "0")}`;
    const byMonth = trendMap.get(snapshot.mosqueId) ?? new Map<string, number>();
    byMonth.set(snapshotKey, snapshot.total);
    trendMap.set(snapshot.mosqueId, byMonth);
  }

  const topRow = rows.find((row) => row.score) ?? null;
  const breakdown = topRow?.score ? parseBreakdown(topRow.score.breakdown) : null;

  return (
    <div className="mobile-pad">
      <PageHeader
        eyebrow="Pemantauan"
        title="Skor Prestasi Masjid"
        description="Penilaian pematuhan bulanan merangkumi kewangan, pendaftaran, selenggaraan dan program."
        actions={
          user.role === "JAINJ" ? (
            <form action={recalculateScores}>
              <input type="hidden" name="bulan" value={key} />
              <button type="submit" className="btn-primary">
                <Calculator className="h-4 w-4" /> Kira semula skor
              </button>
            </form>
          ) : (
            <span className="rounded-full bg-brand-900/5 px-3 py-1.5 text-[11px] font-semibold text-brand-900/60">
              Akses baca sahaja
            </span>
          )
        }
      />

      {params.selesai && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
          Skor bulan semasa telah dikira semula. Semua rekod ScoreSnapshot dikemas kini.
        </p>
      )}

      <Card className="mb-6">
        <form action="/jainj/skor" className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <label className="label" htmlFor="bulan">
              Bulan penilaian
            </label>
            <input
              id="bulan"
              type="month"
              name="bulan"
              defaultValue={key}
              className="input w-auto"
            />
          </div>
          <button type="submit" className="btn-secondary">
            Papar bulan dipilih
          </button>
          <p className="w-full text-[11px] leading-relaxed text-brand-900/45">
            Senarai disusun mengikut jumlah skor tertinggi. Tindakan kira semula sentiasa menggunakan
            bulan semasa dan direkodkan dalam jejak audit.
          </p>
        </form>
      </Card>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Skor purata" value={average === null ? "—" : `${average}/100`} hint={bulanTahun(month, year)} icon={Trophy} />
        <Stat label="Skor tertinggi" value={highest === null ? "—" : `${highest}/100`} hint="Prestasi terbaik negeri" />
        <Stat label="Skor terendah" value={lowest === null ? "—" : `${lowest}/100`} hint="Memerlukan perhatian" />
        <Stat
          label="Snapshot dikira"
          value={`${scored.length}/${rows.length}`}
          hint={scored.length === rows.length ? "Semua masjid telah dinilai" : "Masih ada masjid belum dinilai"}
        />
      </div>

      <Card>
        <CardHeader
          title="Kedudukan skor masjid"
          description={`Penilaian bagi ${bulanTahun(month, year)}.`}
        />
        {rows.length === 0 ? (
          <EmptyState
            icon={Trophy}
            title="Tiada masjid untuk dinilai"
            description="Daftar masjid terlebih dahulu sebelum pengiraan skor dijalankan."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th className="w-8">#</th>
                  <th>Masjid</th>
                  <th className="text-center">Jumlah</th>
                  <th>Kewangan</th>
                  <th>Pendaftaran</th>
                  <th>Selenggaraan</th>
                  <th>Program</th>
                  <th>Dikira</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id}>
                    <td className="text-xs font-semibold text-brand-900/40">{index + 1}</td>
                    <td>
                      <Link
                        href={`/jainj/masjid/${row.id}`}
                        className="font-medium text-brand-950 hover:text-brand-700"
                      >
                        {row.name}
                      </Link>
                      <p className="text-[11px] text-brand-900/45">
                        {row.district} · {row.code}
                      </p>
                    </td>
                    <td>
                      {row.score ? (
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <span className="text-sm font-semibold text-brand-950">{row.score.total}</span>
                          <Badge tone={scoreBadgeTone(row.score.total)}>/100</Badge>
                        </div>
                      ) : (
                        <span className="text-xs text-brand-900/40">Belum dikira</span>
                      )}
                    </td>
                    <td>
                      <ScoreBar value={row.score?.financeScore ?? null} />
                    </td>
                    <td>
                      <ScoreBar value={row.score?.registryScore ?? null} />
                    </td>
                    <td>
                      <ScoreBar value={row.score?.maintenanceScore ?? null} />
                    </td>
                    <td>
                      <ScoreBar value={row.score?.programScore ?? null} />
                    </td>
                    <td className="whitespace-nowrap text-[11px] text-brand-900/55">
                      {row.score ? tarikhMasa(row.score.computedAt) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Trend tiga bulan"
          description="Perbandingan jumlah skor bagi tiga bulan berakhir bulan dipilih."
          action={
            <div className="flex items-center gap-1.5 text-[10px] text-brand-900/45">
              <span className="h-2 w-2 rounded-sm bg-brand-600" /> skor bulanan
            </div>
          }
        />
        {rows.length === 0 ? (
          <EmptyState icon={Trophy} title="Tiada data trend" description="Tiada snapshot skor untuk dipaparkan." />
        ) : (
          <ul className="divide-y divide-brand-900/5">
            {rows.map((row) => {
              const series = trendMonths.map(
                (item) => trendMap.get(row.id)?.get(item.key) ?? null,
              );
              const known = series.filter((value): value is number => value !== null);
              const delta = known.length >= 2 ? known[known.length - 1] - known[known.length - 2] : null;
              return (
                <li key={row.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3.5">
                  <div className="min-w-[140px] flex-1">
                    <Link
                      href={`/jainj/masjid/${row.id}`}
                      className="text-xs font-semibold text-brand-950 hover:text-brand-700"
                    >
                      {row.name}
                    </Link>
                    <p className="text-[10px] text-brand-900/40">{row.district}</p>
                  </div>
                  <div className="flex items-end gap-1.5">
                    {series.map((value, index) => (
                      <div key={trendMonths[index].key} className="flex flex-col items-center gap-1">
                        <div className="flex h-9 items-end">
                          <div
                            className={value === null ? "w-3 rounded-t bg-brand-900/10" : "w-3 rounded-t bg-brand-600"}
                            style={{ height: `${value === null ? 3 : Math.max(4, Math.round(value * 0.36))}px` }}
                            title={`${bulanTahun(trendMonths[index].month, trendMonths[index].year)}: ${
                              value === null ? "tiada data" : `${value}/100`
                            }`}
                          />
                        </div>
                        <span className="text-[9px] text-brand-900/35">{trendMonths[index].month}</span>
                      </div>
                    ))}
                  </div>
                  <div className="hidden w-20 text-center text-[10px] text-brand-900/45 sm:block">
                    {series.map((value) => value ?? "–").join(" · ")}
                  </div>
                  <div className="flex w-14 items-center justify-end gap-1 text-[11px] font-semibold">
                    {delta === null ? (
                      <Minus className="h-3.5 w-3.5 text-brand-900/30" />
                    ) : delta > 0 ? (
                      <>
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                        <span className="text-emerald-700">+{delta}</span>
                      </>
                    ) : delta < 0 ? (
                      <>
                        <TrendingDown className="h-3.5 w-3.5 text-red-500" />
                        <span className="text-red-600">{delta}</span>
                      </>
                    ) : (
                      <>
                        <Minus className="h-3.5 w-3.5 text-brand-900/30" />
                        <span className="text-brand-900/45">0</span>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <div className="mt-6">
        <Card>
          <CardHeader
            title={topRow ? `Butiran skor: ${topRow.name}` : "Butiran skor"}
            description={
              topRow?.score
                ? `${bulanTahun(month, year)} · jumlah ${topRow.score.total}/100`
                : "Tiada snapshot skor bagi bulan dipilih."
            }
            action={
              topRow ? (
                <Link
                  href={`/jainj/masjid/${topRow.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-900"
                >
                  Profil masjid <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              ) : undefined
            }
          />
          {!breakdown ? (
            <EmptyState
              icon={Trophy}
              title="Butiran komponen belum tersedia"
              description="Jalankan pengiraan skor untuk bulan semasa atau pilih bulan yang mempunyai snapshot."
            />
          ) : (
            <div className="grid gap-4 p-5 sm:grid-cols-2">
              {BREAKDOWN_PARTS.map((part) => {
                const value = breakdown[part.key];
                return (
                  <div
                    key={part.key}
                    className="rounded-xl bg-sand/60 p-4 ring-1 ring-inset ring-brand-900/5"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-brand-900/55">
                        {part.label}
                      </p>
                      <span className="text-sm font-semibold text-brand-950">{value.skor}/100</span>
                    </div>
                    <Progress value={value.skor} tone={scoreTone(value.skor)} className="mt-2 h-1.5" />
                    <p className="mt-2 text-[11px] leading-relaxed text-brand-900/55">
                      Berat {value.berat}% · {value.nota}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
