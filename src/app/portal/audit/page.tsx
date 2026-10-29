import type { Metadata } from "next";
import Link from "next/link";
import { Download, Info, SearchX, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { PORTAL_ROLES } from "@/lib/roles";
import { label, type Tone } from "@/lib/labels";
import { tarikhMasa } from "@/lib/utils";

export const metadata: Metadata = { title: "Jejak Audit" };

const ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "APPROVE",
  "REJECT",
  "EXPORT",
  "SYNC",
  "PAY",
] as const;

const ACTION_TONE: Record<string, Tone> = {
  CREATE: "success",
  UPDATE: "info",
  DELETE: "danger",
  LOGIN: "info",
  LOGOUT: "neutral",
  APPROVE: "success",
  REJECT: "danger",
  EXPORT: "warning",
  SYNC: "info",
  PAY: "success",
};

function pretty(value: string | null) {
  if (!value) return null;
  try {
    return JSON.stringify(JSON.parse(value), null, 2);
  } catch {
    return value;
  }
}

export default async function PortalAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tindakan?: string; entiti?: string }>;
}) {
  await requirePageUser(PORTAL_ROLES);
  const mosque = await currentMosque();
  const params = await searchParams;

  const tindakan = ACTIONS.includes((params.tindakan ?? "") as (typeof ACTIONS)[number])
    ? (params.tindakan as string)
    : "";
  const entiti = (params.entiti ?? "").trim();

  const where = {
    mosqueId: mosque.id,
    ...(tindakan ? { action: tindakan } : {}),
    ...(entiti ? { entity: entiti } : {}),
  };

  const [logs, entities] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { at: "desc" },
      take: 250,
    }),
    prisma.auditLog.findMany({
      where: { mosqueId: mosque.id },
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    }),
  ]);

  const hasFilter = Boolean(tindakan || entiti);
  const query = new URLSearchParams();
  if (tindakan) query.set("tindakan", tindakan);
  if (entiti) query.set("entiti", entiti);
  const exportHref = `/api/v1/audit/export${query.toString() ? `?${query.toString()}` : ""}`;

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Jejak Audit"
        description={`Rekod tindakan bagi ${mosque.name}. Halaman ini memaparkan 250 rekod terbaharu untuk tujuan pengawasan dan pematuhan.`}
        actions={
          <a href={exportHref} className="btn-secondary">
            <Download className="h-4 w-4" /> Eksport CSV
          </a>
        }
      />

      <div className="mb-6 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-relaxed text-amber-900 ring-1 ring-inset ring-amber-600/20">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            <strong>Log tidak boleh diubah atau dipadam.</strong> Setiap rekod mengandungi pelaku, masa,
            alamat IP dan payload sebelum/selepas tindakan. Eksport CSV turut direkodkan sebagai tindakan
            EXPORT.
          </span>
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader title="Tapis jejak" description="Semak mengikut jenis tindakan atau entiti." />
        <form action="/portal/audit" className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <label className="label" htmlFor="tindakan">
              Tindakan
            </label>
            <select id="tindakan" name="tindakan" defaultValue={tindakan} className="input w-auto">
              <option value="">Semua tindakan</option>
              {ACTIONS.map((value) => (
                <option key={value} value={value}>
                  {label(value)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="entiti">
              Entiti
            </label>
            <select id="entiti" name="entiti" defaultValue={entiti} className="input w-auto">
              <option value="">Semua entiti</option>
              {entities.map((item) => (
                <option key={item.entity} value={item.entity}>
                  {item.entity}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            <SlidersHorizontal className="h-4 w-4" /> Tapis
          </button>
          {hasFilter && (
            <Link href="/portal/audit" className="btn-ghost">
              Set semula
            </Link>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Rekod audit"
          description={`${logs.length} rekod dipaparkan (terbaharu dahulu, maksimum 250).`}
          action={
            <span className="inline-flex items-center gap-1 text-[11px] text-brand-900/40">
              <Info className="h-3.5 w-3.5" /> Baca sahaja
            </span>
          }
        />
        {logs.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Tiada rekod audit"
            description="Tiada jejak audit sepadan dengan penapis yang dipilih bagi masjid ini."
            action={
              hasFilter ? (
                <Link href="/portal/audit" className="btn-secondary">
                  Set semula penapis
                </Link>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Masa</th>
                  <th>Pelaku</th>
                  <th>Tindakan</th>
                  <th>Entiti</th>
                  <th>IP</th>
                  <th>Perubahan</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => {
                  const before = pretty(log.before);
                  const after = pretty(log.after);
                  return (
                    <tr key={log.id}>
                      <td className="whitespace-nowrap text-xs text-brand-900/60">
                        {tarikhMasa(log.at)}
                      </td>
                      <td>
                        <p className="text-xs font-medium text-brand-950">{log.actorEmail}</p>
                        <p className="text-[10px] text-brand-900/45">{label(log.actorRole)}</p>
                      </td>
                      <td>
                        <Badge tone={ACTION_TONE[log.action] ?? "neutral"}>{label(log.action)}</Badge>
                      </td>
                      <td>
                        <p className="text-xs">{log.entity}</p>
                        {log.entityId && (
                          <p className="max-w-[150px] truncate font-mono text-[10px] text-brand-900/40">
                            {log.entityId}
                          </p>
                        )}
                      </td>
                      <td className="whitespace-nowrap font-mono text-[10px] text-brand-900/50">
                        {log.ip ?? "—"}
                      </td>
                      <td>
                        {before || after ? (
                          <details>
                            <summary className="cursor-pointer whitespace-nowrap text-[11px] font-semibold text-brand-700 hover:text-brand-900">
                              Lihat JSON
                            </summary>
                            <div className="mt-2 space-y-2">
                              {before && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/40">
                                    Sebelum
                                  </p>
                                  <pre className="mt-0.5 max-h-48 max-w-[420px] overflow-auto rounded-lg bg-sand p-2 font-mono text-[10px] leading-relaxed text-brand-900/70">
                                    {before}
                                  </pre>
                                </div>
                              )}
                              {after && (
                                <div>
                                  <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/40">
                                    Selepas
                                  </p>
                                  <pre className="mt-0.5 max-h-48 max-w-[420px] overflow-auto rounded-lg bg-sand p-2 font-mono text-[10px] leading-relaxed text-brand-900/70">
                                    {after}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
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
    </div>
  );
}
