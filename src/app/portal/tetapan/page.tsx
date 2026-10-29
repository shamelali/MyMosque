import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock, Info, Plug, RefreshCw, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { PORTAL_ROLES, type Role } from "@/lib/roles";
import { label, type Tone } from "@/lib/labels";
import { percent, tarikhMasa } from "@/lib/utils";
import { integrationHealth } from "@/lib/integrations";
import { syncIntegration, updateIntegration } from "./actions";

export const metadata: Metadata = { title: "Integrasi & Tetapan" };

const MANAGER_ROLES: Role[] = ["BENDAHARI", "KETUA", "SETIAUSAHA"];
const ROLE_ORDER = ["KETUA", "SETIAUSAHA", "BENDAHARI", "AJK", "JAINJ", "AUDITOR", "TUTOR", "JEMAAH"] as const;
const OFFICER_ROLES = new Set(["KETUA", "SETIAUSAHA", "BENDAHARI", "AJK", "JAINJ", "AUDITOR"]);

const SECURITY_TONE: Record<string, Tone> = {
  LOGIN: "info",
  LOGOUT: "neutral",
  EXPORT: "warning",
  APPROVE: "success",
  REJECT: "danger",
};

function parseConfig(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { nilai: parsed };
  } catch {
    return { mentah: raw };
  }
}

function valueText(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value) ?? String(value);
}

export default async function TetapanPage({
  searchParams,
}: {
  searchParams: Promise<{ selesai?: string; ralat?: string }>;
}) {
  const user = await requirePageUser(PORTAL_ROLES);
  const mosque = await currentMosque();
  const params = await searchParams;
  const canManage = MANAGER_ROLES.includes(user.role);

  const [health, users, securityLogs] = await Promise.all([
    integrationHealth(),
    prisma.user.findMany({ select: { role: true, mfaEnabled: true } }),
    prisma.auditLog.findMany({
      where: {
        mosqueId: mosque.id,
        action: { in: ["LOGIN", "LOGOUT", "EXPORT", "APPROVE", "REJECT"] },
      },
      orderBy: { at: "desc" },
      take: 5,
    }),
  ]);

  const { configs, lastRuns } = health;
  const anyLive = configs.some((config) => config.mode === "LIVE");
  const totalUsers = users.length;
  const mfaUsers = users.filter((account) => account.mfaEnabled).length;
  const officers = users.filter((account) => OFFICER_ROLES.has(account.role));
  const mfaOfficers = officers.filter((account) => account.mfaEnabled).length;

  const roleStats = ROLE_ORDER.map((role) => ({
    role,
    count: users.filter((account) => account.role === role).length,
  })).filter((row) => row.count > 0);

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Integrasi & Tetapan"
        description="Urus mod sambungan integrasi platform, jalankan penyegerakan dan semak ringkasan identiti serta keselamatan."
        actions={<Badge tone={anyLive ? "warning" : "info"}>{anyLive ? "LIVE dipilih" : "Semua MOCK"}</Badge>}
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}
      {params.selesai === "tetapan" && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          Tetapan integrasi telah dikemas kini dan direkodkan dalam jejak audit.
        </p>
      )}
      {params.selesai === "segerak" && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          Penyegerakan selesai. Semak status larian terkini pada kad integrasi.
        </p>
      )}

      <div className="mb-6 rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Semua integrasi berjalan dalam mod simulasi (MOCK). Menukar ke LIVE hanya merekod pilihan
            tetapan dan tidak membuat sambungan sebenar. Kelayakan penyedia sebenar diperlukan sebelum
            sambungan langsung dibenarkan.
          </span>
        </p>
      </div>

      {anyLive && (
        <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-600/20">
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Sekurang-kurangnya satu integrasi berada dalam mod LIVE. Ini kekal sebagai demo —
              <strong> kelayakan penyedia sebenar diperlukan</strong> dan tiada transaksi sebenar diproses.
            </span>
          </p>
        </div>
      )}

      {configs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Plug}
            title="Tiada konfigurasi integrasi"
            description="Jalankan seed demo untuk mendaftarkan gerbang pembayaran, TPMJ, data induk JAINJ dan penyedia mesej."
          />
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          {configs.map((config) => {
            const summary = parseConfig(config.config);
            const latestRun =
              config.key === "gateway"
                ? undefined
                : lastRuns.find((run) => run.integration === config.key);
            const supportsSync = config.key !== "gateway";

            return (
              <Card key={config.key}>
                <CardHeader
                  title={config.name}
                  description={<span className="font-mono text-[10px]">{config.key}</span>}
                  action={
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge tone={config.mode === "LIVE" ? "warning" : "info"}>{label(config.mode)}</Badge>
                      <Badge tone={config.enabled ? "success" : "neutral"}>
                        {config.enabled ? "Aktif" : "Dimatikan"}
                      </Badge>
                    </div>
                  }
                />
                <div className="space-y-4 p-5">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/40">
                      Konfigurasi
                    </p>
                    {summary ? (
                      <dl className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                        {Object.entries(summary).map(([field, value]) => (
                          <div key={field} className="flex items-baseline gap-1.5 text-xs">
                            <dt className="shrink-0 font-medium text-brand-900/50">{field}</dt>
                            <dd className="break-all font-mono text-[11px] text-brand-900/75">
                              {valueText(value)}
                            </dd>
                          </div>
                        ))}
                      </dl>
                    ) : (
                      <p className="mt-1 text-xs text-brand-900/45">Tiada konfigurasi tambahan.</p>
                    )}
                  </div>

                  <div className="rounded-xl bg-sand/60 p-3">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-medium text-brand-900/60">Penyegerakan terakhir</span>
                      {latestRun ? (
                        <StatusBadge value={latestRun.status} />
                      ) : (
                        <Badge tone="neutral">Tiada</Badge>
                      )}
                    </div>
                    {latestRun ? (
                      <>
                        <p className="mt-1 text-[11px] text-brand-900/55">
                          {tarikhMasa(latestRun.startedAt)} · {latestRun.records} rekod
                        </p>
                        {latestRun.log && (
                          <p className="mt-1 text-[10px] leading-relaxed text-brand-900/45">
                            {latestRun.log}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="mt-1 text-[11px] text-brand-900/45">
                        {supportsSync
                          ? "Belum ada larian direkodkan."
                          : "Gerbang bayaran tidak mempunyai penyegerakan manual."}
                      </p>
                    )}
                  </div>

                  {config.mode === "LIVE" && (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/20">
                      Kelayakan penyedia sebenar diperlukan. Mod LIVE hanya disimpan sebagai tetapan demo.
                    </p>
                  )}

                  {canManage && (
                    <div className="flex flex-wrap items-end gap-2 border-t border-brand-900/5 pt-4">
                      <form action={updateIntegration} className="flex flex-wrap items-end gap-2">
                        <input type="hidden" name="key" value={config.key} />
                        <div>
                          <label className="label" htmlFor={`mode-${config.key}`}>
                            Mod
                          </label>
                          <select
                            id={`mode-${config.key}`}
                            name="mode"
                            defaultValue={config.mode}
                            className="input w-auto"
                          >
                            <option value="MOCK">Simulasi (MOCK)</option>
                            <option value="LIVE">Sebenar (LIVE)</option>
                          </select>
                        </div>
                        <label className="flex items-center gap-2 pb-2 text-xs font-medium text-brand-900/70">
                          <input
                            type="checkbox"
                            name="enabled"
                            defaultChecked={config.enabled}
                            className="h-4 w-4 rounded border-brand-900/20 text-brand-700 focus:ring-brand-600"
                          />
                          Aktif
                        </label>
                        <button type="submit" className="btn-secondary">
                          Simpan
                        </button>
                      </form>

                      {supportsSync && (
                        <form action={syncIntegration}>
                          <input type="hidden" name="key" value={config.key} />
                          <button
                            type="submit"
                            className="btn-primary"
                            disabled={!config.enabled}
                            title={!config.enabled ? "Aktifkan integrasi sebelum menyegerak." : undefined}
                          >
                            <RefreshCw className="h-4 w-4" /> Segerak
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!canManage && (
        <Card className="mt-6">
          <CardHeader title="Kebenaran tetapan" description="Paparan baca sahaja untuk peranan anda." />
          <p className="p-5 text-xs leading-relaxed text-brand-900/55">
            Hanya Bendahari, Pengerusi dan Setiausaha boleh mengubah mod, status atau menjalankan
            penyegerakan integrasi.
          </p>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Identiti & keselamatan"
          description="Ringkasan akaun platform, liputan MFA dan aktiviti sensitif masjid ini."
          action={
            <Link
              href="/system/keselamatan"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Butiran
              <ArrowRight className="h-3 w-3" />
            </Link>
          }
        />
        <div className="grid gap-5 p-5 sm:grid-cols-2">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/40">
              Akaun mengikut peranan
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {roleStats.length === 0 ? (
                <span className="text-xs text-brand-900/45">Tiada akaun berdaftar.</span>
              ) : (
                roleStats.map(({ role, count }) => (
                  <Badge key={role} tone="neutral">
                    {label(role)} · {count}
                  </Badge>
                ))
              )}
            </div>
            <p className="mt-3 text-xs text-brand-900/55">Jumlah {totalUsers} akaun berdaftar dalam demo.</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/40">
              Liputan MFA
            </p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <p className="text-2xl font-semibold tracking-tight text-brand-950">
                {percent(mfaUsers, totalUsers)}%
              </p>
              <p className="pb-1 text-xs text-brand-900/50">
                {mfaUsers} / {totalUsers} akaun
              </p>
            </div>
            <Progress value={percent(mfaUsers, totalUsers)} className="mt-2" />
            <p className="mt-2 text-xs text-brand-900/55">
              {mfaOfficers} daripada {officers.length} pegawai/pentadbir mengaktifkan MFA.
            </p>
          </div>
        </div>

        <div className="border-t border-brand-900/5 p-5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/40">
              5 peristiwa keselamatan terakhir
            </p>
            <Clock className="h-3.5 w-3.5 text-brand-900/30" />
          </div>
          {securityLogs.length === 0 ? (
            <p className="mt-2 text-xs text-brand-900/45">
              Tiada peristiwa LOGIN, EXPORT atau APPROVE direkodkan bagi masjid ini.
            </p>
          ) : (
            <ul className="mt-2 divide-y divide-brand-900/5">
              {securityLogs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-brand-950">{log.actorEmail}</p>
                    <p className="text-[10px] text-brand-900/45">
                      {log.entity}
                      {log.entityId ? ` · ${log.entityId}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={SECURITY_TONE[log.action] ?? "neutral"}>{label(log.action)}</Badge>
                    <span className="whitespace-nowrap text-[10px] text-brand-900/40">
                      {tarikhMasa(log.at)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>
    </div>
  );
}
