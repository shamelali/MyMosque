import type { Metadata } from "next";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  Cloud,
  Database,
  GitBranch,
  Globe,
  HardDrive,
  Info,
  Server,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { integrationHealth } from "@/lib/integrations";
import { label, type Tone } from "@/lib/labels";
import { tarikhMasa } from "@/lib/utils";

export const metadata: Metadata = { title: "Operasi & Infrastruktur" };

type OpsStatus = "OPERASI" | "PERHATIAN" | "SEDIA";

type OpsComponent = {
  code: string;
  name: string;
  phase: "Fasa 1" | "Fasa 2";
  status: OpsStatus;
  icon: LucideIcon;
  metrics: { label: string; value: string }[];
  note?: string;
};

const STATUS_LABEL: Record<OpsStatus, string> = {
  OPERASI: "Beroperasi",
  PERHATIAN: "Perlu perhatian",
  SEDIA: "Sedia (DR)",
};

const STATUS_TONE: Record<OpsStatus, Tone> = {
  OPERASI: "success",
  PERHATIAN: "warning",
  SEDIA: "info",
};

const STATUS_DOT: Record<OpsStatus, string> = {
  OPERASI: "bg-emerald-500",
  PERHATIAN: "bg-amber-500",
  SEDIA: "bg-sky-500",
};

const INTEGRATION_NAMES: Record<string, string> = {
  gateway: "Gerbang bayaran",
  tpmj: "TPMJ",
  jainj: "Data induk JAINJ",
  messaging: "Penyedia mesej",
};

const COMPONENTS: OpsComponent[] = [
  {
    code: "H01",
    name: "Kluster aplikasi",
    phase: "Fasa 1",
    status: "OPERASI",
    icon: Server,
    metrics: [
      { label: "Autoscaling", value: "3–12 pod" },
      { label: "Pod aktif", value: "3" },
      { label: "Wilayah", value: "Malaysia (Johor)" },
    ],
    note: "Deployment spmj-app · HPA pada 60% CPU.",
  },
  {
    code: "H02",
    name: "Pangkalan data utama",
    phase: "Fasa 1",
    status: "OPERASI",
    icon: Database,
    metrics: [
      { label: "Enjin produksi", value: "PostgreSQL 16" },
      { label: "Demo semasa", value: "SQLite" },
      { label: "Penyulitan", value: "AES-256" },
    ],
    note: "Sandaran penuh harian pada 02:00 (reka bentuk).",
  },
  {
    code: "H03",
    name: "Pangkalan data siap sedia",
    phase: "Fasa 2",
    status: "PERHATIAN",
    icon: HardDrive,
    metrics: [
      { label: "Lag replika", value: "12 saat" },
      { label: "Lokasi", value: "Zon B" },
      { label: "Failover", value: "Automatik" },
    ],
    note: "Lag melebihi sasaran 5 saat; pemantauan dinaikkan.",
  },
  {
    code: "H04",
    name: "Storan objek",
    phase: "Fasa 1",
    status: "OPERASI",
    icon: Cloud,
    metrics: [
      { label: "Jenis", value: "S3-compatible" },
      { label: "Versioning", value: "Aktif" },
      { label: "Kapasiti", value: "42.6 GB" },
    ],
    note: "Storan dokumen dan resit · wilayah Malaysia.",
  },
  {
    code: "H05",
    name: "CI/CD",
    phase: "Fasa 1",
    status: "OPERASI",
    icon: GitBranch,
    metrics: [
      { label: "Larian #128", value: "Berjaya" },
      { label: "Larian #127", value: "Berjaya" },
      { label: "Larian #126", value: "Gagal (ujian)" },
    ],
    note: "Tiga larian terakhir (mock) · 1 kegagalan dalam ujian.",
  },
  {
    code: "H06",
    name: "Pemantauan",
    phase: "Fasa 1",
    status: "PERHATIAN",
    icon: Activity,
    metrics: [
      { label: "Amaran terbuka", value: "2" },
      { label: "Uptime 30 hari", value: "99.95%" },
      { label: "Latensi p95", value: "240 ms" },
    ],
    note: "Dua amaran terbuka: lag replika dan ruang storan.",
  },
  {
    code: "H07",
    name: "WAF & DDoS",
    phase: "Fasa 1",
    status: "OPERASI",
    icon: ShieldCheck,
    metrics: [
      { label: "WAF", value: "Aktif" },
      { label: "Peraturan", value: "OWASP CRS" },
      { label: "Diblok 24 jam", value: "1,204" },
    ],
    note: "Perlindungan DDoS di peringkat tepi rangkaian.",
  },
  {
    code: "H08",
    name: "Tapak pemulihan bencana",
    phase: "Fasa 2",
    status: "SEDIA",
    icon: Globe,
    metrics: [
      { label: "Wilayah kedua", value: "Malaysia Timur" },
      { label: "RPO", value: "15 minit" },
      { label: "RTO", value: "4 jam" },
    ],
    note: "Latihan pemulihan terakhir: 14 Ogos 2026 (simulasi).",
  },
];

export default async function OpsPage() {
  const user = await requirePageUser(["JAINJ", "AUDITOR"]);
  const { configs, lastRuns } = await integrationHealth();

  const operational = COMPONENTS.filter((item) => item.status === "OPERASI").length;
  const attention = COMPONENTS.filter((item) => item.status === "PERHATIAN").length;
  const standby = COMPONENTS.filter((item) => item.status === "SEDIA").length;

  return (
    <div>
      <PageHeader
        eyebrow="Sistem"
        title="Operasi & Infrastruktur"
        description="Inventori hosting H01–H08, status perkhidmatan platform dan penyegerakan integrasi. Semua data pada halaman ini adalah data demo."
        actions={
          <>
            <Badge tone="warning">Data demo</Badge>
            <Link href="/jainj/audit" className="btn-secondary">
              Jejak audit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/system/keselamatan" className="btn-ghost">
              Keselamatan
            </Link>
          </>
        }
      />

      <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-600/20">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Data demo.</strong> Metrik hosting, status komponen dan larian penyegerakan adalah
            nilai simulasi untuk tujuan semakan seni bina, bukan pemantauan langsung. Akses baca sahaja
            untuk {label(user.role)}.
          </span>
        </p>
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Badge tone="info">REGION: malaysia</Badge>
        <Badge tone="success">{operational} beroperasi</Badge>
        <Badge tone="warning">{attention} perlu perhatian</Badge>
        <Badge tone="info">{standby} sedia DR</Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {COMPONENTS.map((component) => {
          const Icon = component.icon;
          return (
            <Card key={component.code} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-700/10">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-mono text-[10px] font-semibold text-brand-900/40">{component.code}</p>
                    <h3 className="truncate text-sm font-semibold text-brand-950">{component.name}</h3>
                  </div>
                </div>
                <Badge tone={component.phase === "Fasa 1" ? "info" : "warning"}>{component.phase}</Badge>
              </div>

              <div className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold">
                <span className={`h-2 w-2 rounded-full ${STATUS_DOT[component.status]}`} />
                <span
                  className={
                    component.status === "OPERASI"
                      ? "text-emerald-700"
                      : component.status === "PERHATIAN"
                        ? "text-amber-700"
                        : "text-sky-700"
                  }
                >
                  {STATUS_LABEL[component.status]}
                </span>
                <Badge tone={STATUS_TONE[component.status]} className="ml-auto">
                  {component.status}
                </Badge>
              </div>

              <dl className="mt-3 space-y-1 border-t border-brand-900/5 pt-3 text-xs">
                {component.metrics.map((metric) => (
                  <div key={metric.label} className="flex items-baseline justify-between gap-2">
                    <dt className="text-brand-900/50">{metric.label}</dt>
                    <dd className="text-right font-medium text-brand-950">{metric.value}</dd>
                  </div>
                ))}
              </dl>

              {component.note && (
                <p className="mt-2 text-[10px] leading-relaxed text-brand-900/45">{component.note}</p>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Perkhidmatan platform"
          description="Status konfigurasi integrasi dan larian penyegerakan terkini."
          action={
            <Link
              href="/jainj/audit"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
            >
              Jejak audit <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />

        {configs.length === 0 ? (
          <EmptyState
            icon={Server}
            title="Tiada konfigurasi integrasi"
            description="Jalankan seed demo untuk mendaftarkan gerbang pembayaran, TPMJ, data induk JAINJ dan penyedia mesej."
          />
        ) : (
          <div className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4">
            {configs.map((config) => {
              const run = lastRuns.find((item) => item.integration === config.key);
              return (
                <div
                  key={config.key}
                  className="rounded-xl bg-sand/60 p-4 ring-1 ring-inset ring-brand-900/5"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-brand-950">{config.name}</p>
                      <p className="font-mono text-[10px] text-brand-900/40">{config.key}</p>
                    </div>
                    <Badge tone={config.enabled ? "success" : "neutral"}>
                      {config.enabled ? "Aktif" : "Dimatikan"}
                    </Badge>
                  </div>

                  <div className="mt-2">
                    <Badge tone={config.mode === "LIVE" ? "warning" : "info"}>{label(config.mode)}</Badge>
                  </div>

                  <div className="mt-3 border-t border-brand-900/5 pt-2 text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-brand-900/50">Larian terakhir</span>
                      {run ? <StatusBadge value={run.status} /> : <span className="text-brand-900/35">—</span>}
                    </div>
                    {run ? (
                      <p className="mt-1 text-brand-900/50">
                        {tarikhMasa(run.startedAt)} · {run.records} rekod
                      </p>
                    ) : (
                      <p className="mt-1 text-brand-900/40">Tiada larian direkodkan.</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="border-t border-brand-900/5 p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-900/50">
              Larian penyegerakan terkini
            </h3>
            <span className="text-[10px] text-brand-900/40">10 larian terbaharu (mock)</span>
          </div>

          {lastRuns.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Tiada larian penyegerakan"
              description="Larian akan direkodkan selepas penyegerakan integrasi dijalankan."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Integrasi</th>
                    <th>Arah</th>
                    <th>Status</th>
                    <th>Mula</th>
                    <th>Rekod</th>
                    <th>Log</th>
                  </tr>
                </thead>
                <tbody>
                  {lastRuns.slice(0, 10).map((run) => (
                    <tr key={run.id}>
                      <td className="text-xs font-medium text-brand-950">
                        {INTEGRATION_NAMES[run.integration] ?? run.integration}
                      </td>
                      <td className="text-xs">{label(run.direction)}</td>
                      <td>
                        <StatusBadge value={run.status} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-brand-900/60">
                        {tarikhMasa(run.startedAt)}
                      </td>
                      <td className="text-xs font-semibold">{run.records}</td>
                      <td className="max-w-[320px]">
                        <p className="truncate text-[11px] text-brand-900/55" title={run.log ?? undefined}>
                          {run.log ?? "—"}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
