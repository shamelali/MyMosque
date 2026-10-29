import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CalendarCheck,
  CalendarDays,
  Clock,
  Plus,
  Users,
  Wallet,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { bulanTahun, rm, tarikh } from "@/lib/utils";
import { requireTutor, startOfDay } from "./_lib";

export const metadata: Metadata = { title: "Papan Pemuka Tutor" };

function slotStart(date: Date, time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const start = new Date(date);
  start.setHours(hour || 0, minute || 0, 0, 0);
  return start;
}

export default async function TutorDashboardPage() {
  const { tutor } = await requireTutor();

  const now = new Date();
  const today = startOfDay(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const [upcomingCount, monthAgg, hoursAgg, pendingPayout, todaySessions, upcomingCandidates, latest] = await Promise.all([
    prisma.quranBooking.count({
      where: { tutorId: tutor.id, status: "DISAHKAN", slot: { date: { gte: today } } },
    }),
    prisma.quranBooking.aggregate({
      where: {
        tutorId: tutor.id,
        status: { in: ["DISAHKAN", "SELESAI"] },
        slot: { date: { gte: monthStart, lt: monthEnd } },
      },
      _sum: { amountSen: true },
      _count: { _all: true },
    }),
    prisma.quranBooking.aggregate({
      where: {
        tutorId: tutor.id,
        status: "DISAHKAN",
        slot: { date: { gte: monthStart, lt: monthEnd } },
      },
      _sum: { hours: true },
    }),
    prisma.payout.aggregate({
      where: { tutorId: tutor.id, status: "MENUNGGU" },
      _sum: { netSen: true },
    }),
    prisma.quranBooking.findMany({
      where: { tutorId: tutor.id, slot: { date: today }, status: { in: ["DISAHKAN", "SELESAI", "MENUNGGU_BAYARAN"] } },
      include: { slot: true },
      orderBy: { slot: { startTime: "asc" } },
    }),
    prisma.quranBooking.findMany({
      where: { tutorId: tutor.id, status: "DISAHKAN", slot: { date: { gte: today } } },
      include: { slot: true },
      orderBy: [{ slot: { date: "asc" } }, { slot: { startTime: "asc" } }],
      take: 8,
    }),
    prisma.quranBooking.findMany({
      where: { tutorId: tutor.id },
      include: { slot: true },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
  ]);

  const hours = hoursAgg._sum.hours ?? 0;
  const gross = monthAgg._sum.amountSen ?? 0;
  const pendingNet = pendingPayout._sum.netSen ?? 0;

  const upcoming = upcomingCandidates
    .filter((booking) => slotStart(booking.slot.date, booking.slot.startTime) >= now)
    .slice(0, 3);

  return (
    <div>
      <PageHeader
        eyebrow="Aplikasi Tutor"
        title={`Assalamualaikum, ${(tutor.name ?? "").split(" ").slice(0, 2).join(" ") || "Tutor"}`}
        description={`Urus slot, tempahan dan bayaran anda${tutor.mosque ? ` di ${tutor.mosque.name}` : ""}.`}
        actions={
          <Link href="/tutor/jadual" className="btn-primary text-xs">
            <Plus className="h-4 w-4" /> Tambah slot
          </Link>
        }
      />

      {!tutor.verified && (
        <div className="mb-5 flex items-start gap-3 rounded-xl bg-amber-50 px-4 py-3 ring-1 ring-inset ring-amber-600/20">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div>
            <p className="text-xs font-semibold text-amber-900">Tauliah anda sedang disemak oleh JAINJ</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-amber-800/80">
              Profil anda belum disahkan, jadi anda belum dipaparkan kepada jemaah di halaman tempahan. Anda masih
              boleh menyediakan slot dan mengemas kini profil.{" "}
              <Link href="/tutor/profil" className="font-semibold underline underline-offset-2">
                Semak profil
              </Link>
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Sesi akan datang"
          value={upcomingCount}
          hint="Tempahan disahkan"
          icon={CalendarCheck}
        />
        <Stat
          label="Jam mengajar bulan ini"
          value={`${hours} jam`}
          hint={`${monthAgg._count._all} tempahan disahkan & selesai`}
          icon={Clock}
        />
        <Stat
          label="Pendapatan kasar bulan ini"
          value={rm(gross)}
          hint={bulanTahun(now.getMonth() + 1, now.getFullYear())}
          icon={Wallet}
        />
        <Stat
          label="Bayaran menunggu"
          value={rm(pendingNet)}
          hint="Bersih selepas komisen 15%"
          icon={WalletCards}
        />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Jadual hari ini"
            description={tarikh(today)}
            action={<CalendarDays className="h-5 w-5 text-brand-900/30" />}
          />
          {todaySessions.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Tiada kelas hari ini"
              description="Nikmati hari anda. Slot baharu boleh ditambah pada bila-bila masa."
              action={
                <Link href="/tutor/jadual" className="btn-secondary text-xs">
                  <Plus className="h-3.5 w-3.5" /> Tambah slot
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-brand-900/5">
              {todaySessions.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <span className="w-14 shrink-0 rounded-lg bg-brand-50 px-2 py-1 text-center text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-700/10">
                    {booking.slot.startTime}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-950">{booking.studentName}</p>
                    <p className="truncate text-[11px] text-brand-900/50">
                      Ibu bapa: {booking.parentName} · {booking.hours} jam
                    </p>
                  </div>
                  <StatusBadge value={booking.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Sesi seterusnya"
            description="Tiga tempahan disahkan yang terdekat."
            action={<CalendarCheck className="h-5 w-5 text-brand-900/30" />}
          />
          {upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="Tiada sesi akan datang"
              description="Buka lebih banyak slot supaya ibu bapa boleh menempah kelas anda."
              action={
                <Link href="/tutor/jadual" className="btn-secondary text-xs">
                  Urus jadual slot
                </Link>
              }
            />
          ) : (
            <ul className="divide-y divide-brand-900/5">
              {upcoming.map((booking) => (
                <li key={booking.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-brand-950">{booking.studentName}</p>
                    <p className="text-[11px] text-brand-900/50">
                      {tarikh(booking.slot.date)} · {booking.slot.startTime}–{booking.slot.endTime}
                    </p>
                    <p className="text-[11px] text-brand-900/40">Ibu bapa: {booking.parentName}</p>
                  </div>
                  <StatusBadge value={booking.status} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle
          action={
            <Link href="/tutor/tempahan" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
              Semua tempahan
            </Link>
          }
        >
          Tempahan terkini
        </SectionTitle>
        <Card>
          {latest.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Belum ada tempahan"
              description="Tempahan ibu bapa akan muncul di sini selepas slot anda ditempah."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tempahan</th>
                    <th>Slot</th>
                    <th>Pelajar</th>
                    <th>Ibu bapa</th>
                    <th className="text-right">Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((booking) => (
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
                      <td className="text-xs">{booking.parentName}</td>
                      <td className="whitespace-nowrap text-right font-semibold">{rm(booking.amountSen)}</td>
                      <td>
                        <StatusBadge value={booking.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <Link href="/tutor/jadual" className="card flex items-center gap-3 p-4 transition hover:shadow-lg">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-700/10">
            <CalendarDays className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-brand-950">Tambah / urus slot</span>
            <span className="block text-[11px] text-brand-900/50">Buka slot untuk 14 hari akan datang</span>
          </span>
          <ArrowRight className="h-4 w-4 text-brand-900/30" />
        </Link>
        <Link href="/tutor/bayaran" className="card flex items-center gap-3 p-4 transition hover:shadow-lg">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-700/10">
            <WalletCards className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-brand-950">Lihat bayaran</span>
            <span className="block text-[11px] text-brand-900/50">Penyata dan permohonan bayaran</span>
          </span>
          <ArrowRight className="h-4 w-4 text-brand-900/30" />
        </Link>
      </div>

      {tutor.verified ? (
        <p className="mt-5 flex items-center gap-1.5 text-[11px] text-brand-900/45">
          <BadgeCheck className="h-3.5 w-3.5 text-emerald-600" /> Tauliah disahkan
          {tutor.verifiedBy ? ` oleh ${tutor.verifiedBy}` : ""}.
        </p>
      ) : (
        <p className="mt-5 flex items-center gap-1.5 text-[11px] text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" /> Tauliah belum disahkan.{" "}
          <Badge tone="warning">Dalam semakan</Badge>
        </p>
      )}
    </div>
  );
}
