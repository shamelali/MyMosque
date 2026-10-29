import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  HandCoins,
  Mail,
  MapPin,
  Phone,
  Trophy,
  Users,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, Stat, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { parseBreakdown, type ScoreBreakdown } from "@/lib/scoring";
import { label } from "@/lib/labels";
import { bulanTahun, rm, tarikh, tarikhMasa } from "@/lib/utils";

export const metadata: Metadata = { title: "Butiran Masjid" };

const DAY = 86_400_000;

const BREAKDOWN_PARTS: { key: keyof ScoreBreakdown; label: string }[] = [
  { key: "kewangan", label: "Kewangan" },
  { key: "pendaftaran", label: "Pendaftaran" },
  { key: "selenggaraan", label: "Selenggaraan" },
  { key: "program", label: "Program" },
];

function scoreTone(score: number) {
  return score >= 80 ? "brand" : score >= 70 ? "gold" : "danger";
}

export default async function ButiranMasjidPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month, 1);

  const mosque = await prisma.mosque.findUnique({
    where: { id },
    include: {
      officers: { orderBy: { appointmentDate: "asc" } },
      scores: { where: { month, year }, take: 1 },
      reports: { where: { month, year }, take: 1 },
    },
  });
  if (!mosque) notFound();

  const [totals, recentEntries, maintenance, programCount, donationTotal] = await Promise.all([
    prisma.ledgerEntry.groupBy({
      by: ["type"],
      where: { mosqueId: id, status: "POSTED", date: { gte: monthStart, lt: nextMonth } },
      _sum: { amountSen: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { mosqueId: id, date: { gte: monthStart, lt: nextMonth } },
      orderBy: { date: "desc" },
      take: 8,
      include: { account: { select: { name: true } } },
    }),
    prisma.maintenanceRequest.findMany({
      where: { mosqueId: id, status: { notIn: ["SELESAI", "DITOLAK"] } },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    }),
    prisma.kuliahProgram.count({
      where: { mosqueId: id, date: { gte: monthStart, lt: nextMonth } },
    }),
    prisma.donation.aggregate({
      where: { mosqueId: id, status: "DIBAYAR" },
      _sum: { amountSen: true },
    }),
  ]);

  const totalIn = totals.find((t) => t.type === "MASUK")?._sum.amountSen ?? 0;
  const totalOut = totals.find((t) => t.type === "KELUAR")?._sum.amountSen ?? 0;
  const score = mosque.scores[0] ?? null;
  const breakdown = score ? parseBreakdown(score.breakdown) : null;
  const report = mosque.reports[0] ?? null;
  const openHigh = maintenance.filter((r) => r.priority === "TINGGI").length;

  return (
    <div className="mobile-pad">
      <PageHeader
        eyebrow={`${mosque.district} · ${mosque.code}`}
        title={mosque.name}
        description={`Profil pematuhan dan ringkasan operasi ${bulanTahun(month, year)}.`}
        back={{ href: "/jainj/masjid", label: "Kembali ke senarai masjid" }}
        actions={
          <Link href={`/jainj/skor?bulan=${year}-${String(month).padStart(2, "0")}`} className="btn-secondary">
            <Trophy className="h-4 w-4" /> Skor negeri
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Skor prestasi"
          value={score ? `${score.total}/100` : "—"}
          hint={score ? `Dikira ${tarikhMasa(score.computedAt)}` : "Belum dikira bagi bulan ini"}
          icon={Trophy}
        />
        <Stat
          label="Aduan terbuka"
          value={maintenance.length}
          hint={openHigh > 0 ? `${openHigh} keutamaan tinggi` : "Tiada keutamaan tinggi"}
          icon={Wrench}
        />
        <Stat
          label="Program bulan ini"
          value={programCount}
          hint="Kuliah, ceramah dan kelas Al-Quran"
          icon={BookOpen}
        />
        <Stat
          label="Jumlah derma dibayar"
          value={rm(donationTotal._sum.amountSen)}
          hint="Keseluruhan derma berstatus dibayar"
          icon={HandCoins}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader
            title="Profil masjid"
            description="Maklumat pendaftaran JAINJ dan hubungan rasmi."
            action={<StatusBadge value={mosque.status} />}
          />
          <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">Kod JAINJ</dt>
              <dd className="mt-0.5 font-mono text-xs text-brand-950">{mosque.code}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">Rujukan induk</dt>
              <dd className="mt-0.5 text-xs text-brand-950">{mosque.jainjRef ?? "Belum disegerakkan"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">Daerah</dt>
              <dd className="mt-0.5 text-xs text-brand-950">{mosque.district}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">Kapasiti</dt>
              <dd className="mt-0.5 text-xs text-brand-950">
                {mosque.capacity ? `${mosque.capacity.toLocaleString("ms-MY")} jemaah` : "Tidak dinyatakan"}
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">Alamat</dt>
              <dd className="mt-0.5 flex items-start gap-2 text-xs leading-relaxed text-brand-950">
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-900/35" />
                {mosque.address ?? "Alamat belum dikemas kini"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">Telefon</dt>
              <dd className="mt-0.5 flex items-center gap-2 text-xs text-brand-950">
                <Phone className="h-3.5 w-3.5 text-brand-900/35" />
                {mosque.phone ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">E-mel</dt>
              <dd className="mt-0.5 flex items-center gap-2 break-all text-xs text-brand-950">
                <Mail className="h-3.5 w-3.5 shrink-0 text-brand-900/35" />
                {mosque.email ?? "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">Laporan bulan ini</dt>
              <dd className="mt-1">
                {report ? <StatusBadge value={report.status} /> : <Badge tone="danger">Tiada laporan</Badge>}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">Koordinat</dt>
              <dd className="mt-0.5 text-xs text-brand-950">
                {mosque.latitude != null && mosque.longitude != null
                  ? `${mosque.latitude.toFixed(4)}, ${mosque.longitude.toFixed(4)}`
                  : "—"}
              </dd>
            </div>
          </dl>
        </Card>

        <Card className="self-start">
          <CardHeader
            title="Skor bulan semasa"
            description={score ? `Dikira ${tarikhMasa(score.computedAt)}` : "Belum dikira"}
            action={
              score ? (
                <Badge tone={score.total >= 80 ? "success" : score.total >= 70 ? "warning" : "danger"}>
                  {score.total}/100
                </Badge>
              ) : undefined
            }
          />
          {!score || !breakdown ? (
            <EmptyState
              icon={Trophy}
              title="Skor belum tersedia"
              description="Pegawai JAINJ perlu menjalankan pengiraan skor bagi bulan semasa."
              action={
                <Link href="/jainj/skor" className="btn-secondary">
                  Buka halaman skor
                </Link>
              }
            />
          ) : (
            <div className="space-y-4 p-5">
              {BREAKDOWN_PARTS.map((part) => {
                const value = breakdown[part.key];
                return (
                  <div key={part.key}>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold text-brand-950">
                        {part.label}
                        <span className="ml-1.5 font-normal text-brand-900/40">
                          berat {value.berat}%
                        </span>
                      </p>
                      <span className="text-xs font-semibold text-brand-900/70">{value.skor}/100</span>
                    </div>
                    <Progress value={value.skor} tone={scoreTone(value.skor)} className="mt-1.5 h-1.5" />
                    <p className="mt-1 text-[11px] leading-relaxed text-brand-900/50">{value.nota}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="self-start">
          <CardHeader
            title="Pegawai & AJK"
            description={`${mosque.officers.filter((o) => o.status === "AKTIF").length} pegawai aktif didaftarkan.`}
            action={
              <Link href="/jainj/tauliah" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
                Data induk
              </Link>
            }
          />
          {mosque.officers.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Tiada pegawai didaftarkan"
              description="Pihak masjid perlu melengkapkan pendaftaran AJK melalui portal."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table min-w-[520px]">
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Jawatan</th>
                    <th>Telefon</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {mosque.officers.map((officer) => (
                    <tr key={officer.id}>
                      <td>
                        <p className="font-medium text-brand-950">{officer.name}</p>
                        <p className="text-[10px] text-brand-900/45">
                          Lantikan {tarikh(officer.appointmentDate)}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-xs">{label(officer.position)}</td>
                      <td className="whitespace-nowrap text-xs text-brand-900/65">{officer.phone ?? "—"}</td>
                      <td>
                        <StatusBadge value={officer.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <section id="selenggaraan">
          <Card className="self-start">
            <CardHeader
              title="Aduan selenggaraan terbuka"
              description="Aduan yang belum selesai atau ditolak."
              action={
                <Badge tone={openHigh > 0 ? "danger" : maintenance.length > 0 ? "warning" : "success"}>
                  {maintenance.length} terbuka
                </Badge>
              }
            />
            {maintenance.length === 0 ? (
              <EmptyState
                icon={Wrench}
                title="Tiada aduan terbuka"
                description="Semua aduan selenggaraan bagi masjid ini telah diselesaikan."
              />
            ) : (
              <ul className="divide-y divide-brand-900/5">
                {maintenance.map((request) => {
                  const age = Math.max(0, Math.floor((now.getTime() - request.createdAt.getTime()) / DAY));
                  return (
                    <li key={request.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="text-xs font-semibold text-brand-950">{request.title}</p>
                        <StatusBadge value={request.priority} />
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-900/50">
                        <StatusBadge value={request.status} />
                        <span className={age > 14 ? "font-semibold text-red-600" : undefined}>
                          {age} hari · dilaporkan {tarikh(request.createdAt)}
                        </span>
                        {request.costSen != null && <span>Anggaran {rm(request.costSen)}</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </section>
      </div>

      <div className="mt-6">
        <Card>
          <CardHeader
            title="Ringkasan lejar bulan semasa"
            description={`Transaksi diposkan bagi ${bulanTahun(month, year)}.`}
            action={
              <div className="flex flex-wrap items-center gap-3 text-[11px]">
                <span className="text-emerald-700">Masuk {rm(totalIn)}</span>
                <span className="text-red-600">Keluar {rm(totalOut)}</span>
                <span className="font-semibold text-brand-950">Bersih {rm(totalIn - totalOut)}</span>
              </div>
            }
          />
          {recentEntries.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Tiada transaksi bulan ini"
              description="Lejar masjid belum merekodkan sebarang transaksi bagi bulan semasa."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarikh</th>
                    <th>Keterangan</th>
                    <th>Kategori</th>
                    <th>Kaedah</th>
                    <th className="text-right">Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentEntries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap text-xs text-brand-900/60">{tarikh(entry.date)}</td>
                      <td>
                        <p className="font-medium text-brand-950">{entry.description}</p>
                        <p className="text-[11px] text-brand-900/45">{entry.account.name}</p>
                      </td>
                      <td className="text-xs">{entry.category}</td>
                      <td className="whitespace-nowrap text-xs">{entry.method ? label(entry.method) : "—"}</td>
                      <td
                        className={
                          entry.type === "MASUK"
                            ? "whitespace-nowrap text-right text-xs font-semibold text-emerald-700"
                            : "whitespace-nowrap text-right text-xs font-semibold text-red-600"
                        }
                      >
                        {entry.type === "MASUK" ? "+" : "−"}
                        {rm(entry.amountSen)}
                      </td>
                      <td>
                        <StatusBadge value={entry.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-brand-900/5 px-5 py-3">
            <p className="text-[11px] text-brand-900/45">Lapan transaksi terbaharu bulan semasa.</p>
            <Link
              href="/jainj/laporan"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
            >
              Laporan konsolidasi <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
