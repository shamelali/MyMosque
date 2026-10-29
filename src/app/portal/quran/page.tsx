import type { Metadata } from "next";
import {
  BadgeCheck,
  Ban,
  BookMarked,
  CalendarRange,
  CheckCircle2,
  CircleDollarSign,
  UserCheck,
  WalletCards,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, Stat, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { bulanTahun, percent, rm, tarikh, tarikhMasa } from "@/lib/utils";
import { markPayoutPaid, toggleTutor, verifyTutor } from "./actions";

export const metadata: Metadata = { title: "Tempahan Al-Quran" };

function genderLabel(value: string) {
  return value === "PEREMPUAN" ? "Perempuan" : "Lelaki";
}

export default async function PortalQuranPage({
  searchParams,
}: {
  searchParams: Promise<{ ralat?: string; maklum?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const params = await searchParams;

  const canVerify = ["KETUA", "SETIAUSAHA"].includes(user.role);
  const canPay = ["BENDAHARI", "KETUA"].includes(user.role);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86_400_000);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const tutors = await prisma.tutor.findMany({ where: { mosqueId: mosque.id }, orderBy: { name: "asc" } });
  const tutorIds = tutors.map((tutor) => tutor.id);

  const [bookings, payouts, slotCounts, revenue] = await Promise.all([
    prisma.quranBooking.findMany({
      where: { tutorId: { in: tutorIds } },
      include: { tutor: { select: { name: true } }, slot: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.payout.findMany({
      where: { tutorId: { in: tutorIds } },
      include: { tutor: { select: { name: true } } },
      orderBy: { periodStart: "desc" },
      take: 20,
    }),
    prisma.quranSlot.groupBy({
      by: ["tutorId", "status"],
      where: { tutorId: { in: tutorIds }, date: { gte: startOfToday, lt: endOfWeek } },
      _count: { _all: true },
    }),
    prisma.quranBooking.aggregate({
      where: {
        tutorId: { in: tutorIds },
        status: { in: ["DISAHKAN", "SELESAI"] },
        createdAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountSen: true, commissionSen: true },
      _count: { _all: true },
    }),
  ]);

  const occupancy = tutors.map((tutor) => {
    const rows = slotCounts.filter((row) => row.tutorId === tutor.id);
    const open = rows.find((row) => row.status === "TERBUKA")?._count._all ?? 0;
    const taken = rows.find((row) => row.status === "DITEMPAH")?._count._all ?? 0;
    return { tutor, open, taken };
  });
  const openSlots = occupancy.reduce((sum, row) => sum + row.open, 0);

  const confirmedValue = revenue._sum.amountSen ?? 0;
  const commission = revenue._sum.commissionSen ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Hasil & Komuniti"
        title="Tempahan Al-Quran"
        description={`Pantau tutor bertauliah, tempahan kelas dan bayaran balik ${mosque.name}.`}
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
          label="Nilai tempahan bulan ini"
          value={rm(confirmedValue)}
          hint={`${bulanTahun(now.getMonth() + 1, now.getFullYear())} · tempahan disahkan`}
          icon={CircleDollarSign}
        />
        <Stat label="Komisen platform" value={rm(commission)} hint="15% daripada nilai tempahan" icon={WalletCards} />
        <Stat label="Tempahan disahkan" value={revenue._count._all} hint="Bulan semasa" icon={CheckCircle2} />
        <Stat label="Slot terbuka 7 hari" value={openSlots} hint={`${tutors.length} tutor berdaftar`} icon={CalendarRange} />
      </div>

      <div className="mt-6">
        <SectionTitle
          action={
            <span className="text-xs text-brand-900/45">Tauliah disahkan oleh Pengerusi atau Setiausaha</span>
          }
        >
          Tutor & tauliah
        </SectionTitle>
        <Card>
          {tutors.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title="Belum ada tutor berdaftar"
              description="Tutor yang mendaftar melalui aplikasi tutor akan muncul di sini untuk pengesahan tauliah."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tutor</th>
                    <th>Tauliah</th>
                    <th>Disahkan</th>
                    <th className="text-right">Kadar / jam</th>
                    <th>Status</th>
                    {canVerify && <th className="text-right">Tindakan</th>}
                  </tr>
                </thead>
                <tbody>
                  {tutors.map((tutor) => {
                    const expired = tutor.tauliahExpiry ? tutor.tauliahExpiry < now : false;
                    return (
                      <tr key={tutor.id}>
                        <td>
                          <p className="font-medium text-brand-950">{tutor.name}</p>
                          <p className="text-[11px] text-brand-900/45">{genderLabel(tutor.gender)}</p>
                        </td>
                        <td>
                          <p className="font-mono text-xs">{tutor.tauliahNo}</p>
                          <p className={expired ? "text-[11px] font-medium text-red-600" : "text-[11px] text-brand-900/45"}>
                            Tamat {tarikh(tutor.tauliahExpiry)}
                          </p>
                        </td>
                        <td>
                          {tutor.verified ? (
                            <Badge tone="success">
                              <BadgeCheck className="mr-1 h-3 w-3" /> Disahkan
                            </Badge>
                          ) : (
                            <Badge tone="warning">Belum disahkan</Badge>
                          )}
                          {tutor.verifiedBy && (
                            <p className="mt-1 text-[10px] text-brand-900/40">oleh {tutor.verifiedBy}</p>
                          )}
                        </td>
                        <td className="whitespace-nowrap text-right font-semibold">{rm(tutor.hourlyRateSen)}</td>
                        <td>
                          <StatusBadge value={tutor.status} />
                        </td>
                        {canVerify && (
                          <td className="text-right">
                            <div className="flex flex-wrap justify-end gap-2">
                              {!tutor.verified && (
                                <form action={verifyTutor}>
                                  <input type="hidden" name="id" value={tutor.id} />
                                  <button type="submit" className="btn-secondary whitespace-nowrap text-xs">
                                    <UserCheck className="h-3.5 w-3.5" /> Sahkan tauliah
                                  </button>
                                </form>
                              )}
                              <form action={toggleTutor}>
                                <input type="hidden" name="id" value={tutor.id} />
                                <button
                                  type="submit"
                                  className={
                                    tutor.status === "AKTIF"
                                      ? "btn-ghost whitespace-nowrap text-xs text-red-600 hover:bg-red-50"
                                      : "btn-secondary whitespace-nowrap text-xs"
                                  }
                                >
                                  <Ban className="h-3.5 w-3.5" />
                                  {tutor.status === "AKTIF" ? "Gantung" : "Aktifkan"}
                                </button>
                              </form>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Occupancy slot · 7 hari akan datang"
          description="Bilangan slot terbuka dan ditempah bagi setiap tutor."
          action={<CalendarRange className="h-5 w-5 text-brand-900/30" />}
        />
        {occupancy.length === 0 ? (
          <EmptyState icon={CalendarRange} title="Tiada slot" description="Slot akan dipaparkan selepas tutor menambah jadual." />
        ) : (
          <ul className="divide-y divide-brand-900/5">
            {occupancy.map((row) => (
              <li key={row.tutor.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-brand-950">{row.tutor.name}</p>
                  <p className="text-[11px] text-brand-900/45">
                    {row.open + row.taken > 0 ? `${percent(row.open, row.open + row.taken)}% masih terbuka` : "Tiada slot dijadualkan"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="success">{row.open} terbuka</Badge>
                  <Badge tone="neutral">{row.taken} ditempah</Badge>
                </div>
                <div className="w-full sm:w-40">
                  <Progress value={percent(row.open, row.open + row.taken)} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Tempahan terkini"
          description={`${bookings.length} tempahan terkini bagi tutor masjid ini.`}
          action={<BookMarked className="h-5 w-5 text-brand-900/30" />}
        />
        {bookings.length === 0 ? (
          <EmptyState
            icon={BookMarked}
            title="Belum ada tempahan"
            description="Tempahan ibu bapa akan muncul di sini selepas slot ditempah melalui aplikasi jemaah."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tempahan</th>
                  <th>Tutor</th>
                  <th>Ibu bapa</th>
                  <th>Pelajar</th>
                  <th>Slot</th>
                  <th className="text-right">Jam</th>
                  <th className="text-right">Jumlah</th>
                  <th className="text-right">Komisen</th>
                  <th>Status</th>
                  <th>Persetujuan</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="whitespace-nowrap font-mono text-xs">{booking.bookingNo}</td>
                    <td className="text-xs">{booking.tutor.name}</td>
                    <td>
                      <p className="text-xs font-medium text-brand-950">{booking.parentName}</p>
                      <p className="text-[11px] text-brand-900/45">{booking.parentPhone ?? booking.parentEmail}</p>
                    </td>
                    <td>
                      <p className="text-xs font-medium text-brand-950">{booking.studentName}</p>
                      <p className="text-[11px] text-brand-900/45">
                        {booking.studentAge} tahun · {booking.studentCount} pelajar
                      </p>
                    </td>
                    <td className="whitespace-nowrap text-xs">
                      {tarikh(booking.slot.date)}
                      <span className="block text-[11px] text-brand-900/45">
                        {booking.slot.startTime}–{booking.slot.endTime}
                      </span>
                    </td>
                    <td className="text-right">{booking.hours}</td>
                    <td className="whitespace-nowrap text-right font-semibold">{rm(booking.amountSen)}</td>
                    <td className="whitespace-nowrap text-right text-xs">{rm(booking.commissionSen)}</td>
                    <td>
                      <StatusBadge value={booking.status} />
                    </td>
                    <td>
                      {booking.guardianConsent ? (
                        <div>
                          <Badge tone="success">Penjaga</Badge>
                          <p className="mt-1 font-mono text-[10px] text-brand-900/40">{booking.consentRef ?? "—"}</p>
                        </div>
                      ) : (
                        <Badge tone="warning">Tiada</Badge>
                      )}
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
          title="Bayaran tutor"
          description="Bayaran bersih selepas komisen platform. Tanda dibayar selepas pindahan dibuat."
          action={<WalletCards className="h-5 w-5 text-brand-900/30" />}
        />
        {payouts.length === 0 ? (
          <EmptyState
            icon={WalletCards}
            title="Belum ada bayaran tutor"
            description="Bayaran akan dijana mengikut tempoh selepas tempahan disahkan."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tutor</th>
                  <th>Tempoh</th>
                  <th className="text-right">Kasar</th>
                  <th className="text-right">Komisen</th>
                  <th className="text-right">Bersih</th>
                  <th>Status</th>
                  {canPay && <th className="text-right">Tindakan</th>}
                </tr>
              </thead>
              <tbody>
                {payouts.map((payout) => (
                  <tr key={payout.id}>
                    <td className="text-xs font-medium">{payout.tutor.name}</td>
                    <td className="whitespace-nowrap text-xs text-brand-900/60">
                      {tarikh(payout.periodStart)} – {tarikh(payout.periodEnd)}
                    </td>
                    <td className="whitespace-nowrap text-right">{rm(payout.grossSen)}</td>
                    <td className="whitespace-nowrap text-right text-xs text-brand-900/60">{rm(payout.commissionSen)}</td>
                    <td className="whitespace-nowrap text-right font-semibold">{rm(payout.netSen)}</td>
                    <td>
                      <StatusBadge value={payout.status} />
                      {payout.paidAt && (
                        <p className="mt-1 text-[10px] text-brand-900/40">{tarikhMasa(payout.paidAt)}</p>
                      )}
                    </td>
                    {canPay && (
                      <td className="text-right">
                        {payout.status === "MENUNGGU" ? (
                          <form action={markPayoutPaid}>
                            <input type="hidden" name="id" value={payout.id} />
                            <button type="submit" className="btn-secondary whitespace-nowrap text-xs">
                              Tanda dibayar
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-brand-900/30">{payout.reference ?? "—"}</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
