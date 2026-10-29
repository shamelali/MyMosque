import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  Info,
  Percent,
  ShieldCheck,
  Wallet,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat, StatusBadge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { commissionFor } from "@/lib/quran";
import { label } from "@/lib/labels";
import { bulanTahun, rm, tarikh, tarikhMasa } from "@/lib/utils";
import { requireTutor } from "../_lib";
import { requestPayout } from "./actions";

export const metadata: Metadata = { title: "Bayaran" };

export default async function TutorBayaranPage({
  searchParams,
}: {
  searchParams: Promise<{ ralat?: string; maklum?: string }>;
}) {
  const { tutor } = await requireTutor();
  const params = await searchParams;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const period = bulanTahun(now.getMonth() + 1, now.getFullYear());

  const [monthAgg, totalPaid, payouts, currentPayout] = await Promise.all([
    prisma.quranBooking.aggregate({
      where: {
        tutorId: tutor.id,
        status: { in: ["DISAHKAN", "SELESAI"] },
        slot: { date: { gte: monthStart, lt: monthEnd } },
      },
      _sum: { amountSen: true },
      _count: { _all: true },
    }),
    prisma.payout.aggregate({
      where: { tutorId: tutor.id, status: "DIBAYAR" },
      _sum: { netSen: true },
    }),
    prisma.payout.findMany({
      where: { tutorId: tutor.id },
      orderBy: { periodStart: "desc" },
    }),
    prisma.payout.findFirst({
      where: {
        tutorId: tutor.id,
        periodStart: { lt: monthEnd },
        periodEnd: { gt: monthStart },
      },
    }),
  ]);

  const grossSen = monthAgg._sum.amountSen ?? 0;
  const commissionSen = commissionFor(grossSen);
  const netSen = grossSen - commissionSen;
  const paidToDate = totalPaid._sum.netSen ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Aplikasi Tutor"
        title="Bayaran"
        description="Penyata pendapatan kelas anda. Komisen platform 15% dipotong pada sumber oleh gerbang pembayaran."
        actions={
          <Link href="/tutor/tempahan" className="btn-secondary text-xs">
            Lihat tempahan
          </Link>
        }
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}
      {params.maklum && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          {params.maklum}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Kasar bulan ini"
          value={rm(grossSen)}
          hint={`${monthAgg._count._all} tempahan · ${period}`}
          icon={Wallet}
        />
        <Stat label="Komisen 15%" value={rm(commissionSen)} hint="Dipotong pada sumber" icon={Percent} />
        <Stat label="Bersih bulan ini" value={rm(netSen)} hint="Jumlah yang akan dibayar" icon={WalletCards} />
        <Stat label="Jumlah dibayar" value={rm(paidToDate)} hint="Semua bayaran selesai" icon={CheckCircle2} />
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader
            title="Sejarah bayaran"
            description="Tempoh, kasar, komisen dan bayaran bersih bagi setiap penyelesaian."
            action={<WalletCards className="h-5 w-5 text-brand-900/30" />}
          />
          {payouts.length === 0 ? (
            <EmptyState
              icon={WalletCards}
              title="Belum ada bayaran"
              description="Bayaran akan muncul di sini selepas tempahan disahkan dan permohonan bayaran diproses."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tempoh</th>
                    <th className="text-right">Kasar</th>
                    <th className="text-right">Komisen</th>
                    <th className="text-right">Bersih</th>
                    <th>Status</th>
                    <th>Dibayar</th>
                    <th>Rujukan</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((payout) => (
                    <tr key={payout.id}>
                      <td className="whitespace-nowrap text-xs">
                        {tarikh(payout.periodStart)} – {tarikh(payout.periodEnd)}
                      </td>
                      <td className="whitespace-nowrap text-right">{rm(payout.grossSen)}</td>
                      <td className="whitespace-nowrap text-right text-xs text-brand-900/60">
                        {rm(payout.commissionSen)}
                      </td>
                      <td className="whitespace-nowrap text-right font-semibold">{rm(payout.netSen)}</td>
                      <td>
                        <StatusBadge value={payout.status} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-brand-900/60">
                        {payout.paidAt ? tarikhMasa(payout.paidAt) : "—"}
                      </td>
                      <td className="whitespace-nowrap font-mono text-[11px] text-brand-900/50">
                        {payout.reference ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Mohon bayaran"
              description={`Tempahan disahkan & selesai · ${period}`}
              action={<Wallet className="h-5 w-5 text-brand-900/30" />}
            />
            <div className="p-5">
              <dl className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <dt className="text-brand-900/55">Kasar tempahan</dt>
                  <dd className="font-semibold text-brand-950">{rm(grossSen)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-brand-900/55">Komisen platform (15%)</dt>
                  <dd className="font-semibold text-brand-950">− {rm(commissionSen)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-brand-900/10 pt-2">
                  <dt className="font-semibold text-brand-950">Bersih</dt>
                  <dd className="text-sm font-semibold text-brand-950">{rm(netSen)}</dd>
                </div>
              </dl>

              {currentPayout ? (
                <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 ring-1 ring-inset ring-amber-600/15">
                  <p className="text-xs font-semibold text-amber-900">
                    Permohonan {period} sudah dihantar
                  </p>
                  <p className="mt-0.5 text-[11px] text-amber-800/80">
                    Status: {label(currentPayout.status)} · Bersih {rm(currentPayout.netSen)}. Satu permohonan sahaja
                    bagi setiap bulan.
                  </p>
                </div>
              ) : (
                <form action={requestPayout} className="mt-4">
                  <button type="submit" className="btn-primary w-full text-xs" disabled={grossSen <= 0}>
                    Hantar permohonan bayaran
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-brand-900/45">
                    {grossSen > 0
                      ? "Permohonan akan disemak oleh bendahari masjid sebelum pembayaran dibuat."
                      : "Belum ada tempahan disahkan atau selesai untuk bulan ini."}
                  </p>
                </form>
              )}
            </div>
          </Card>

          <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-inset ring-brand-700/10">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-950">
              <ShieldCheck className="h-4 w-4 text-brand-700" /> Penyelesaian split settlement
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-brand-900/60">
              Dana kelas diselesaikan terus kepada akaun tutor oleh gerbang pembayaran. Komisen platform 15% ditolak
              pada sumber, jadi jumlah bersih yang dipaparkan ialah jumlah yang diterima. Platform tidak memegang dana
              tutor.
            </p>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-brand-900/45">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Tempoh bayaran dikira mengikut tarikh slot kelas. Hubungi bendahari masjid jika terdapat percanggahan.
          </p>
        </div>
      </div>
    </div>
  );
}
