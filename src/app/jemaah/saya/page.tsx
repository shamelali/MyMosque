import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Bell,
  BookMarked,
  Download,
  HeartHandshake,
  LogOut,
  Mail,
  MapPin,
  ReceiptText,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { isRole, ROLE_LABEL } from "@/lib/roles";
import { label } from "@/lib/labels";
import { initials, rm, tarikh, tarikhMasa } from "@/lib/utils";
import { logout } from "./actions";

export const metadata: Metadata = { title: "Akaun Saya" };

export default async function JemaahSayaPage() {
  const user = await requirePageUser();

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    include: { mosque: { select: { name: true, district: true } } },
  });
  if (!profile) notFound();

  const email = profile.email;

  const [donations, bookings, orders, notifications] = await Promise.all([
    prisma.donation.findMany({
      where: { donorEmail: email },
      include: { campaign: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.quranBooking.findMany({
      where: { parentEmail: email },
      include: { tutor: { select: { name: true } }, slot: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
    prisma.qurbanOrder.findMany({
      where: { email },
      include: { program: { select: { year: true, animal: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const receipts = await prisma.receipt.findMany({
    where: { donationId: { in: donations.map((donation) => donation.id) } },
    select: { id: true, donationId: true, number: true },
  });
  const receiptByDonation = new Map<string, { id: string; number: string }>();
  for (const receipt of receipts) {
    if (receipt.donationId) receiptByDonation.set(receipt.donationId, receipt);
  }

  const roleLabel = isRole(profile.role) ? ROLE_LABEL[profile.role] : profile.role;

  return (
    <div>
      <PageHeader
        eyebrow="Akaun"
        title="Saya"
        description="Profil, sumbangan, tempahan kelas dan pesanan qurban anda di satu tempat."
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-brand-900 text-base font-semibold text-gold-400">
              {initials(profile.name ?? profile.email)}
            </span>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-brand-950">{profile.name ?? "Pengguna"}</h2>
              <p className="flex items-center gap-1.5 truncate text-xs text-brand-900/55">
                <Mail className="h-3.5 w-3.5" /> {profile.email}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-brand-900/55">
                <Badge tone="info">{roleLabel}</Badge>
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {profile.mosque?.name ?? "Belum dikaitkan dengan masjid"}
                </span>
              </p>
            </div>
          </div>
          <form action={logout}>
            <button type="submit" className="btn-secondary w-full text-xs text-red-600 hover:bg-red-50 sm:w-auto">
              <LogOut className="h-4 w-4" /> Log keluar
            </button>
          </form>
        </div>
        <div className="border-t border-brand-900/5 bg-brand-50/60 px-5 py-3">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-brand-900/60">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-700" />
            Pengguna yang mendaftar melalui Google dimasukkan sebagai <strong>Jemaah</strong> secara lalai. Hubungi
            setiausaha masjid jika anda memerlukan akses pentadbir atau tutor.
          </p>
        </div>
      </Card>

      <div className="mt-8">
        <SectionTitle action={<span className="text-xs text-brand-900/45">{donations.length} rekod</span>}>
          Derma saya
        </SectionTitle>
        <Card>
          {donations.length === 0 ? (
            <EmptyState
              icon={HeartHandshake}
              title="Belum ada derma direkodkan"
              description="Derma yang dibuat dengan e-mel akaun anda akan dipaparkan di sini bersama resit rasmi."
              action={
                <Link href="/jemaah/derma" className="btn-secondary text-xs">
                  Derma sekarang
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarikh</th>
                    <th>Kempen</th>
                    <th className="text-right">Jumlah</th>
                    <th>Status</th>
                    <th>Tarikh bayar</th>
                    <th>Resit</th>
                    <th>TPMJ</th>
                  </tr>
                </thead>
                <tbody>
                  {donations.map((donation) => {
                    const receipt = receiptByDonation.get(donation.id);
                    return (
                      <tr key={donation.id}>
                        <td className="whitespace-nowrap text-xs text-brand-900/60">{tarikh(donation.createdAt)}</td>
                        <td>
                          <p className="text-xs font-medium text-brand-950">
                            {donation.campaign?.title ?? "Tabung am masjid"}
                          </p>
                          <p className="text-[11px] text-brand-900/45">
                            {donation.recurring ? `Berulang · ${label(donation.frequency ?? "BULANAN")}` : "Sekali"}
                            {donation.anonymous ? " · Tanpa nama" : ""}
                          </p>
                        </td>
                        <td className="whitespace-nowrap text-right font-semibold">{rm(donation.amountSen)}</td>
                        <td>
                          <StatusBadge value={donation.status} />
                        </td>
                        <td className="whitespace-nowrap text-xs text-brand-900/60">
                          {donation.paidAt ? tarikh(donation.paidAt) : "—"}
                        </td>
                        <td>
                          {receipt ? (
                            <Link
                              href={`/api/receipts/${receipt.id}`}
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                            >
                              <Download className="h-3 w-3" /> {receipt.number}
                            </Link>
                          ) : donation.status === "DIBAYAR" ? (
                            <span className="text-[11px] text-brand-900/40">Dalam proses</span>
                          ) : (
                            <span className="text-[11px] text-brand-900/30">—</span>
                          )}
                        </td>
                        <td>
                          {donation.tpmjSynced ? (
                            <div>
                              <Badge tone="success">TPMJ</Badge>
                              {donation.tpmjRef && (
                                <p className="mt-1 font-mono text-[10px] text-brand-900/40">{donation.tpmjRef}</p>
                              )}
                            </div>
                          ) : (
                            <Badge tone="neutral">Belum</Badge>
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
      </div>

      <div className="mt-8">
        <SectionTitle
          action={
            <Link href="/jemaah/quran" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
              Tempah kelas
            </Link>
          }
        >
          Tempahan kelas Al-Quran
        </SectionTitle>
        <Card>
          {bookings.length === 0 ? (
            <EmptyState
              icon={BookMarked}
              title="Belum ada tempahan kelas"
              description="Tempahan slot bersama tutor bertauliah masjid akan dipaparkan di sini."
              action={
                <Link href="/jemaah/quran" className="btn-secondary text-xs">
                  Lihat slot tersedia
                </Link>
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tempahan</th>
                    <th>Tutor</th>
                    <th>Slot</th>
                    <th>Pelajar</th>
                    <th>Status</th>
                    <th>Persetujuan</th>
                    <th className="text-right">Jumlah</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings.map((booking) => (
                    <tr key={booking.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{booking.bookingNo}</td>
                      <td className="text-xs">{booking.tutor.name}</td>
                      <td className="whitespace-nowrap text-xs">
                        {tarikh(booking.slot.date)}
                        <span className="block text-[11px] text-brand-900/45">
                          {booking.slot.startTime}–{booking.slot.endTime}
                        </span>
                      </td>
                      <td>
                        <p className="text-xs font-medium text-brand-950">{booking.studentName}</p>
                        <p className="text-[11px] text-brand-900/45">
                          {booking.studentAge} tahun · {booking.studentCount} pelajar · {booking.hours} jam
                        </p>
                      </td>
                      <td>
                        <StatusBadge value={booking.status} />
                        {booking.status === "MENUNGGU_BAYARAN" && (
                          <Link
                            href={`/jemaah/bayar/QURAN_BOOKING/${booking.id}`}
                            className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                          >
                            Bayar <ArrowRight className="h-3 w-3" />
                          </Link>
                        )}
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
                      <td className="whitespace-nowrap text-right font-semibold">{rm(booking.amountSen)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle
          action={
            <Link href="/jemaah/qurban" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
              Tempah qurban
            </Link>
          }
        >
          Pesanan qurban saya
        </SectionTitle>
        <Card>
          {orders.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Belum ada pesanan qurban"
              description="Pesanan bahagian qurban yang dibuat dengan e-mel anda akan dipaparkan di sini."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>No. pesanan</th>
                    <th>Program</th>
                    <th className="text-right">Bahagian</th>
                    <th className="text-right">Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => (
                    <tr key={order.id}>
                      <td className="whitespace-nowrap font-mono text-xs">{order.orderNo}</td>
                      <td className="text-xs">
                        Qurban {order.program.year} · {label(order.program.animal)}
                      </td>
                      <td className="text-right">{order.shares}</td>
                      <td className="whitespace-nowrap text-right font-semibold">{rm(order.amountSen)}</td>
                      <td>
                        <StatusBadge value={order.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-8">
        <SectionTitle>Pemberitahuan terkini</SectionTitle>
        <Card>
          <CardHeader
            title="Pemberitahuan saya"
            description="Lapan pemberitahuan terbaharu daripada masjid dan platform."
            action={<Bell className="h-5 w-5 text-brand-900/30" />}
          />
          {notifications.length === 0 ? (
            <EmptyState
              icon={Bell}
              title="Tiada pemberitahuan"
              description="Pemberitahuan berkenaan derma, tempahan dan pembayaran akan muncul di sini."
            />
          ) : (
            <ul className="divide-y divide-brand-900/5">
              {notifications.map((notification) => (
                <li key={notification.id} className="flex gap-3 px-5 py-4">
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-700/10">
                    <Bell className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{label(notification.channel)}</Badge>
                      <StatusBadge value={notification.status} />
                      <span className="text-[10px] text-brand-900/40">{tarikhMasa(notification.createdAt)}</span>
                    </div>
                    {notification.subject && (
                      <p className="mt-1 text-xs font-semibold text-brand-950">{notification.subject}</p>
                    )}
                    <p className="mt-0.5 text-[11px] leading-relaxed text-brand-900/60">{notification.body}</p>
                    <p className="mt-1 truncate text-[10px] text-brand-900/35">Kepada: {notification.to}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <p className="mt-6 flex items-center gap-1.5 text-[11px] text-brand-900/40">
        <UserRound className="h-3.5 w-3.5" /> Maklumat profil dikemas kini oleh pentadbir masjid. Hubungi setiausaha
        untuk sebarang pembetulan.
      </p>
    </div>
  );
}
