import { handleApiError, HttpError, requireApiUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { PORTAL_ROLES } from "@/lib/roles";

export const runtime = "nodejs";

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

function csvCell(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(PORTAL_ROLES);
    if (!user.mosqueId) {
      throw new HttpError(403, "Akaun anda belum dikaitkan dengan masjid.");
    }

    const url = new URL(request.url);
    const tindakanRaw = url.searchParams.get("tindakan") ?? "";
    const tindakan = ACTIONS.includes(tindakanRaw as (typeof ACTIONS)[number]) ? tindakanRaw : "";
    const entiti = (url.searchParams.get("entiti") ?? "").trim().slice(0, 120);

    const logs = await prisma.auditLog.findMany({
      where: {
        mosqueId: user.mosqueId,
        ...(tindakan ? { action: tindakan } : {}),
        ...(entiti ? { entity: entiti } : {}),
      },
      orderBy: { at: "desc" },
      take: 1000,
    });

    const header = [
      "masa",
      "pelaku",
      "peranan",
      "tindakan",
      "entiti",
      "id_entiti",
      "ip",
      "sebelum",
      "selepas",
    ];

    const lines = [
      header.join(","),
      ...logs.map((log) =>
        [
          log.at.toISOString(),
          log.actorEmail,
          log.actorRole,
          log.action,
          log.entity,
          log.entityId,
          log.ip,
          log.before,
          log.after,
        ]
          .map(csvCell)
          .join(","),
      ),
    ];

    const csv = `\uFEFF${lines.join("\r\n")}\r\n`;

    await audit({
      actor: user,
      action: "EXPORT",
      entity: "AuditLog",
      mosqueId: user.mosqueId,
      after: {
        format: "CSV",
        filters: { tindakan: tindakan || null, entiti: entiti || null },
        count: logs.length,
      },
    });

    const stamp = new Date().toISOString().slice(0, 10);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="jejak-audit-${stamp}.csv"`,
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
