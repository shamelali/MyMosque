import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck, BookMarked, CalendarDays, Clock, GraduationCap, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { rm } from "@/lib/utils";

export const metadata: Metadata = { title: "Kelas Al-Quran" };

const dayFmt = new Intl.DateTimeFormat("ms-MY", { weekday: "long", day: "numeric", month: "long" });

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function JemaahQuranPage() {
  const user = await requirePageUser();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfWeek = new Date(startOfToday.getTime() + 7 * 86_400_000);

  const tutors = await prisma.tutor.findMany({
    where: {
      verified: true,
      status: "AKTIF",
      ...(user.mosqueId ? { mosqueId: user.mosqueId } : {}),
    },
    orderBy: { name: "asc" },
  });

  const slotRows = await prisma.quranSlot.findMany({
    where: {
      tutorId: { in: tutors.map((tutor) => tutor.id) },
      status: "TERBUKA",
      date: { gte: startOfToday, lt: endOfWeek },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });
  const slots = slotRows.filter((slot) => {
    const [hour, minute] = slot.startTime.split(":").map(Number);
    const start = new Date(slot.date);
    start.setHours(hour || 0, minute || 0, 0, 0);
    return start.getTime() >= now.getTime();
  });

  const groups = tutors.map((tutor) => {
    const own = slots.filter((slot) => slot.tutorId === tutor.id);
    const days: { key: string; label: string; items: typeof own }[] = [];
    for (const slot of own) {
      const key = dayKey(slot.date);
      const existing = days.find((day) => day.key === key);
      if (existing) {
        existing.items.push(slot);
      } else {
        days.push({ key, label: dayFmt.format(slot.date), items: [slot] });
      }
    }
    return { tutor, days };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Jemaah"
        title="Kelas Al-Quran"
        description="Pilih ustaz atau ustazah bertauliah dan tempah slot kelas untuk anak anda atau diri sendiri."
      />

      <div className="mb-5 rounded-xl bg-brand-50 px-4 py-3 ring-1 ring-inset ring-brand-700/10">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-900">
          <Info className="h-3.5 w-3.5" /> Bagaimana harga dikira
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-brand-900/60">
          Kadar sejam tutor didarab dengan bilangan pelajar: <strong>1 pelajar 100%</strong>,{" "}
          <strong>2 pelajar 150%</strong>, <strong>3 pelajar atau lebih 180%</strong>. Harga penuh dipaparkan pada
          halaman tempahan sebelum anda bayar.
        </p>
      </div>

      <SectionTitle
        action={<span className="text-xs text-brand-900/45">{slots.length} slot tersedia</span>}
      >
        Tutor bertauliah
      </SectionTitle>

      {groups.length === 0 ? (
        <Card>
          <EmptyState
            icon={BookMarked}
            title="Belum ada tutor disahkan"
            description="Masjid sedang mengesahkan tauliah tutor. Sila kembali semula tidak lama lagi."
          />
        </Card>
      ) : (
        <div className="space-y-4">
          {groups.map(({ tutor, days }) => (
            <Card key={tutor.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">{tutor.name}</h3>
                    <Badge tone="success">
                      <BadgeCheck className="mr-1 h-3 w-3" /> Tauliah disahkan
                    </Badge>
                  </div>
                  <p className="mt-0.5 text-[11px] text-brand-900/45">
                    {tutor.gender === "PEREMPUAN" ? "Ustazah" : "Ustaz"} · Tauliah {tutor.tauliahNo}
                  </p>
                  {tutor.bio && <p className="mt-2 max-w-2xl text-xs leading-relaxed text-brand-900/60">{tutor.bio}</p>}
                </div>
                <div className="text-right">
                  <p className="text-lg font-semibold text-brand-950">{rm(tutor.hourlyRateSen)}</p>
                  <p className="text-[11px] text-brand-900/45">sejam · 1 pelajar</p>
                </div>
              </div>

              <div className="mt-4 border-t border-brand-900/5 pt-4">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-900/50">
                  <CalendarDays className="h-3.5 w-3.5" /> Slot 7 hari akan datang
                </p>
                {days.length === 0 ? (
                  <p className="text-xs text-brand-900/45">
                    Tiada slot terbuka buat masa ini. Sila hubungi masjid untuk jadual tambahan.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {days.map((day) => (
                      <div key={day.key}>
                        <p className="text-[11px] font-semibold text-brand-900/60">{day.label}</p>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {day.items.map((slot) => (
                            <Link
                              key={slot.id}
                              href={`/jemaah/quran/tempah/${slot.id}`}
                              className="inline-flex items-center gap-1 rounded-lg bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-inset ring-brand-700/10 transition hover:bg-brand-100"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              {slot.startTime}–{slot.endTime}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 flex items-start gap-2 rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-800 ring-1 ring-inset ring-sky-600/15">
        <GraduationCap className="mt-0.5 h-4 w-4 shrink-0" />
        Pelajar bawah 18 tahun memerlukan pengesahan persetujuan penjaga semasa tempahan. Slot akan dikunci selama 10
        minit semasa anda menyelesaikan bayaran.
      </p>
    </div>
  );
}
