import { prisma } from "@/lib/db";
import type { ApiUser } from "@/lib/api";

type AuditInput = {
  actor: Pick<ApiUser, "id" | "email" | "role">;
  action: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT" | "APPROVE" | "REJECT" | "EXPORT" | "SYNC" | "PAY";
  entity: string;
  entityId?: string | null;
  mosqueId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
};

/** Append-only audit trail. There is deliberately no update or delete path. */
export async function audit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      actorId: input.actor.id || null,
      actorEmail: input.actor.email ?? "sistem",
      actorRole: input.actor.role,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId ?? null,
      mosqueId: input.mosqueId ?? null,
      before: input.before === undefined ? null : JSON.stringify(input.before),
      after: input.after === undefined ? null : JSON.stringify(input.after),
      ip: input.ip ?? null,
    },
  });
}

export async function auditList(mosqueId?: string | null, take = 100) {
  return prisma.auditLog.findMany({
    where: mosqueId ? { mosqueId } : undefined,
    orderBy: { at: "desc" },
    take,
    include: { actor: { select: { name: true } } },
  });
}
