import type { Metadata } from "next";
import {
  AlertTriangle,
  BadgeCheck,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  MapPin,
  Plus,
  UserRound,
  Users,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle, Tabs } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { tarikh } from "@/lib/utils";
import { addSpeaker, createProgram, recordAttendance, setProgramStatus } from "./actions";

export const metadata: Metadata = { title: "Kuliah & Program" };

const TABS = [
  { key: "program", label: "Program" },
  { key: "penceramah", label: "Penceramah" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

const MONTH_SHORT = ["Jan", "Feb", "Mac", "Apr", "Mei", "Jun", "Jul", "Ogos", "Sep", "Okt", "Nov", "Dis"];
const PROGRAM_TYPES = ["KULIAH_MAGHRIB", "CERAMAH", "KELAS_QURAN", "PROGRAM"];

export default async function KuliahPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ralat?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const { tab: rawTab, ralat } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "program";

  const [programs, speakers] = await Promise.all([
    prisma.kuliahProgram.findMany({
      where: { mosqueId: mosque.id },
      include: { speaker: true, _count: { select: { attendance: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.speaker.findMany({ orderBy: { name: "asc" } }),
  ]);

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const upcoming = programs
    .filter((program) => program.date >= startOfToday && !["SELESAI", "DIBATAL"].includes(program.status))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
  const past = programs.filter((program) => !upcoming.some((item) => item.id === program.id));

  const latestProgram = programs.find((program) => program._count.attendance > 0) ?? programs[0] ?? null;
  const recentAttendance = latestProgram
    ? await prisma.attendance.findMany({
        where: { programId: latestProgram.id },
        orderBy: { checkedIn: "desc" },
        take: 10,
      })
    : [];

  const canManage = ["KETUA", "SETIAUSAHA", "AJK"].includes(user.role);
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <PageHeader
        eyebrow="Tadbir urus"
        title="Kuliah & Program"
        description="Jadual kuliah, ceramah dan kelas Al-Quran serta rekod kehadiran jemaah."
      />

      {ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {ralat}
        </p>
      )}

      <Tabs
        active={`/portal/kuliah?tab=${tab}`}
        items={TABS.map((t) => ({
          href: `/portal/kuliah?tab=${t.key}`,
          label: t.label,
          count: t.key === "program" ? upcoming.length : speakers.length,
        }))}
      />

      {tab === "program" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="space-y-6">
            <section>
              <SectionTitle>Akan datang</SectionTitle>
              {upcoming.length === 0 ? (
                <Card>
                  <EmptyState
                    icon={CalendarDays}
                    title="Tiada program akan datang"
                    description="Jadualkan kuliah atau ceramah baharu menggunakan borang di sebelah."
                  />
                </Card>
              ) : (
                <div className="space-y-3">
                  {upcoming.map((program) => (
                    <ProgramCard
                      key={program.id}
                      program={program}
                      canManage={canManage}
                      now={now}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <SectionTitle>Lepas & dibatalkan</SectionTitle>
              {past.length === 0 ? (
                <Card>
                  <EmptyState icon={BookOpen} title="Tiada rekod program lepas" />
                </Card>
              ) : (
                <div className="space-y-3">
                  {past.map((program) => (
                    <ProgramCard
                      key={program.id}
                      program={program}
                      canManage={canManage}
                      now={now}
                    />
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="space-y-6">
            {canManage ? (
              <Card>
                <CardHeader title="Tambah program" description="Program baharu bermula sebagai dirancang." />
                <form action={createProgram} className="space-y-3 p-5">
                  <div>
                    <label className="label" htmlFor="programTitle">Tajuk program</label>
                    <input id="programTitle" name="title" required placeholder="Contoh: Kuliah Maghrib" className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="programType">Jenis</label>
                    <select id="programType" name="type" className="input" defaultValue="KULIAH_MAGHRIB">
                      {PROGRAM_TYPES.map((type) => (
                        <option key={type} value={type}>{label(type)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="programSpeaker">Penceramah</label>
                    <select id="programSpeaker" name="speakerId" className="input" defaultValue="">
                      <option value="">Tiada penceramah</option>
                      {speakers.map((speaker) => (
                        <option key={speaker.id} value={speaker.id}>{speaker.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="programDate">Tarikh</label>
                    <input id="programDate" name="date" type="date" required defaultValue={todayValue} className="input" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label" htmlFor="programStart">Masa mula</label>
                      <input id="programStart" name="startTime" type="time" required defaultValue="18:45" className="input" />
                    </div>
                    <div>
                      <label className="label" htmlFor="programEnd">Masa tamat</label>
                      <input id="programEnd" name="endTime" type="time" defaultValue="19:30" className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="programLocation">Lokasi</label>
                    <input id="programLocation" name="location" placeholder="Dewan Solat Utama" className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="programCapacity">Kapasiti</label>
                    <input id="programCapacity" name="capacity" type="number" min="0" step="1" placeholder="150" className="input" />
                  </div>
                  <button type="submit" className="btn-primary w-full">
                    <Plus className="h-4 w-4" /> Simpan program
                  </button>
                </form>
              </Card>
            ) : (
              <Card>
                <EmptyState icon={BookOpen} title="Akses terhad" description="Hanya AJK, Setiausaha dan Pengerusi boleh mengurus program." />
              </Card>
            )}

            <Card>
              <CardHeader
                title="Kehadiran terkini"
                description={latestProgram ? latestProgram.title : "Belum ada program"}
              />
              {recentAttendance.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Tiada kehadiran direkod"
                  description="Kehadiran boleh direkod pada kad program yang berstatus sah atau selesai."
                />
              ) : (
                <ul className="divide-y divide-brand-900/5">
                  {recentAttendance.map((record) => (
                    <li key={record.id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-brand-950">{record.name}</p>
                        <p className="text-[11px] text-brand-900/45">{record.phone ?? "—"}</p>
                      </div>
                      <span className="whitespace-nowrap text-[11px] text-brand-900/45">{tarikh(record.checkedIn)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}

      {tab === "penceramah" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Daftar penceramah" description="Tauliah dan status pengesahan penceramah." />
            {speakers.length === 0 ? (
              <EmptyState
                icon={BadgeCheck}
                title="Belum ada penceramah"
                description="Daftarkan penceramah menggunakan borang di sebelah."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>No. tauliah</th>
                      <th>Tamat tauliah</th>
                      <th>Daerah</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {speakers.map((speaker) => {
                      const expired = speaker.tauliahExpiry ? speaker.tauliahExpiry < now : false;
                      return (
                        <tr key={speaker.id}>
                          <td className="font-medium text-brand-950">{speaker.name}</td>
                          <td className="whitespace-nowrap text-xs">{speaker.tauliahNo}</td>
                          <td className={`whitespace-nowrap text-xs ${expired ? "font-semibold text-red-600" : "text-brand-900/60"}`}>
                            {tarikh(speaker.tauliahExpiry)}
                          </td>
                          <td className="text-xs">{speaker.district ?? "—"}</td>
                          <td>
                            <Badge tone={speaker.verified ? "success" : "warning"}>
                              {speaker.verified ? "Disahkan" : "Belum disahkan"}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="self-start">
            <CardHeader
              title="Tambah penceramah"
              description="Pendaftaran baharu memerlukan pengesahan tauliah oleh JAINJ."
            />
            {canManage ? (
              <form action={addSpeaker} className="space-y-3 p-5">
                <div>
                  <label className="label" htmlFor="speakerName">Nama penuh</label>
                  <input id="speakerName" name="name" required placeholder="Ustaz / Ustazah…" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="speakerTauliah">No. tauliah</label>
                  <input id="speakerTauliah" name="tauliahNo" required placeholder="TLH/JHR/2026/0001" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="speakerExpiry">Tamat tauliah</label>
                  <input id="speakerExpiry" name="tauliahExpiry" type="date" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="speakerPhone">Telefon</label>
                  <input id="speakerPhone" name="phone" placeholder="012-345 6789" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="speakerDistrict">Daerah</label>
                  <input id="speakerDistrict" name="district" placeholder="Johor Bahru" className="input" />
                </div>
                <button type="submit" className="btn-primary w-full">
                  <Plus className="h-4 w-4" /> Simpan penceramah
                </button>
              </form>
            ) : (
              <EmptyState icon={BadgeCheck} title="Akses terhad" description="Hanya AJK, Setiausaha dan Pengerusi boleh menambah penceramah." />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function ProgramCard({
  program,
  canManage,
  now,
}: {
  program: {
    id: string;
    title: string;
    type: string;
    date: Date;
    startTime: string;
    endTime: string | null;
    location: string | null;
    capacity: number | null;
    status: string;
    speaker: {
      name: string;
      verified: boolean;
      tauliahExpiry: Date | null;
    } | null;
    _count: { attendance: number };
  };
  canManage: boolean;
  now: Date;
}) {
  const speaker = program.speaker;
  const warning = speaker
    ? !speaker.verified
      ? "Tauliah belum disahkan"
      : speaker.tauliahExpiry && speaker.tauliahExpiry < now
        ? "Tauliah tamat"
        : null
    : null;

  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-700/10">
          <span className="text-lg font-bold leading-none">{program.date.getDate()}</span>
          <span className="mt-0.5 text-[10px] font-semibold uppercase">{MONTH_SHORT[program.date.getMonth()]}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-brand-950">{program.title}</p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-900/55">
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" /> {program.startTime}
                  {program.endTime ? ` – ${program.endTime}` : ""}
                </span>
                {program.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5" /> {program.location}
                  </span>
                )}
                {program.capacity ? <span>Kapasiti {program.capacity}</span> : null}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge>{label(program.type)}</Badge>
              <StatusBadge value={program.status} />
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
            {speaker ? (
              <span className="inline-flex items-center gap-1 text-brand-900/65">
                <UserRound className="h-3.5 w-3.5" /> {speaker.name}
              </span>
            ) : (
              <span className="text-brand-900/40">Tiada penceramah</span>
            )}
            {warning && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20">
                <AlertTriangle className="h-3 w-3" /> {warning}
              </span>
            )}
          </div>

          {["SAH", "SELESAI"].includes(program.status) && (
            <div className="mt-3 rounded-lg bg-sand px-3 py-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-900/65">
                  <Users className="h-3.5 w-3.5" /> {program._count.attendance} kehadiran direkod
                </span>
                {canManage && (
                  <details className="w-full sm:w-auto">
                    <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900">
                      <ClipboardCheck className="h-3.5 w-3.5" /> Rekod kehadiran
                    </summary>
                    <form action={recordAttendance} className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input type="hidden" name="programId" value={program.id} />
                      <input name="name" required placeholder="Nama peserta" className="input !py-1.5 text-xs" />
                      <input name="phone" placeholder="Telefon (pilihan)" className="input !py-1.5 text-xs" />
                      <button type="submit" className="btn-secondary whitespace-nowrap !px-2.5 !py-1.5 text-xs">
                        Simpan
                      </button>
                    </form>
                  </details>
                )}
              </div>
            </div>
          )}

          {canManage && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-brand-900/5 pt-3">
              {program.status === "DIRANCANG" && (
                <form action={setProgramStatus}>
                  <input type="hidden" name="id" value={program.id} />
                  <input type="hidden" name="status" value="SAH" />
                  <button type="submit" className="btn-secondary !px-2.5 !py-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Sahkan
                  </button>
                </form>
              )}
              {program.status === "SAH" && (
                <form action={setProgramStatus}>
                  <input type="hidden" name="id" value={program.id} />
                  <input type="hidden" name="status" value="SELESAI" />
                  <button type="submit" className="btn-secondary !px-2.5 !py-1.5 text-xs">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Tandakan selesai
                  </button>
                </form>
              )}
              {["DIRANCANG", "SAH"].includes(program.status) && (
                <form action={setProgramStatus}>
                  <input type="hidden" name="id" value={program.id} />
                  <input type="hidden" name="status" value="DIBATAL" />
                  <button type="submit" className="btn-ghost !px-2.5 !py-1.5 text-xs text-red-600 hover:bg-red-50">
                    <XCircle className="h-3.5 w-3.5" /> Batal
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
