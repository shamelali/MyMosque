import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Clock, Info, Lock, ShieldCheck, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { LOCK_MINUTES, priceFor, tierMultiplier } from "@/lib/quran";
import { rm, tarikh } from "@/lib/utils";
import { bookClass } from "../../actions";

export const metadata: Metadata = { title: "Tempah Kelas Al-Quran" };

const dayFmt = new Intl.DateTimeFormat("ms-MY", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default async function TempahSlotPage({
  params,
  searchParams,
}: {
  params: Promise<{ slotId: string }>;
  searchParams: Promise<{ ralat?: string }>;
}) {
  const user = await requirePageUser();
  const { slotId } = await params;
  const { ralat } = await searchParams;

  const slot = await prisma.quranSlot.findUnique({
    where: { id: slotId },
    include: { tutor: true, lock: true },
  });

  if (!slot) {
    return (
      <div>
        <PageHeader
          eyebrow="Kelas Al-Quran"
          title="Tempah kelas"
          back={{ href: "/jemaah/quran", label: "Kembali ke senarai tutor" }}
        />
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="Slot tidak dijumpai"
            description="Slot ini mungkin telah dipadamkan oleh tutor. Sila pilih slot lain."
            action={
              <Link href="/jemaah/quran" className="btn-primary">
                Pilih slot lain
              </Link>
            }
          />
        </Card>
      </div>
    );
  }

  const now = new Date();
  const [startHour, startMinute] = slot.startTime.split(":").map(Number);
  const slotStart = new Date(slot.date);
  slotStart.setHours(startHour || 0, startMinute || 0, 0, 0);
  const lockHeld = Boolean(slot.lock && slot.lock.expiresAt > now);
  const unavailable =
    slot.status === "DITEMPAH"
      ? "Slot ini telah ditempah oleh keluarga lain. Sila pilih slot yang lain."
      : slot.status === "DITUTUP"
        ? "Slot ini telah ditutup oleh tutor."
        : slotStart.getTime() < now.getTime()
          ? "Slot ini telah berlalu. Sila pilih slot yang lain."
          : slot.status === "DIKUNCI" && lockHeld
            ? "Slot ini sedang dipegang oleh pemohon lain untuk beberapa minit. Sila pilih slot lain."
            : !slot.tutor.verified
              ? "Tutor ini belum disahkan oleh masjid dan belum boleh menerima tempahan."
              : slot.tutor.status !== "AKTIF"
                ? "Tutor ini sedang digantung dan tidak menerima tempahan buat masa ini."
                : null;

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, phone: true },
  });

  const tutor = slot.tutor;
  const studentCounts = [1, 2, 3];
  const hourOptions = [1, 2, 3];
  const priceRows = hourOptions.map((hours) => ({
    hours,
    prices: studentCounts.map((studentCount) =>
      priceFor({ hourlyRateSen: tutor.hourlyRateSen, hours, studentCount }),
    ),
  }));

  return (
    <div>
      <PageHeader
        eyebrow="Kelas Al-Quran"
        title="Tempah kelas"
        description={`${tutor.name} · ${dayFmt.format(slot.date)}`}
        back={{ href: "/jemaah/quran", label: "Kembali ke senarai tutor" }}
      />

      {ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {ralat}
        </p>
      )}

      {unavailable ? (
        <Card>
          <EmptyState
            icon={CalendarDays}
            title="Slot tidak tersedia"
            description={unavailable}
            action={
              <Link href="/jemaah/quran" className="btn-primary">
                Pilih slot lain
              </Link>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              title="Butiran tempahan"
              description="Isi maklumat pelajar dan penjaga. Medan bertanda * wajib diisi."
            />
            <form action={bookClass} className="grid gap-4 p-5 sm:grid-cols-2">
              <input type="hidden" name="slotId" value={slot.id} />

              <div>
                <label className="label" htmlFor="hours">Tempoh *</label>
                <select id="hours" name="hours" required defaultValue="1" className="input">
                  {hourOptions.map((hours) => (
                    <option key={hours} value={hours}>
                      {hours} jam — {rm(priceFor({ hourlyRateSen: tutor.hourlyRateSen, hours, studentCount: 1 }))} (1 pelajar)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="studentCount">Bilangan pelajar *</label>
                <select id="studentCount" name="studentCount" required defaultValue="1" className="input">
                  {studentCounts.map((count) => (
                    <option key={count} value={count}>
                      {count} pelajar · {Math.round(tierMultiplier(count) * 100)}%
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label" htmlFor="studentName">Nama pelajar *</label>
                <input id="studentName" name="studentName" required placeholder="Contoh: Muhammad Danial" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="studentAge">Umur pelajar *</label>
                <input
                  id="studentAge"
                  name="studentAge"
                  type="number"
                  min="1"
                  max="99"
                  required
                  placeholder="9"
                  className="input"
                />
              </div>

              <div className="sm:col-span-2">
                <SectionTitle>Maklumat ibu bapa / penjaga</SectionTitle>
              </div>
              <div>
                <label className="label" htmlFor="parentName">Nama penjaga *</label>
                <input
                  id="parentName"
                  name="parentName"
                  required
                  defaultValue={profile?.name ?? user.name ?? ""}
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="parentPhone">No. telefon</label>
                <input
                  id="parentPhone"
                  name="parentPhone"
                  type="tel"
                  defaultValue={profile?.phone ?? ""}
                  placeholder="012-345 6789"
                  className="input"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="parentEmail">E-mel *</label>
                <input
                  id="parentEmail"
                  name="parentEmail"
                  type="email"
                  required
                  defaultValue={profile?.email ?? user.email ?? ""}
                  className="input"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="flex items-start gap-2 rounded-lg bg-brand-50 px-3 py-3 text-xs text-brand-900/75 ring-1 ring-inset ring-brand-700/10">
                  <input
                    type="checkbox"
                    name="guardianConsent"
                    className="mt-0.5 h-4 w-4 rounded border-brand-900/20 text-brand-700 focus:ring-brand-600"
                  />
                  <span>
                    Saya adalah ibu bapa atau penjaga sah dan bersetuju dengan sesi kelas ini.
                    <span className="block text-[11px] text-brand-900/50">
                      Wajib ditanda untuk pelajar bawah 18 tahun. Persetujuan direkod bersama rujukan.
                    </span>
                  </span>
                </label>
              </div>

              <div className="sm:col-span-2">
                <button type="submit" className="btn-primary w-full sm:w-auto">
                  <Lock className="h-4 w-4" /> Kunci slot & teruskan bayaran
                </button>
                <p className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-900/45">
                  <Info className="h-3.5 w-3.5" /> Slot dikunci selama {LOCK_MINUTES} minit untuk anda menyelesaikan
                  bayaran. Harga akhir dikira semula oleh sistem.
                </p>
              </div>
            </form>
          </Card>

          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-600">Ringkasan slot</p>
                  <h3 className="mt-1 text-sm font-semibold text-brand-950">{tutor.name}</h3>
                  <p className="text-[11px] text-brand-900/50">
                    {tutor.gender === "PEREMPUAN" ? "Ustazah" : "Ustaz"} · {tutor.tauliahNo}
                  </p>
                </div>
                <Badge tone="success">
                  <ShieldCheck className="mr-1 h-3 w-3" /> Disahkan
                </Badge>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-brand-900/65">
                <p className="flex items-center gap-1.5">
                  <CalendarDays className="h-3.5 w-3.5" /> {tarikh(slot.date)} · {dayFmt.format(slot.date)}
                </p>
                <p className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" /> {slot.startTime}–{slot.endTime}
                </p>
                <p className="flex items-center gap-1.5">
                  <UserRound className="h-3.5 w-3.5" /> Kadar sejam: <strong>{rm(tutor.hourlyRateSen)}</strong>
                </p>
              </div>
              {tutor.bio && (
                <p className="mt-3 border-t border-brand-900/5 pt-3 text-[11px] leading-relaxed text-brand-900/55">
                  {tutor.bio}
                </p>
              )}
            </Card>

            <Card className="p-5">
              <h3 className="text-sm font-semibold text-brand-950">Jadual harga</h3>
              <p className="mt-0.5 text-[11px] text-brand-900/50">
                Kadar sejam {rm(tutor.hourlyRateSen)} sebelum pengganda bilangan pelajar.
              </p>
              <div className="table-wrap mt-3">
                <table className="data-table !min-w-0">
                  <thead>
                    <tr>
                      <th>Tempoh</th>
                      {studentCounts.map((count) => (
                        <th key={count} className="text-right">
                          {count} pelajar
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {priceRows.map((row) => (
                      <tr key={row.hours}>
                        <td className="whitespace-nowrap text-xs font-medium">{row.hours} jam</td>
                        {row.prices.map((price, index) => (
                          <td key={studentCounts[index]} className="whitespace-nowrap text-right text-xs">
                            {rm(price)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-brand-900/45">
                Pengganda: 1 pelajar 100%, 2 pelajar 150%, 3 pelajar 180%.
              </p>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
