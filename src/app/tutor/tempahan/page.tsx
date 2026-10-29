import type { Metadata } from "next";
import Link from "next/link";
import { CalendarCheck, CheckCircle2, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, Tabs } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { rm, tarikh } from "@/lib/utils";
import { requireTutor, startOfDay } from "../_lib";
import { cancelBooking, markCompleted } from "./actions";

export const metadata: Metadata = { title: "Tempahan" };

const STATUSES = ["SEMUA", "DISAHKAN", "MENUNGGU_BAYARAN", "SELESAI", "DIBATAL"] as const;
type StatusFilter = (typeof STATUSES)[number];

function isStatus(value: string): value is StatusFilter {
  return (STATUSES as readonly string[]).includes(value);
}

export default async function TutorTempahanPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; ralat?: string; maklum?: string }>;
}) {
  const { tutor } = await requireTutor();
  const params = await searchParams;
  const requested = (params.status ?? "SEMUA").toUpperCase();
  const status: StatusFilter = isStatus(requested) ? requested : "SEMUA";

  const [bookings, grouped] = await Promise.all([
    prisma.quranBooking.findMany({
      where: { tutorId: tutor.id, ...(status === "SEMUA" ? {} : { status }) },
      include: { slot: true },
      orderBy: [{ slot: { date: "desc" } }, { slot: { startTime: "desc" } }],
    }),
    prisma.quranBooking.groupBy({
      by: ["status"],
      where: { tutorId: tutor.id },
      _count: { _all: true },
    }),
  ]);

  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const countFor = (value: StatusFilter) =>
    value === "SEMUA" ? total : grouped.find((row) => row.status === value)?._count._all ?? 0;

  const today = startOfDay();
  const activeHref = status === "SEMUA" ? "/tutor/tempahan" : `/tutor/tempahan?status=${status}`;

  const tabs = STATUSES.map((value) => ({
    href: value === "SEMUA" ? "/tutor/tempahan" : `/tutor/tempahan?status=${value}`,
    label:
      value === "SEMUA"
        ? "Semua"
        : value === "MENUNGGU_BAYARAN"
          ? "Menunggu bayaran"
          : value === "DISAHKAN"
            ? "Disahkan"
            : value === "SELESAI"
              ? "Selesai"
              : "Dibatalkan",
    count: countFor(value),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Aplikasi Tutor"
        title="Tempahan kelas"
        description="Semak tempahan ibu bapa, tandakan kelas selesai atau batalkan kelas dengan memaklumkan ibu bapa."
        actions={
          <Link href="/tutor/jadual" className="btn-secondary text-xs">
            <CalendarCheck className="h-4 w-4" /> Urus slot
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

      <Tabs items={tabs} active={activeHref} />

      <Card>
        {bookings.length === 0 ? (
          <EmptyState
            icon={CalendarCheck}
            title="Tiada tempahan bagi tapisan ini"
            description={
              status === "SEMUA"
                ? "Tempahan ibu bapa akan muncul di sini selepas slot anda ditempah."
                : "Cuba pilih status tempahan yang lain."
            }
            action={
              <Link href="/tutor/jadual" className="btn-secondary text-xs">
                Tambah slot baharu
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table min-w-[1100px]">
              <thead>
                <tr>
                  <th>Tempahan</th>
                  <th>Slot</th>
                  <th>Pelajar</th>
                  <th>Ibu bapa</th>
                  <th>Jam / pelajar</th>
                  <th className="text-right">Jumlah</th>
                  <th className="text-right">Komisen</th>
                  <th>Persetujuan</th>
                  <th>Status</th>
                  <th className="text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => {
                  const canComplete = startOfDay(booking.slot.date) <= today;
                  return (
                    <tr key={booking.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{booking.bookingNo}</td>
                      <td className="whitespace-nowrap text-xs">
                        {tarikh(booking.slot.date)}
                        <span className="block text-[11px] text-brand-900/45">
                          {booking.slot.startTime}–{booking.slot.endTime}
                        </span>
                      </td>
                      <td>
                        <p className="text-xs font-medium text-brand-950">{booking.studentName}</p>
                        <p className="text-[11px] text-brand-900/45">{booking.studentAge} tahun</p>
                      </td>
                      <td>
                        <p className="text-xs font-medium text-brand-950">{booking.parentName}</p>
                        <p className="text-[11px] text-brand-900/45">{booking.parentPhone ?? booking.parentEmail}</p>
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {booking.hours} jam · {booking.studentCount} pelajar
                      </td>
                      <td className="whitespace-nowrap text-right font-semibold">{rm(booking.amountSen)}</td>
                      <td className="whitespace-nowrap text-right text-xs text-brand-900/60">
                        {rm(booking.commissionSen)}
                      </td>
                      <td>
                        {booking.guardianConsent ? (
                          <div>
                            <Badge tone="success">Penjaga</Badge>
                            <p className="mt-1 font-mono text-[10px] text-brand-900/40">
                              {booking.consentRef ?? "—"}
                            </p>
                          </div>
                        ) : (
                          <Badge tone="warning">Tiada</Badge>
                        )}
                      </td>
                      <td>
                        <StatusBadge value={booking.status} />
                        {booking.status === "MENUNGGU_BAYARAN" && (
                          <p className="mt-1 max-w-[150px] text-[10px] leading-snug text-amber-700">
                            Menunggu bayaran — slot dipegang 30 minit.
                          </p>
                        )}
                      </td>
                      <td className="text-right">
                        {booking.status === "DISAHKAN" ? (
                          <div className="flex flex-col items-end gap-1.5">
                            {canComplete ? (
                              <form action={markCompleted}>
                                <input type="hidden" name="id" value={booking.id} />
                                <button type="submit" className="btn-secondary whitespace-nowrap text-[11px]">
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Tandakan selesai
                                </button>
                              </form>
                            ) : (
                              <span className="text-[10px] text-brand-900/35">Selesai selepas kelas</span>
                            )}
                            <form action={cancelBooking}>
                              <input type="hidden" name="id" value={booking.id} />
                              <button
                                type="submit"
                                className="btn-ghost whitespace-nowrap text-[11px] text-red-600 hover:bg-red-50"
                              >
                                Batal
                              </button>
                            </form>
                          </div>
                        ) : (
                          <span className="text-xs text-brand-900/25">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="mt-5 flex items-start gap-1.5 rounded-lg bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Ibu bapa akan dimaklumkan melalui e-mel dan pemberitahuan dalam aplikasi apabila kelas ditandakan selesai atau
        dibatalkan. Pembatalan mengembalikan slot kepada status terbuka untuk tempahan baharu.
      </p>
    </div>
  );
}
