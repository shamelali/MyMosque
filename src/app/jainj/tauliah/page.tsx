import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeCheck,
  ChevronRight,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  UserCheck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { tarikh } from "@/lib/utils";
import { setVerification } from "./actions";

export const metadata: Metadata = { title: "Pegawai & Tauliah" };

const DAY = 86_400_000;
const STATUS_OPTIONS = ["semua", "sah", "akan_tamat", "tamat", "belum"] as const;
const POSITION_ORDER: Record<string, number> = {
  PENGERUSI: 0,
  TIMBALAN: 1,
  SETIAUSAHA: 2,
  BENDAHARI: 3,
  AJK: 4,
};

export default async function TauliahPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; selesai?: string; ralat?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = STATUS_OPTIONS.includes((params.status ?? "") as (typeof STATUS_OPTIONS)[number])
    ? (params.status as string)
    : "semua";

  const [speakers, officers] = await Promise.all([
    prisma.speaker.findMany({ orderBy: { name: "asc" } }),
    prisma.officer.findMany({
      where: { status: "AKTIF" },
      include: { mosque: { select: { name: true, district: true } } },
    }),
  ]);

  const nowMs = Date.now();
  const soonMs = nowMs + 60 * DAY;

  const expiryOf = (value: Date | null) => (value ? value.getTime() : null);
  const isExpired = (value: Date | null) => {
    const expiry = expiryOf(value);
    return expiry !== null && expiry < nowMs;
  };
  const isExpiring = (value: Date | null) => {
    const expiry = expiryOf(value);
    return expiry !== null && expiry >= nowMs && expiry <= soonMs;
  };

  const query = q.toLowerCase();
  const filtered = speakers.filter((speaker) => {
    const matchesQuery =
      !query ||
      [speaker.name, speaker.tauliahNo, speaker.district ?? ""].some((value) =>
        value.toLowerCase().includes(query),
      );
    if (!matchesQuery) return false;

    if (status === "tamat") return isExpired(speaker.tauliahExpiry);
    if (status === "akan_tamat") return isExpiring(speaker.tauliahExpiry);
    if (status === "sah") {
      const expiry = expiryOf(speaker.tauliahExpiry);
      return expiry !== null && expiry > soonMs;
    }
    if (status === "belum") return !speaker.verified;
    return true;
  });

  const sortedOfficers = [...officers].sort(
    (a, b) =>
      a.mosque.name.localeCompare(b.mosque.name) ||
      (POSITION_ORDER[a.position] ?? 9) - (POSITION_ORDER[b.position] ?? 9) ||
      a.name.localeCompare(b.name),
  );

  const expiredCount = speakers.filter((speaker) => isExpired(speaker.tauliahExpiry)).length;
  const expiringCount = speakers.filter((speaker) => isExpiring(speaker.tauliahExpiry)).length;
  const unverifiedCount = speakers.filter((speaker) => !speaker.verified).length;

  return (
    <div className="mobile-pad">
      <PageHeader
        eyebrow="Data induk"
        title="Pegawai & Tauliah"
        description="Pemantauan tauliah penceramah dan pendaftaran pegawai masjid di seluruh negeri."
        actions={
          <Link href="/jainj/amaran" className="btn-secondary">
            <ShieldAlert className="h-4 w-4" /> Amaran tauliah
          </Link>
        }
      />

      {(params.selesai || params.ralat) && (
        <p
          className={
            params.ralat
              ? "mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15"
              : "mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15"
          }
        >
          {params.ralat
            ? params.ralat
            : params.selesai === "nyah"
              ? "Pengesahan tauliah telah ditarik balik dan direkodkan dalam jejak audit."
              : "Tauliah penceramah telah disahkan dan direkodkan dalam jejak audit."}
        </p>
      )}

      {user.role !== "JAINJ" && (
        <div className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
          Anda log masuk sebagai auditor. Data tauliah dan pegawai boleh dilihat sepenuhnya, tetapi
          tindakan pengesahan hanya tersedia untuk pegawai JAINJ.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Pemegang tauliah"
          value={speakers.length}
          hint="Penceramah berdaftar JAINJ"
          icon={BadgeCheck}
        />
        <Stat
          label="Tauliah tamat tempoh"
          value={expiredCount}
          hint="Perlu tindakan segera"
          icon={ShieldAlert}
        />
        <Stat
          label="Akan tamat (60 hari)"
          value={expiringCount}
          hint="Perlu pembaharuan tauliah"
          icon={ShieldCheck}
        />
        <Stat
          label="Belum disahkan"
          value={unverifiedCount}
          hint="Menunggu pengesahan JAINJ"
          icon={UserCheck}
        />
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Daftar pemegang tauliah"
          description="Tapis mengikut nama, nombor tauliah, daerah atau status pengesahan."
        />
        <form action="/jainj/tauliah" className="flex flex-wrap items-end gap-3 border-b border-brand-900/5 p-5">
          <div className="min-w-[200px] flex-1">
            <label className="label" htmlFor="q">
              Carian
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-900/35" />
              <input
                id="q"
                name="q"
                defaultValue={q}
                className="input pl-9"
                placeholder="Nama, no. tauliah atau daerah"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={status} className="input w-auto">
              <option value="semua">Semua status</option>
              <option value="sah">Sah</option>
              <option value="akan_tamat">Akan tamat (60 hari)</option>
              <option value="tamat">Tamat tempoh</option>
              <option value="belum">Belum disahkan</option>
            </select>
          </div>
          <button type="submit" className="btn-primary">
            <SlidersHorizontal className="h-4 w-4" /> Tapis
          </button>
          {(q || status !== "semua") && (
            <Link href="/jainj/tauliah" className="btn-ghost">
              Set semula
            </Link>
          )}
        </form>

        {filtered.length === 0 ? (
          <EmptyState
            icon={BadgeCheck}
            title="Tiada pemegang tauliah ditemui"
            description="Laraskan carian atau penapis status untuk melihat rekod lain."
            action={
              <Link href="/jainj/tauliah" className="btn-secondary">
                Set semula penapis
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>No. tauliah</th>
                  <th>Tamat tempoh</th>
                  <th>Daerah</th>
                  <th>Pengesahan</th>
                  <th className="text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((speaker) => {
                  const expired = isExpired(speaker.tauliahExpiry);
                  const expiring = isExpiring(speaker.tauliahExpiry);
                  return (
                    <tr key={speaker.id} className={expired ? "bg-red-50/60" : undefined}>
                      <td>
                        <p className="font-medium text-brand-950">{speaker.name}</p>
                        <p className="text-[11px] text-brand-900/45">{speaker.phone ?? "Tiada telefon"}</p>
                      </td>
                      <td className="whitespace-nowrap font-mono text-[11px] text-brand-900/65">
                        {speaker.tauliahNo}
                      </td>
                      <td className="whitespace-nowrap">
                        <p className={expired ? "text-xs font-semibold text-red-600" : "text-xs"}>
                          {speaker.tauliahExpiry ? tarikh(speaker.tauliahExpiry) : "Tiada tarikh"}
                        </p>
                        <div className="mt-1">
                          {expired ? (
                            <Badge tone="danger">Tamat tempoh</Badge>
                          ) : expiring ? (
                            <Badge tone="warning">Akan tamat</Badge>
                          ) : speaker.tauliahExpiry ? (
                            <Badge tone="success">Sah</Badge>
                          ) : (
                            <Badge tone="neutral">Belum ditetapkan</Badge>
                          )}
                        </div>
                      </td>
                      <td className="whitespace-nowrap text-xs">{speaker.district ?? "—"}</td>
                      <td>
                        <Badge tone={speaker.verified ? "success" : "warning"}>
                          {speaker.verified ? "Disahkan" : "Belum disahkan"}
                        </Badge>
                        {speaker.verifiedBy && (
                          <p className="mt-1 text-[10px] text-brand-900/40">oleh {speaker.verifiedBy}</p>
                        )}
                      </td>
                      <td className="text-right">
                        {user.role === "JAINJ" ? (
                          <form action={setVerification}>
                            <input type="hidden" name="id" value={speaker.id} />
                            <input type="hidden" name="verified" value={speaker.verified ? "0" : "1"} />
                            <button
                              type="submit"
                              className="whitespace-nowrap text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                            >
                              {speaker.verified ? "Nyahsahkan" : "Sahkan"}
                            </button>
                          </form>
                        ) : (
                          <span className="text-[11px] text-brand-900/30">—</span>
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

      <Card className="mt-6">
        <CardHeader
          title="Pegawai masjid"
          description={`${sortedOfficers.length} pegawai aktif merentas masjid berdaftar.`}
          action={
            <Link href="/jainj/masjid" className="text-xs font-semibold text-brand-700 hover:text-brand-900">
              Senarai masjid
            </Link>
          }
        />
        {sortedOfficers.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Tiada pegawai aktif"
            description="Pendaftaran pegawai masjid akan dipaparkan di sini selepas dikemas kini melalui portal."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nama</th>
                  <th>Jawatan</th>
                  <th>Masjid</th>
                  <th>Telefon</th>
                  <th>Lantikan</th>
                </tr>
              </thead>
              <tbody>
                {sortedOfficers.map((officer) => (
                  <tr key={officer.id}>
                    <td>
                      <p className="font-medium text-brand-950">{officer.name}</p>
                      <p className="text-[10px] text-brand-900/40">{officer.email ?? "—"}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs">{label(officer.position)}</td>
                    <td>
                      <Link
                        href={`/jainj/masjid/${officer.mosqueId}`}
                        className="text-xs font-medium text-brand-950 hover:text-brand-700"
                      >
                        {officer.mosque.name}
                      </Link>
                      <p className="text-[10px] text-brand-900/40">{officer.mosque.district}</p>
                    </td>
                    <td className="whitespace-nowrap text-xs text-brand-900/65">{officer.phone ?? "—"}</td>
                    <td className="whitespace-nowrap text-xs text-brand-900/55">
                      {tarikh(officer.appointmentDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6 flex items-center justify-between rounded-xl bg-sand px-4 py-3 text-[11px] text-brand-900/50 ring-1 ring-inset ring-brand-900/5">
        <span>Pengesahan tauliah direkodkan dalam jejak audit bersama pelaku dan masa tindakan.</span>
        <Link
          href="/jainj/audit"
          className="inline-flex items-center gap-1 font-semibold text-brand-700 hover:text-brand-900"
        >
          Jejak audit <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
