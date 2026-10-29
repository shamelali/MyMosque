import type { Metadata } from "next";
import { CalendarDays, CheckCircle2, ClipboardList, UserRoundPlus, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatusBadge } from "@/components/ui/card";
import { EmptyState, Tabs } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { tarikh, tarikhMasa } from "@/lib/utils";
import { addOfficer, completeMeeting, endOfficer, scheduleMeeting, updateMosque } from "./actions";

export const metadata: Metadata = { title: "Daftar Masjid & AJK" };

const TABS = [
  { key: "profil", label: "Profil" },
  { key: "pegawai", label: "Pegawai" },
  { key: "ajk", label: "AJK" },
  { key: "mesyuarat", label: "Mesyuarat" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function localDateTimeValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default async function DaftarPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ralat?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const { tab: rawTab, ralat } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "profil";

  const [officers, terms, meetings] = await Promise.all([
    prisma.officer.findMany({ where: { mosqueId: mosque.id }, orderBy: { appointmentDate: "asc" } }),
    prisma.committeeTerm.findMany({
      where: { mosqueId: mosque.id },
      include: { members: true },
      orderBy: { startDate: "desc" },
    }),
    prisma.meeting.findMany({ where: { mosqueId: mosque.id }, orderBy: { date: "desc" } }),
  ]);

  const activeTerm = terms.find((term) => term.status === "AKTIF") ?? null;
  const canEdit = user.role === "KETUA" || user.role === "SETIAUSAHA";

  return (
    <div>
      <PageHeader
        eyebrow="Tadbir urus"
        title="Daftar Masjid & AJK"
        description="Profil masjid, pegawai, jawatankuasa dan mesyuarat dalam satu tempat."
      />

      {ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {ralat}
        </p>
      )}

      <Tabs
        active={`/portal/daftar?tab=${tab}`}
        items={TABS.map((t) => ({
          href: `/portal/daftar?tab=${t.key}`,
          label: t.label,
          count:
            t.key === "pegawai"
              ? officers.filter((o) => o.status === "AKTIF").length
              : t.key === "mesyuarat"
                ? meetings.filter((m) => m.status !== "SELESAI").length
                : undefined,
        }))}
      />

      {tab === "profil" && (
        <Card>
          <CardHeader
            title="Profil masjid"
            description={`Kod pendaftaran JAINJ: ${mosque.code}`}
            action={
              <span className="text-[11px] font-medium text-brand-900/45">
                {canEdit ? "Anda boleh mengemas kini maklumat ini" : "Hanya Pengerusi dan Setiausaha boleh menyunting"}
              </span>
            }
          />
          {canEdit ? (
            <form action={updateMosque} className="grid gap-4 p-5 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="code">Kod JAINJ</label>
                <input id="code" value={mosque.code} disabled className="input" />
              </div>
              <div>
                <label className="label" htmlFor="name">Nama masjid</label>
                <input id="name" name="name" required defaultValue={mosque.name} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="district">Daerah</label>
                <input id="district" name="district" required defaultValue={mosque.district} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="status">Status</label>
                <select id="status" name="status" defaultValue={mosque.status} className="input">
                  <option value="AKTIF">Aktif</option>
                  <option value="TUTUP">Ditutup</option>
                  <option value="PROJEK">Dalam projek</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className="label" htmlFor="address">Alamat</label>
                <input id="address" name="address" defaultValue={mosque.address ?? ""} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="phone">Telefon</label>
                <input id="phone" name="phone" defaultValue={mosque.phone ?? ""} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="email">E-mel</label>
                <input id="email" name="email" type="email" defaultValue={mosque.email ?? ""} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="capacity">Kapasiti jemaah</label>
                <input
                  id="capacity"
                  name="capacity"
                  type="number"
                  min="0"
                  step="1"
                  defaultValue={mosque.capacity ?? ""}
                  className="input"
                />
              </div>
              <div className="flex items-end justify-end sm:col-span-2">
                <button type="submit" className="btn-primary">
                  Simpan perubahan
                </button>
              </div>
            </form>
          ) : (
            <dl className="grid gap-x-8 gap-y-4 p-5 sm:grid-cols-2">
              <ReadField label="Kod JAINJ" value={mosque.code} />
              <ReadField label="Nama masjid" value={mosque.name} />
              <ReadField label="Daerah" value={mosque.district} />
              <ReadField label="Status" value={label(mosque.status)} />
              <ReadField label="Alamat" value={mosque.address} />
              <ReadField label="Telefon" value={mosque.phone} />
              <ReadField label="E-mel" value={mosque.email} />
              <ReadField label="Kapasiti jemaah" value={mosque.capacity ? `${mosque.capacity} orang` : null} />
            </dl>
          )}
        </Card>
      )}

      {tab === "pegawai" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Pegawai masjid" description="Jawatan, tempoh lantikan dan status pegawai." />
            {officers.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Belum ada pegawai didaftarkan"
                description="Tambah pegawai masjid menggunakan borang di sebelah."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Jawatan</th>
                      <th>Nama</th>
                      <th>Telefon</th>
                      <th>Lantikan</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {officers.map((officer) => (
                      <tr key={officer.id}>
                        <td className="whitespace-nowrap text-xs font-semibold text-brand-900/70">
                          {label(officer.position)}
                        </td>
                        <td className="font-medium text-brand-950">{officer.name}</td>
                        <td className="whitespace-nowrap text-xs">{officer.phone ?? "—"}</td>
                        <td className="whitespace-nowrap text-xs">{tarikh(officer.appointmentDate)}</td>
                        <td>
                          <StatusBadge value={officer.status} />
                        </td>
                        <td className="text-right">
                          {officer.status === "AKTIF" && canEdit && (
                            <form action={endOfficer}>
                              <input type="hidden" name="id" value={officer.id} />
                              <button type="submit" className="text-[11px] font-semibold text-red-600 hover:text-red-700">
                                Tamatkan
                              </button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="self-start">
            <CardHeader title="Tambah pegawai" description="Daftarkan pegawai baharu untuk masjid ini." />
            {canEdit ? (
              <form action={addOfficer} className="space-y-3 p-5">
                <div>
                  <label className="label" htmlFor="position">Jawatan</label>
                  <select id="position" name="position" className="input" defaultValue="AJK">
                    {["PENGERUSI", "TIMBALAN", "SETIAUSAHA", "BENDAHARI", "AJK"].map((position) => (
                      <option key={position} value={position}>{label(position)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="officerName">Nama penuh</label>
                  <input id="officerName" name="name" required placeholder="Nama pegawai" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="officerPhone">Telefon</label>
                  <input id="officerPhone" name="phone" placeholder="012-345 6789" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="officerEmail">E-mel (pilihan)</label>
                  <input id="officerEmail" name="email" type="email" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="appointmentDate">Tarikh lantikan</label>
                  <input
                    id="appointmentDate"
                    name="appointmentDate"
                    type="date"
                    defaultValue={new Date().toISOString().slice(0, 10)}
                    className="input"
                  />
                </div>
                <button type="submit" className="btn-primary w-full">
                  <UserRoundPlus className="h-4 w-4" /> Simpan pegawai
                </button>
              </form>
            ) : (
              <EmptyState
                icon={Users}
                title="Akses terhad"
                description="Hanya Pengerusi dan Setiausaha boleh menambah pegawai."
              />
            )}
          </Card>
        </div>
      )}

      {tab === "ajk" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              title="Ahli jawatankuasa aktif"
              description={activeTerm ? `${activeTerm.label} · ${tarikh(activeTerm.startDate)} – ${tarikh(activeTerm.endDate)}` : undefined}
              action={activeTerm ? <StatusBadge value={activeTerm.status} /> : undefined}
            />
            {!activeTerm || activeTerm.members.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Tiada jawatankuasa aktif"
                description="Sesi jawatankuasa masjid belum didaftarkan untuk tempoh semasa."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Jawatan</th>
                      <th>Nama</th>
                      <th>Telefon</th>
                      <th>No. IC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeTerm.members.map((member) => (
                      <tr key={member.id}>
                        <td className="whitespace-nowrap text-xs font-semibold text-brand-900/70">
                          {label(member.position)}
                        </td>
                        <td className="font-medium text-brand-950">{member.name}</td>
                        <td className="whitespace-nowrap text-xs">{member.phone ?? "—"}</td>
                        <td className="whitespace-nowrap text-xs">{member.icNo ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="self-start">
            <CardHeader title="Sejarah sesi" description="Rekod sesi jawatankuasa masjid." />
            {terms.length === 0 ? (
              <EmptyState icon={ClipboardList} title="Belum ada sesi" />
            ) : (
              <ul className="divide-y divide-brand-900/5">
                {terms.map((term) => (
                  <li key={term.id} className="flex items-start justify-between gap-3 px-5 py-3.5">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-brand-950">{term.label}</p>
                      <p className="mt-0.5 text-[11px] text-brand-900/50">
                        {tarikh(term.startDate)} – {tarikh(term.endDate)}
                      </p>
                    </div>
                    <StatusBadge value={term.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === "mesyuarat" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {meetings.length === 0 ? (
              <Card>
                <EmptyState
                  icon={CalendarDays}
                  title="Belum ada mesyuarat"
                  description="Jadualkan mesyuarat AJK pertama menggunakan borang di sebelah."
                />
              </Card>
            ) : (
              meetings.map((meeting) => (
                <Card key={meeting.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-brand-950">{meeting.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-900/55">
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays className="h-3.5 w-3.5" /> {tarikhMasa(meeting.date)}
                        </span>
                        {meeting.location && <span>{meeting.location}</span>}
                      </p>
                    </div>
                    <StatusBadge value={meeting.status} />
                  </div>

                  {meeting.agenda && (
                    <p className="mt-3 whitespace-pre-line rounded-lg bg-sand px-3 py-2 text-xs leading-relaxed text-brand-900/70">
                      <span className="font-semibold text-brand-900/60">Agenda: </span>
                      {meeting.agenda}
                    </p>
                  )}

                  {meeting.status === "SELESAI" ? (
                    meeting.decisions && (
                      <p className="mt-3 whitespace-pre-line rounded-lg border border-emerald-600/10 bg-emerald-50/70 px-3 py-2 text-xs leading-relaxed text-emerald-900">
                        <span className="font-semibold">Keputusan: </span>
                        {meeting.decisions}
                      </p>
                    )
                  ) : canEdit ? (
                    <form action={completeMeeting} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
                      <input type="hidden" name="id" value={meeting.id} />
                      <div className="flex-1">
                        <label className="label" htmlFor={`decisions-${meeting.id}`}>Keputusan mesyuarat</label>
                        <textarea
                          id={`decisions-${meeting.id}`}
                          name="decisions"
                          required
                          rows={2}
                          placeholder="Catatkan keputusan dan tindakan susulan…"
                          className="input"
                        />
                      </div>
                      <button type="submit" className="btn-secondary whitespace-nowrap">
                        <CheckCircle2 className="h-4 w-4" /> Tandakan selesai
                      </button>
                    </form>
                  ) : null}
                </Card>
              ))
            )}
          </div>

          <Card className="self-start">
            <CardHeader title="Jadual mesyuarat" description="Rancang mesyuarat AJK akan datang." />
            {canEdit ? (
              <form action={scheduleMeeting} className="space-y-3 p-5">
                <div>
                  <label className="label" htmlFor="meetingTitle">Tajuk mesyuarat</label>
                  <input
                    id="meetingTitle"
                    name="title"
                    required
                    placeholder="Mesyuarat AJK Bil. 5"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="meetingDate">Tarikh & masa</label>
                  <input
                    id="meetingDate"
                    name="date"
                    type="datetime-local"
                    required
                    defaultValue={localDateTimeValue(new Date())}
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="meetingLocation">Lokasi</label>
                  <input
                    id="meetingLocation"
                    name="location"
                    placeholder="Bilik Mesyuarat Masjid"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="meetingAgenda">Agenda</label>
                  <textarea id="meetingAgenda" name="agenda" rows={4} placeholder="1. Pengesahan minit…" className="input" />
                </div>
                <button type="submit" className="btn-primary w-full">
                  <CalendarDays className="h-4 w-4" /> Jadualkan mesyuarat
                </button>
              </form>
            ) : (
              <EmptyState icon={CalendarDays} title="Akses terhad" description="Hanya Pengerusi dan Setiausaha boleh menjadualkan mesyuarat." />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function ReadField({ label: fieldLabel, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">{fieldLabel}</dt>
      <dd className="mt-1 text-sm text-brand-950">{value || "—"}</dd>
    </div>
  );
}
