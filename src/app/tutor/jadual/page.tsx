import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  CalendarPlus,
  CheckCircle2,
  Clock,
  Info,
  Lock,
  Plus,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { requireTutor, startOfDay, addDays } from "../_lib";
import { createSlots, toggleSlot } from "./actions";

export const metadata: Metadata = { title: "Jadual Slot" };

const TIMES = ["09:00", "10:30", "14:00", "16:00", "20:00"];
const dayFmt = new Intl.DateTimeFormat("ms-MY", { weekday: "long", day: "numeric", month: "long" });

function dayKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function TutorJadualPage({
  searchParams,
}: {
  searchParams: Promise<{ ralat?: string; maklum?: string }>;
}) {
  const { tutor } = await requireTutor();
  const params = await searchParams;

  const today = startOfDay();
  const end = addDays(today, 14);

  const slots = await prisma.quranSlot.findMany({
    where: { tutorId: tutor.id, date: { gte: today, lt: end } },
    include: { booking: { select: { studentName: true, status: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const openCount = slots.filter((slot) => slot.status === "TERBUKA").length;
  const bookedCount = slots.filter((slot) => slot.status === "DITEMPAH").length;
  const closedCount = slots.filter((slot) => slot.status === "DITUTUP" || slot.status === "DIKUNCI").length;

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = addDays(today, index);
    const key = dayKey(date);
    return {
      date,
      key,
      label: dayFmt.format(date),
      isToday: index === 0,
      items: slots.filter((slot) => dayKey(slot.date) === key),
    };
  });

  const todayInput = dayKey(today);
  const maxInput = dayKey(addDays(today, 13));

  return (
    <div>
      <PageHeader
        eyebrow="Aplikasi Tutor"
        title="Jadual slot"
        description="Buka slot kelas untuk 14 hari akan datang. Ibu bapa hanya melihat slot yang terbuka."
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

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Slot terbuka" value={openCount} hint="14 hari akan datang" icon={CheckCircle2} />
        <Stat label="Slot ditempah" value={bookedCount} hint="Kelas disahkan / menunggu bayaran" icon={CalendarDays} />
        <Stat label="Ditutup / dikunci" value={closedCount} hint="Tidak boleh ditempah" icon={Lock} />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Tambah slot baharu"
          description="Pilih tarikh dan masa. Slot yang sudah wujud akan dilangkau secara automatik."
          action={<CalendarPlus className="h-5 w-5 text-brand-900/30" />}
        />
        <form action={createSlots} className="grid gap-4 p-5 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto] sm:items-end">
          <div>
            <label className="label" htmlFor="slotDate">Tarikh *</label>
            <input
              id="slotDate"
              name="date"
              type="date"
              required
              min={todayInput}
              max={maxInput}
              defaultValue={todayInput}
              className="input"
            />
          </div>
          <div>
            <span className="label">Masa slot *</span>
            <div className="flex flex-wrap gap-2">
              {TIMES.map((time) => (
                <label
                  key={time}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-medium text-brand-900/75 ring-1 ring-inset ring-brand-900/15 transition has-[:checked]:bg-brand-50 has-[:checked]:text-brand-900 has-[:checked]:ring-brand-700/30"
                >
                  <input
                    type="checkbox"
                    name="times"
                    value={time}
                    className="h-3.5 w-3.5 rounded border-brand-900/20 text-brand-700 focus:ring-brand-600"
                  />
                  {time}
                </label>
              ))}
            </div>
          </div>
          <button type="submit" className="btn-primary text-xs">
            <Plus className="h-4 w-4" /> Tambah slot
          </button>
        </form>
        <p className="flex items-start gap-1.5 border-t border-brand-900/5 px-5 py-3 text-[11px] text-brand-900/45">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Slot ditetapkan selama 1 jam. Slot yang ditempah (DITEMPAH) atau dikunci (DIKUNCI) semasa pembayaran tidak
          boleh ditutup atau dibuka semula.
        </p>
      </Card>

      <div className="mt-6">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-900/50">
            Jadual 14 hari akan datang
          </h2>
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="success">Terbuka</Badge>
            <Badge tone="success">Ditempah</Badge>
            <Badge tone="warning">Dikunci</Badge>
            <Badge tone="neutral">Ditutup</Badge>
          </div>
        </div>

        {slots.length === 0 ? (
          <Card>
            <EmptyState
              icon={CalendarDays}
              title="Belum ada slot untuk 14 hari akan datang"
              description="Gunakan borang di atas untuk membuka slot kelas anda. Jemaah akan melihatnya di halaman Kelas Al-Quran."
            />
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {days.map((day) => (
              <Card key={day.key} className={cn("p-4", day.items.length === 0 && "opacity-70")}>
                <div className="flex items-center justify-between gap-2 border-b border-brand-900/5 pb-2.5">
                  <div>
                    <p className="text-xs font-semibold text-brand-950">{day.label}</p>
                    <p className="text-[10px] uppercase tracking-wide text-brand-900/40">
                      {day.isToday ? "Hari ini" : `${day.items.length} slot`}
                    </p>
                  </div>
                  {day.items.length > 0 && (
                    <span className="text-[11px] font-medium text-brand-900/45">{day.items.length} slot</span>
                  )}
                </div>

                {day.items.length === 0 ? (
                  <p className="pt-3 text-[11px] text-brand-900/35">Tiada slot dibuka.</p>
                ) : (
                  <ul className="mt-3 space-y-2">
                    {day.items.map((slot) => {
                      const locked = slot.status === "DITEMPAH" || slot.status === "DIKUNCI";
                      return (
                        <li
                          key={slot.id}
                          className={cn(
                            "flex flex-wrap items-center gap-2 rounded-lg px-2.5 py-2 ring-1 ring-inset",
                            slot.status === "TERBUKA" && "bg-emerald-50/50 ring-emerald-600/10",
                            slot.status === "DITEMPAH" && "bg-brand-50 ring-brand-700/10",
                            slot.status === "DIKUNCI" && "bg-amber-50/60 ring-amber-600/15",
                            slot.status === "DITUTUP" && "bg-sand ring-brand-900/5",
                          )}
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-brand-900/35" />
                            <span className="text-xs font-semibold text-brand-950">
                              {slot.startTime}–{slot.endTime}
                            </span>
                            {slot.booking && (
                              <span className="truncate text-[11px] text-brand-900/50">· {slot.booking.studentName}</span>
                            )}
                            {slot.status === "DIKUNCI" && (
                              <span className="text-[10px] text-amber-700">· sedang dipegang</span>
                            )}
                          </div>

                          <Badge
                            tone={
                              slot.status === "TERBUKA"
                                ? "success"
                                : slot.status === "DITEMPAH"
                                  ? "success"
                                  : slot.status === "DIKUNCI"
                                    ? "warning"
                                    : "neutral"
                            }
                          >
                            {slot.status === "TERBUKA"
                              ? "Terbuka"
                              : slot.status === "DITEMPAH"
                                ? "Ditempah"
                                : slot.status === "DIKUNCI"
                                  ? "Dikunci"
                                  : "Ditutup"}
                          </Badge>

                          {locked ? (
                            <Lock className="h-3.5 w-3.5 text-brand-900/25" />
                          ) : (
                            <form action={toggleSlot}>
                              <input type="hidden" name="id" value={slot.id} />
                              <button
                                type="submit"
                                className={
                                  slot.status === "TERBUKA"
                                    ? "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-red-600 hover:bg-red-50"
                                    : "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-brand-700 hover:bg-brand-50"
                                }
                              >
                                {slot.status === "TERBUKA" ? (
                                  <>
                                    <XCircle className="h-3 w-3" /> Tutup
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" /> Buka semula
                                  </>
                                )}
                              </button>
                            </form>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>

      <p className="mt-6 flex items-start gap-1.5 text-[11px] text-brand-900/45">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Slot yang ditempah oleh ibu bapa akan ditandakan dengan nama pelajar. Anda boleh menghubungi ibu bapa melalui
        halaman Tempahan jika perlu menyusun semula kelas.
      </p>
    </div>
  );
}
