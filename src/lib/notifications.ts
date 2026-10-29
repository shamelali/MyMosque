import { prisma } from "@/lib/db";

// P04 notifications. Queued in Postgres, delivered by the mock messaging adapter
// (X04). Production swaps the adapter for the chosen SMS/WhatsApp provider.

export type NotificationInput = {
  channel: "SMS" | "WHATSAPP" | "EMAIL" | "INAP";
  to: string;
  template: string;
  subject?: string | null;
  body: string;
  userId?: string | null;
  mosqueId?: string | null;
  payload?: unknown;
};

export async function notify(input: NotificationInput) {
  const row = await prisma.notification.create({
    data: {
      channel: input.channel,
      to: input.to,
      template: input.template,
      subject: input.subject ?? null,
      body: input.body,
      userId: input.userId ?? null,
      mosqueId: input.mosqueId ?? null,
      payload: input.payload === undefined ? null : JSON.stringify(input.payload),
      status: "BERGILIR",
    },
  });
  // Demo adapter delivers immediately so the UI reflects reality.
  return deliver(row.id);
}

export async function deliver(id: string) {
  const row = await prisma.notification.findUnique({ where: { id } });
  if (!row || row.status === "DIHANTAR") return row;

  const failure = process.env.MESSAGING_FAIL === "1" ? "Penyedia mesej tidak tersedia (simulasi)." : null;
  if (failure) {
    return prisma.notification.update({ where: { id }, data: { status: "GAGAL", error: failure } });
  }
  return prisma.notification.update({
    where: { id },
    data: { status: "DIHANTAR", sentAt: new Date() },
  });
}

/** Drain queued notifications (used by scripts/run-queue.ts and the retry button). */
export async function deliverQueued(limit = 50) {
  const queued = await prisma.notification.findMany({
    where: { status: "BERGILIR" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });
  const results = [];
  for (const row of queued) results.push(await deliver(row.id));
  return results;
}
