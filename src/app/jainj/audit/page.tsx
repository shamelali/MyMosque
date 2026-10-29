import type { Metadata } from "next";
import Link from "next/link";
import { Info, Search, SearchX, SlidersHorizontal } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
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

export default async function JejakAuditPage({
  searchParams,
}: {
  searchParams: Promise<{ tindakan?: string; entiti?: string; masjid?: string }>;
}) {
  const params = await searchParams;
  const action = ACTIONS.includes((params.tindakan ?? "") as (typeof ACTIONS)[number])
    ? (params.tindakan as string)
    : "";
  const entity = (params.entiti ?? "").trim();
  const masjid = (params.masjid ?? "").trim();

  const where = {
    ...(action ? { action } : {}),
    ...(entity ? { entity } : {}),
    ...(masjid ? { mosqueId: masjid } : {}),
  };

  const [logs, entities, mosques] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { mosque: { select: { name: true } } },
      orderBy: { at: "desc" },
      take: 200,
    }),
    prisma.auditLog.findMany({
      distinct: ["entity"],
      select: { entity: true },
      orderBy: { entity: "asc" },
    }),
    prisma.mosque.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const hasFilter = Boolean(action || entity || masjid);

  return (
    <div className="mobile-pad">
      <PageHeader
        eyebrow="Data induk"
        title="Jejak Audit"
        description="Rekod tindakan merentas semua masjid bagi tujuan pengawasan dan pematuhan."
      />

      <div className="mb-6 rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Jejak audit adalah tambah-sahaja dan tidak boleh diubah atau dipadam. Halaman ini
            memaparkan 200 rekod terbaharu mengikut masa, termasuk payload sebelum dan selepas
            tindakan.
          </span>
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader
          title="Tapis jejak"
          description="Semak mengikut jenis tindakan, entiti atau masjid."
        />
        <form action="/jainj/audit" className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <label className="label" htmlFor="tindakan">
              Tindakan
            </label>
            <select id="tindakan" name="tindakan" defaultValue={action} className="input w-auto">
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
            <select id="entiti" name="entiti" defaultValue={entity} className="input w-auto">
              <option value="">Semua entiti</option>
              {entities.map((item) => (
                <option key={item.entity} value={item.entity}>
                  {item.entity}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[190px]">
            <label className="label" htmlFor="masjid">
              Masjid
            </label>
            <select id="masjid" name="masjid" defaultValue={masjid} className="input">
              <option value="">Semua masjid</option>
              {mosques.map((mosque) => (
                <option key={mosque.id} value={mosque.id}>
                  {mosque.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            <SlidersHorizontal className="h-4 w-4" /> Tapis
          </button>
          {hasFilter && (
            <Link href="/jainj/audit" className="btn-ghost">
              Set semula
            </Link>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Rekod audit"
          description={`${logs.length} rekod dipaparkan (terbaharu dahulu, maksimum 200).`}
          action={
            <span className="inline-flex items-center gap-1 text-[11px] text-brand-900/40">
              <Search className="h-3.5 w-3.5" /> Baca sahaja
            </span>
          }
        />
        {logs.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Tiada rekod audit"
            description="Tiada jejak audit sepadan dengan penapis yang dipilih."
            action={
              hasFilter ? (
                <Link href="/jainj/audit" className="btn-secondary">
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
                  <th>Masjid</th>
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
                          <p className="max-w-[140px] truncate font-mono text-[10px] text-brand-900/40">
                            {log.entityId}
                          </p>
                        )}
                      </td>
                      <td className="text-xs text-brand-900/65">{log.mosque?.name ?? "—"}</td>
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
