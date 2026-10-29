import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardCheck,
  Info,
  KeyRound,
  MapPin,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label, type Tone } from "@/lib/labels";
import { percent, tarikhMasa } from "@/lib/utils";

export const metadata: Metadata = { title: "Keselamatan & Pematuhan" };

const ROLE_ORDER = ["KETUA", "SETIAUSAHA", "BENDAHARI", "AJK", "JAINJ", "AUDITOR", "TUTOR", "JEMAAH"] as const;
const OFFICER_ROLES = new Set(["KETUA", "SETIAUSAHA", "BENDAHARI", "AJK", "JAINJ", "AUDITOR"]);

const SECURITY_TONE: Record<string, Tone> = {
  LOGIN: "info",
  EXPORT: "warning",
  APPROVE: "success",
};

type ComplianceStatus = "DIPATUHI" | "DALAM_PROSES" | "DIRANCANG";

const COMPLIANCE_TONE: Record<ComplianceStatus, Tone> = {
  DIPATUHI: "success",
  DALAM_PROSES: "warning",
  DIRANCANG: "neutral",
};

const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  DIPATUHI: "Dipatuhi",
  DALAM_PROSES: "Dalam proses",
  DIRANCANG: "Dirancang",
};

const PDPA_CONTROLS: { control: string; detail: string; status: ComplianceStatus }[] = [
  {
    control: "Notis privasi & persetujuan",
    detail: "Borang derma dan tempahan kelas memaparkan notis PDPA dan persetujuan penjaga.",
    status: "DIPATUHI",
  },
  {
    control: "Hak akses & pembetulan subjek data",
    detail: "Permintaan diurus melalui pegawai masjid; aliran automatik belum dilaksanakan.",
    status: "DALAM_PROSES",
  },
  {
    control: "Pengasingan data mengikut masjid",
    detail: "Pertanyaan portal disekop kepada mosqueId pengguna yang sah.",
    status: "DIPATUHI",
  },
  {
    control: "Penyulitan data sensitif",
    detail: "TLS semasa transit; AES-256 melalui KMS semasa rehat (reka bentuk produksi).",
    status: "DIPATUHI",
  },
  {
    control: "Log audit & akauntabiliti",
    detail: "Jejak tambah-sahaja; eksport CSV direkodkan sebagai tindakan EXPORT.",
    status: "DIPATUHI",
  },
  {
    control: "Notifikasi insiden (72 jam)",
    detail: "Prosedur eskalasi kepada JAINJ dan pemilik data sebelum pelancaran sebenar.",
    status: "DIPATUHI",
  },
  {
    control: "Penilaian kesan privasi (PIA)",
    detail: "Akan dijalankan sebelum pelancaran produksi dan selepas perubahan besar.",
    status: "DIRANCANG",
  },
];

export default async function KeselamatanPage() {
  const user = await requirePageUser(["JAINJ", "AUDITOR"]);

  const [users, securityEvents] = await Promise.all([
    prisma.user.findMany({ select: { role: true, mfaEnabled: true } }),
    prisma.auditLog.findMany({
      where: { action: { in: ["LOGIN", "EXPORT", "APPROVE"] } },
      include: { mosque: { select: { name: true } } },
      orderBy: { at: "desc" },
      take: 10,
    }),
  ]);

  const totalUsers = users.length;
  const mfaUsers = users.filter((account) => account.mfaEnabled).length;
  const officers = users.filter((account) => OFFICER_ROLES.has(account.role));
  const mfaOfficers = officers.filter((account) => account.mfaEnabled).length;
  const mfaPct = percent(mfaUsers, totalUsers);
  const mfaTone: Tone = mfaPct === 100 ? "success" : mfaPct >= 75 ? "warning" : "danger";

  const roleMfa = ROLE_ORDER.map((role) => {
    const rows = users.filter((account) => account.role === role);
    return {
      role,
      total: rows.length,
      mfa: rows.filter((account) => account.mfaEnabled).length,
    };
  }).filter((row) => row.total > 0);

  const complianceDone = PDPA_CONTROLS.filter((item) => item.status === "DIPATUHI").length;

  return (
    <div>
      <PageHeader
        eyebrow="SEC1 · Keselamatan & pematuhan"
        title="Keselamatan & Pematuhan"
        description="Kawalan keselamatan platform, liputan MFA, senarai semak PDPA, jadual pen test dan integriti jejak audit."
        actions={
          <>
            <Badge tone="warning">Data demo</Badge>
            <Badge tone="info">Baca sahaja</Badge>
          </>
        }
      />

      <div className="mb-6 rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Paparan pematuhan ini adalah simulasi untuk semakan seni bina. Akses baca sahaja untuk{" "}
            {label(user.role)}. Kawalan bertanda “reka bentuk” merujuk sasaran produksi dan belum
            dilaksanakan sepenuhnya dalam demo.
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Liputan MFA"
          value={`${mfaPct}%`}
          hint={`${mfaUsers} / ${totalUsers} akaun mengaktifkan MFA`}
          icon={ShieldCheck}
        />
        <Stat
          label="Pegawai dengan MFA"
          value={`${mfaOfficers} / ${officers.length}`}
          hint="KETUA, SETIAUSAHA, BENDAHARI, AJK, JAINJ, AUDITOR"
          icon={UserCheck}
        />
        <Stat label="KMS" value="Aktif" hint="AES-256 · putaran 90 hari" icon={KeyRound} />
        <Stat label="Pen test" value="Lulus" hint="Terakhir 12 Jun 2026 · seterusnya 8 Jan 2027" icon={ClipboardCheck} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Pengurusan kunci (KMS)"
            description="Kawalan kunci penyulitan untuk data dan storan."
            action={<Badge tone="success">Aktif</Badge>}
          />
          <div className="space-y-2.5 p-5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-brand-900/55">Algoritma</span>
              <span className="font-semibold text-brand-950">AES-256-GCM</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-brand-900/55">Putaran kunci</span>
              <span className="font-semibold text-brand-950">Setiap 90 hari</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-brand-900/55">Penyimpanan kunci</span>
              <span className="font-semibold text-brand-950">HSM (reka bentuk)</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-brand-900/55">Audit akses kunci</span>
              <Badge tone="success">Didayakan</Badge>
            </div>
            <p className="rounded-lg bg-sand/70 p-3 text-[11px] leading-relaxed text-brand-900/55">
              Demo menggunakan storan fail tempatan untuk dokumen. KMS dan HSM ialah komponen sasaran
              produksi di wilayah Malaysia.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Liputan MFA mengikut peranan"
            description={`${mfaUsers} daripada ${totalUsers} akaun mengaktifkan pengesahan berbilang faktor.`}
            action={<Badge tone={mfaTone}>{mfaPct}%</Badge>}
          />
          <div className="space-y-3 p-5">
            {roleMfa.map((row) => (
              <div key={row.role}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-brand-950">{label(row.role)}</span>
                  <span className="text-brand-900/50">
                    {row.mfa} / {row.total}
                  </span>
                </div>
                <Progress
                  value={percent(row.mfa, row.total)}
                  className="mt-1.5"
                  tone={row.mfa === row.total ? "brand" : "gold"}
                />
              </div>
            ))}
            <p className="border-t border-brand-900/5 pt-3 text-[11px] leading-relaxed text-brand-900/55">
              {mfaOfficers} daripada {officers.length} pegawai/pentadbir telah mengaktifkan MFA. Semua
              akaun pentadbir disasarkan mencapai 100% sebelum produksi.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Kawalan PDPA"
            description="Senarai semak kawalan data peribadi di bawah Akta Perlindungan Data Peribadi 2010."
            action={
              <Badge tone="info">
                {complianceDone}/{PDPA_CONTROLS.length} dipatuhi
              </Badge>
            }
          />
          <ul className="divide-y divide-brand-900/5">
            {PDPA_CONTROLS.map((item) => (
              <li key={item.control} className="flex items-start justify-between gap-3 px-5 py-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-brand-950">{item.control}</p>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-brand-900/55">{item.detail}</p>
                </div>
                <Badge tone={COMPLIANCE_TONE[item.status]} className="shrink-0">
                  {COMPLIANCE_LABEL[item.status]}
                </Badge>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <CardHeader
            title="Ujian keselamatan & residensi data"
            description="Jadual pen test dan lokasi penyimpanan data platform."
          />
          <div className="grid gap-5 p-5 sm:grid-cols-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/40">
                Ujian penembusan
              </p>
              <dl className="mt-2 space-y-2 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-brand-900/55">Terakhir</dt>
                  <dd className="font-medium text-brand-950">12 Jun 2026</dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-brand-900/55">Keputusan</dt>
                  <dd>
                    <Badge tone="success">Lulus</Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <dt className="text-brand-900/55">Seterusnya</dt>
                  <dd className="font-medium text-brand-950">8 Jan 2027</dd>
                </div>
              </dl>
              <p className="mt-2 text-[11px] leading-relaxed text-brand-900/50">
                Dua penemuan sederhana ditutup dalam tempoh SLA. Skop merangkumi aplikasi web, API dan
                infrastruktur.
              </p>
            </div>

            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/40">
                Residensi data
              </p>
              <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-brand-950">
                <MapPin className="h-3.5 w-3.5 text-brand-700" /> Malaysia (Johor)
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-brand-900/55">
                Pangkalan data, storan objek dan sandaran kekal di Malaysia. Tiada pemindahan rentas
                sempadan tanpa kelulusan pemilik data.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone="success">PDPA 2010</Badge>
                <Badge tone="info">Wilayah Malaysia</Badge>
              </div>
            </div>
          </div>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="Integriti jejak audit"
            description="Jejak audit platform direka sebagai tambah-sahaja dan tidak boleh diubah atau dipadam."
            action={
              <Link
                href="/jainj/audit"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
              >
                Lihat jejak <ArrowRight className="h-3 w-3" />
              </Link>
            }
          />
          <div className="grid gap-4 p-5 sm:grid-cols-3">
            <div className="rounded-xl bg-sand/70 p-4">
              <Badge tone="success">Tambah-sahaja</Badge>
              <p className="mt-2 text-xs font-semibold text-brand-950">Tiada kemas kini atau padam</p>
              <p className="mt-1 text-[11px] leading-relaxed text-brand-900/55">
                Tiada laluan API atau UI untuk mengubah atau memadam rekod audit.
              </p>
            </div>
            <div className="rounded-xl bg-sand/70 p-4">
              <Badge tone="info">Eksport diaudit</Badge>
              <p className="mt-2 text-xs font-semibold text-brand-950">Setiap eksport direkod</p>
              <p className="mt-1 text-[11px] leading-relaxed text-brand-900/55">
                Eksport CSV jejak audit direkodkan sebagai tindakan EXPORT bersama penapis dan bilangan
                rekod.
              </p>
            </div>
            <div className="rounded-xl bg-sand/70 p-4">
              <Badge tone="neutral">Retensi</Badge>
              <p className="mt-2 text-xs font-semibold text-brand-950">7 tahun (reka bentuk)</p>
              <p className="mt-1 text-[11px] leading-relaxed text-brand-900/55">
                Dasar retensi JAINJ untuk rekod audit dan kewangan sebelum pelancaran produksi.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Peristiwa keselamatan terkini"
          description="10 peristiwa LOGIN, EXPORT dan APPROVE terbaharu merentas platform."
          action={
            <Link
              href="/jainj/audit"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
            >
              Jejak audit penuh <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        {securityEvents.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="Tiada peristiwa keselamatan"
            description="Peristiwa LOGIN, EXPORT dan APPROVE akan dipaparkan di sini selepas direkodkan."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Masa</th>
                  <th>Pelaku</th>
                  <th>Peranan</th>
                  <th>Tindakan</th>
                  <th>Entiti</th>
                  <th>Masjid</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {securityEvents.map((event) => (
                  <tr key={event.id}>
                    <td className="whitespace-nowrap text-xs text-brand-900/60">
                      {tarikhMasa(event.at)}
                    </td>
                    <td className="text-xs font-medium text-brand-950">{event.actorEmail}</td>
                    <td className="text-xs text-brand-900/60">{label(event.actorRole)}</td>
                    <td>
                      <Badge tone={SECURITY_TONE[event.action] ?? "neutral"}>{label(event.action)}</Badge>
                    </td>
                    <td>
                      <p className="text-xs">{event.entity}</p>
                      {event.entityId && (
                        <p className="max-w-[140px] truncate font-mono text-[10px] text-brand-900/40">
                          {event.entityId}
                        </p>
                      )}
                    </td>
                    <td className="text-xs text-brand-900/60">{event.mosque?.name ?? "—"}</td>
                    <td className="whitespace-nowrap font-mono text-[10px] text-brand-900/50">
                      {event.ip ?? "—"}
                    </td>
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
