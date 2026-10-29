import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Beef,
  BookMarked,
  CalendarDays,
  Clock,
  GraduationCap,
  HeartHandshake,
  MapPin,
  ReceiptText,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { percent, rm, tarikh, tarikhMasa } from "@/lib/utils";

export const metadata: Metadata = { title: "Utama" };

const QUICK_ACTIONS = [
  { href: "/jemaah/derma", title: "Derma", hint: "Infaq & kempen", icon: HeartHandshake },
  { href: "/jemaah/qurban", title: "Qurban", hint: "Tempah bahagian", icon: Beef },
  { href: "/jemaah/quran", title: "Kelas Al-Quran", hint: "Tempah slot tutor", icon: BookMarked },
  { href: "#kuliah", title: "Program Masjid", hint: "Kuliah & ceramah", icon: GraduationCap },
];

function slotStart(date: Date, time: string) {
  const [hour, minute] = time.split(":").map(Number);
  const start = new Date(date);
  start.setHours(hour || 0, minute || 0, 0, 0);
  return start;
}

export default async function JemaahHomePage() {
  const user = await requirePageUser();
  const email = user.email ?? "";

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const mosque = user.mosqueId
    ? await prisma.mosque.findUnique({
        where: { id: user.mosqueId },
        select: { id: true, name: true, district: true },
      })
    : await prisma.mosque.findFirst({
        orderBy: { name: "asc" },
        select: { id: true, name: true, district: true },
      });

  const mosqueId = mosque?.id ?? "__tiada_masjid__";
  const nameKey = email || "__tiada_emel__";

  const [campaigns, programs, bookingCandidates, latestDonation] = await Promise.all([
    prisma.campaign.findMany({
      where: { mosqueId, status: "AKTIF" },
      orderBy: { startDate: "desc" },
      take: 3,
    }),
    prisma.kuliahProgram.findMany({
      where: { mosqueId, status: { in: ["SAH", "DIRANCANG"] }, date: { gte: startOfToday } },
      include: { speaker: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
      take: 3,
    }),
    prisma.quranBooking.findMany({
      where: {
        parentEmail: nameKey,
        status: { in: ["DISAHKAN", "MENUNGGU_BAYARAN"] },
        slot: { date: { gte: startOfToday } },
      },
      include: { tutor: { select: { name: true } }, slot: true },
      orderBy: [{ slot: { date: "asc" } }, { slot: { startTime: "asc" } }],
      take: 6,
    }),
    prisma.donation.findFirst({
      where: { donorEmail: nameKey },
      include: { campaign: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const nextBooking =
    bookingCandidates.find((booking) => slotStart(booking.slot.date, booking.slot.startTime) >= now) ??
    bookingCandidates[0] ??
    null;

  const latestReceipt = latestDonation
    ? await prisma.receipt.findFirst({
        where: { donationId: latestDonation.id },
        select: { id: true, number: true },
      })
    : null;

  const firstName = (user.name ?? "Jemaah").trim().split(/\s+/)[0] || "Jemaah";

  return (
    <div>
      <PageHeader
        eyebrow="Aplikasi Jemaah"
        title={`Assalamualaikum, ${firstName}`}
        description={`Selamat datang ke ${mosque?.name ?? "masjid anda"}. Semoga setiap amal dipermudah dan diberkati.`}
      />

      <section className="overflow-hidden rounded-2xl bg-brand-900 px-5 py-6 text-white shadow-card sm:px-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-xl">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-gold-400">
              <MapPin className="h-3.5 w-3.5" /> {mosque?.name ?? "Masjid anda"}
            </p>
            <p className="mt-2 text-lg font-semibold leading-snug sm:text-xl">
              Derma, qurban dan kelas Al-Quran — semuanya di hujung jari.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-white/60">
              {mosque?.district ? `Daerah ${mosque.district}. ` : ""}
              Setiap bayaran diselesaikan terus kepada masjid atau tutor yang berkenaan.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/jemaah/derma" className="btn-gold text-xs">
              Derma sekarang <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/jemaah/saya" className="btn bg-white/10 text-xs text-white ring-1 ring-inset ring-white/15 hover:bg-white/15">
              Akaun saya <UserRound className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.href}
              href={action.href}
              className="card group flex flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:shadow-lg"
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-700/10">
                <Icon className="h-5 w-5" />
              </span>
              <span>
                <span className="block text-sm font-semibold text-brand-950">{action.title}</span>
                <span className="block text-[11px] text-brand-900/50">{action.hint}</span>
              </span>
              <span className="mt-auto inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 group-hover:text-brand-900">
                Buka <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        <SectionTitle
          action={
            <Link href="/jemaah/derma" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
              Semua kempen
            </Link>
          }
        >
          Kempen pilihan
        </SectionTitle>
        {campaigns.length === 0 ? (
          <Card>
            <EmptyState
              icon={HeartHandshake}
              title="Tiada kempen aktif buat masa ini"
              description="Masjid sedang menyediakan kempen baharu. Sila kembali semula tidak lama lagi."
              action={
                <Link href="/jemaah/derma" className="btn-secondary text-xs">
                  Lihat tabung derma
                </Link>
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {campaigns.map((campaign) => {
              const progress = percent(campaign.raisedSen, campaign.targetSen);
              return (
                <Card key={campaign.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold leading-snug text-brand-950">{campaign.title}</h3>
                    <StatusBadge value={campaign.status} />
                  </div>
                  {campaign.description && (
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-brand-900/60">{campaign.description}</p>
                  )}
                  <div className="mt-4">
                    <div className="flex items-end justify-between">
                      <p className="text-lg font-semibold text-brand-950">{rm(campaign.raisedSen)}</p>
                      <p className="text-[11px] text-brand-900/50">sasaran {rm(campaign.targetSen)}</p>
                    </div>
                    <Progress value={progress} className="mt-2" />
                    <div className="mt-1 flex items-center justify-between text-[11px] text-brand-900/50">
                      <span>{progress}% dicapai</span>
                      <span>Hingga {tarikh(campaign.endDate)}</span>
                    </div>
                  </div>
                  <Link href={`/jemaah/derma?kempen=${campaign.id}#borang-derma`} className="btn-primary mt-4 w-full text-xs">
                    Derma sekarang <ArrowRight className="h-4 w-4" />
                  </Link>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div id="kuliah" className="scroll-mt-20">
        <Card>
          <CardHeader
            title="Jadual kuliah akan datang"
            description={mosque ? `Program di ${mosque.name}` : "Program masjid terdekat"}
            action={<CalendarDays className="h-5 w-5 text-brand-900/30" />}
          />
          {programs.length === 0 ? (
            <EmptyState
              icon={GraduationCap}
              title="Belum ada program dijadualkan"
              description="Jadual kuliah dan ceramah akan dipaparkan di sini apabila disahkan oleh masjid."
            />
          ) : (
            <ul className="divide-y divide-brand-900/5">
              {programs.map((program) => (
                <li key={program.id} className="flex gap-3 px-5 py-4">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-700/10">
                    <span className="text-base font-semibold leading-none">{new Date(program.date).getDate()}</span>
                    <span className="mt-0.5 text-[10px] uppercase tracking-wide">
                      {new Intl.DateTimeFormat("ms-MY", { month: "short" }).format(new Date(program.date))}
                    </span>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-brand-950">{program.title}</p>
                      <StatusBadge value={program.status} />
                    </div>
                    <p className="mt-0.5 text-[11px] text-brand-900/55">
                      {label(program.type)} · {program.startTime}
                      {program.endTime ? `–${program.endTime}` : ""}
                      {program.location ? ` · ${program.location}` : ""}
                    </p>
                    <p className="mt-1 text-[11px] text-brand-900/45">
                      Bersama {program.speaker?.name ?? "penceramah akan diumumkan"}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Tempahan kelas saya"
              description="Slot kelas Al-Quran yang akan datang."
              action={<BookMarked className="h-5 w-5 text-brand-900/30" />}
            />
            {!nextBooking ? (
              <EmptyState
                icon={BookMarked}
                title="Tiada tempahan akan datang"
                description="Tempah slot kelas Al-Quran bersama tutor bertauliah masjid."
                action={
                  <Link href="/jemaah/quran" className="btn-secondary text-xs">
                    Cari slot kelas
                  </Link>
                }
              />
            ) : (
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-brand-950">{nextBooking.studentName}</p>
                    <p className="text-[11px] text-brand-900/50">bersama {nextBooking.tutor.name}</p>
                  </div>
                  <StatusBadge value={nextBooking.status} />
                </div>
                <p className="mt-3 flex items-center gap-1.5 text-xs text-brand-900/70">
                  <CalendarDays className="h-3.5 w-3.5 text-brand-900/40" /> {tarikh(nextBooking.slot.date)}
                  <span className="text-brand-900/25">·</span>
                  <Clock className="h-3.5 w-3.5 text-brand-900/40" /> {nextBooking.slot.startTime}–{nextBooking.slot.endTime}
                </p>
                <div className="mt-3 flex items-center justify-between border-t border-brand-900/5 pt-3">
                  <span className="text-xs text-brand-900/50">{nextBooking.bookingNo}</span>
                  <span className="text-sm font-semibold text-brand-950">{rm(nextBooking.amountSen)}</span>
                </div>
                {nextBooking.status === "MENUNGGU_BAYARAN" ? (
                  <Link
                    href={`/jemaah/bayar/QURAN_BOOKING/${nextBooking.id}`}
                    className="btn-primary mt-3 w-full text-xs"
                  >
                    Selesaikan bayaran <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : (
                  <Link href="/jemaah/saya" className="btn-secondary mt-3 w-full text-xs">
                    Lihat butiran <ArrowRight className="h-4 w-4" />
                  </Link>
                )}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Derma terakhir"
              description="Status sumbangan terkini dengan e-mel akaun anda."
              action={<Wallet className="h-5 w-5 text-brand-900/30" />}
            />
            {!latestDonation ? (
              <EmptyState
                icon={ReceiptText}
                title="Belum ada derma direkodkan"
                description="Selepas anda menderma, status dan resit akan muncul di sini."
                action={
                  <Link href="/jemaah/derma" className="btn-secondary text-xs">
                    Buat derma
                  </Link>
                }
              />
            ) : (
              <div className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-950">
                      {latestDonation.campaign?.title ?? "Tabung am masjid"}
                    </p>
                    <p className="text-[11px] text-brand-900/50">{tarikhMasa(latestDonation.createdAt)}</p>
                  </div>
                  <StatusBadge value={latestDonation.status} />
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-brand-900/5 pt-3">
                  <span className="text-xs text-brand-900/50">
                    {latestDonation.tpmjSynced ? "Diselaraskan TPMJ" : "Rekod masjid"}
                  </span>
                  <span className="text-sm font-semibold text-brand-950">{rm(latestDonation.amountSen)}</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {latestDonation.status === "DIBAYAR" && latestReceipt ? (
                    <Link href={`/api/receipts/${latestReceipt.id}`} className="btn-secondary flex-1 text-xs">
                      <ReceiptText className="h-3.5 w-3.5" /> Resit {latestReceipt.number}
                    </Link>
                  ) : latestDonation.status === "MENUNGGU" ? (
                    <Link
                      href={`/jemaah/bayar/DONATION/${latestDonation.id}`}
                      className="btn-primary flex-1 text-xs"
                    >
                      Bayar sekarang <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : null}
                  <Link href="/jemaah/saya" className="btn-ghost text-xs">
                    Sejarah
                  </Link>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-3 rounded-2xl bg-brand-50 px-5 py-4 ring-1 ring-inset ring-brand-700/10 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-brand-700 ring-1 ring-inset ring-brand-700/10">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold text-brand-950">Bayaran diagihkan terus ke masjid / tutor</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-brand-900/55">
              Dana diselesaikan melalui split settlement — platform tidak memegang wang jemaah. Komisen hanya
              dipotong pada sumber.
            </p>
          </div>
        </div>
        <Link href="/jemaah/saya" className="btn-secondary shrink-0 text-xs">
          Akaun & sejarah saya <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <p className="mt-4 flex items-center gap-1.5 text-[11px] text-brand-900/40">
        <Badge tone="neutral">Demo</Badge> Data dipaparkan untuk tujuan demonstrasi SPMJ.
      </p>
    </div>
  );
}
