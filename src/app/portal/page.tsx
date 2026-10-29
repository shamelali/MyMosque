import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  FileText,
  HardHat,
  Plus,
  ReceiptText,
  Trophy,
  Wallet,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat, StatusBadge } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { currentMosque } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { bulanTahun, rm, tarikh } from "@/lib/utils";

export const metadata: Metadata = { title: "Papan Pemuka" };

export default async function PortalDashboardPage() {
  const mosque = await currentMosque();
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  const monthStart = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month, 1);

  const [
    income,
    expenses,
    openMaintenance,
    upcomingKuliah,
    score,
    pendingReports,
    pendingProjects,
    pendingMaintenance,
    recentEntries,
  ] = await Promise.all([
    prisma.ledgerEntry.aggregate({
      where: { mosqueId: mosque.id, type: "MASUK", status: "POSTED", date: { gte: monthStart, lt: nextMonth } },
      _sum: { amountSen: true },
    }),
    prisma.ledgerEntry.aggregate({
      where: { mosqueId: mosque.id, type: "KELUAR", status: "POSTED", date: { gte: monthStart, lt: nextMonth } },
      _sum: { amountSen: true },
    }),
    prisma.maintenanceRequest.count({
      where: { mosqueId: mosque.id, status: { notIn: ["SELESAI", "DITOLAK"] } },
    }),
    prisma.kuliahProgram.count({
      where: { mosqueId: mosque.id, date: { gte: now }, status: { in: ["DIRANCANG", "SAH"] } },
    }),
    prisma.scoreSnapshot.findUnique({
      where: { mosqueId_year_month: { mosqueId: mosque.id, year, month } },
      select: { total: true, computedAt: true },
    }),
    prisma.monthlyReport.findMany({
      where: { mosqueId: mosque.id, status: "DIHANTAR" },
      orderBy: [{ year: "desc" }, { month: "desc" }],
      select: { id: true, month: true, year: true },
    }),
    prisma.project.findMany({
      where: { mosqueId: mosque.id, status: "DICADANG" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.maintenanceRequest.findMany({
      where: { mosqueId: mosque.id, status: "DIHANTAR" },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { mosqueId: mosque.id },
      orderBy: { date: "desc" },
      take: 6,
      include: { account: { select: { name: true } } },
    }),
  ]);

  const totalIn = income._sum.amountSen ?? 0;
  const totalOut = expenses._sum.amountSen ?? 0;
  const pendingCount = pendingReports.length + pendingProjects.length + pendingMaintenance.length;

  return (
    <div>
      <PageHeader
        eyebrow={`${mosque.district} · ${mosque.code}`}
        title={mosque.name}
        description={`Ringkasan operasi dan kewangan bagi ${bulanTahun(month, year)}.`}
        actions={
          <Link href="/portal/kewangan" className="btn-primary">
            <Plus className="h-4 w-4" /> Rekod transaksi
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat
          label="Hasil bulan ini"
          value={rm(totalIn)}
          hint={`Transaksi masuk bagi ${bulanTahun(month, year)}`}
          icon={ArrowDownLeft}
        />
        <Stat
          label="Perbelanjaan bulan ini"
          value={rm(totalOut)}
          hint={`Transaksi keluar bagi ${bulanTahun(month, year)}`}
          icon={ArrowUpRight}
        />
        <Stat
          label="Baki bersih bulan ini"
          value={rm(totalIn - totalOut)}
          hint="Hasil tolak perbelanjaan"
          icon={Wallet}
        />
        <Stat
          label="Aduan selenggaraan terbuka"
          value={openMaintenance}
          hint={openMaintenance > 0 ? "Menunggu tindakan AJK" : "Tiada aduan tertunggak"}
          icon={Wrench}
        />
        <Stat
          label="Kuliah akan datang"
          value={upcomingKuliah}
          hint="Program berstatus dirancang atau sah"
          icon={BookOpen}
        />
        <Stat
          label="Skor prestasi bulan ini"
          value={score ? `${score.total}/100` : "—"}
          hint={score ? `Dikira ${tarikh(score.computedAt)}` : "Belum dikira oleh JAINJ"}
          icon={Trophy}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Transaksi terkini"
              description="Enam rekod lejar terbaharu bagi masjid ini."
              action={
                <Link href="/portal/kewangan" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
                  Lihat semua
                </Link>
              }
            />
            {recentEntries.length === 0 ? (
              <EmptyState
                icon={ReceiptText}
                title="Belum ada transaksi"
                description="Rekod transaksi pertama anda untuk mula membina lejar masjid."
                action={
                  <Link href="/portal/kewangan" className="btn-secondary">
                    Rekod transaksi
                  </Link>
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tarikh</th>
                      <th>Keterangan</th>
                      <th>Kategori</th>
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
                        <td
                          className={
                            entry.type === "MASUK"
                              ? "whitespace-nowrap text-right font-semibold text-emerald-700"
                              : "whitespace-nowrap text-right font-semibold text-red-600"
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
          </Card>

          <div>
            <SectionTitle>Pintasan pantas</SectionTitle>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <QuickLink href="/portal/kewangan" icon={ReceiptText} label="Rekod transaksi" hint="Lejar & resit" />
              <QuickLink href="/portal/kewangan/laporan" icon={FileText} label="Laporan bulanan" hint="Hantar ke JAINJ" />
              <QuickLink href="/portal/selenggaraan?tab=aduan" icon={Wrench} label="Aduan selenggaraan" hint="Aset & pemeriksaan" />
              <QuickLink href="/portal/kuliah" icon={Plus} label="Tambah program" hint="Kuliah & penceramah" />
            </div>
          </div>
        </div>

        <Card className="self-start">
          <CardHeader
            title="Tindakan menunggu"
            description="Perkara yang memerlukan perhatian pihak masjid."
            action={
              <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-[11px] font-semibold text-gold-600">
                {pendingCount}
              </span>
            }
          />
          {pendingCount === 0 ? (
            <EmptyState
              icon={ClipboardCheck}
              title="Tiada tindakan menunggu"
              description="Semua laporan, projek dan aduan telah dikendalikan."
            />
          ) : (
            <div className="divide-y divide-brand-900/5">
              <PendingRow
                href="/portal/kewangan/laporan"
                icon={FileText}
                label="Laporan bulanan untuk semakan"
                count={pendingReports.length}
                items={pendingReports.map((r) => bulanTahun(r.month, r.year))}
              />
              <PendingRow
                href="/portal/projek"
                icon={HardHat}
                label="Projek menunggu kelulusan"
                count={pendingProjects.length}
                items={pendingProjects.map((p) => p.title)}
              />
              <PendingRow
                href="/portal/selenggaraan?tab=aduan"
                icon={Wrench}
                label="Aduan selenggaraan baharu"
                count={pendingMaintenance.length}
                items={pendingMaintenance.map((m) => m.title)}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  icon: Icon,
  label,
  hint,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  hint: string;
}) {
  return (
    <Link
      href={href}
      className="card group flex items-center gap-3 p-4 transition hover:ring-brand-700/20"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-700/10">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-xs font-semibold text-brand-950">{label}</span>
        <span className="block truncate text-[11px] text-brand-900/50">{hint}</span>
      </span>
      <ChevronRight className="ml-auto h-4 w-4 shrink-0 text-brand-900/25 transition group-hover:text-brand-700" />
    </Link>
  );
}

function PendingRow({
  href,
  icon: Icon,
  label,
  count,
  items,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  count: number;
  items: string[];
}) {
  return (
    <Link href={href} className="group flex items-start gap-3 px-5 py-4 transition hover:bg-brand-50/50">
      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-600/15">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="text-xs font-semibold text-brand-950">{label}</span>
          <span className="rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
            {count}
          </span>
        </span>
        <span className="mt-1 block space-y-0.5">
          {items.slice(0, 2).map((item) => (
            <span key={item} className="block truncate text-[11px] text-brand-900/50">
              {item}
            </span>
          ))}
          {items.length > 2 && (
            <span className="block text-[11px] text-brand-900/40">+{items.length - 2} lagi</span>
          )}
        </span>
      </span>
      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-brand-900/25 transition group-hover:text-brand-700" />
    </Link>
  );
}
