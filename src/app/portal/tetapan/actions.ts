"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { flushMessaging, reconcileTpmj, syncJainjMasterData } from "@/lib/integrations";
import type { Role } from "@/lib/roles";

const BASE = "/portal/tetapan";
const MANAGERS: Role[] = ["BENDAHARI", "KETUA", "SETIAUSAHA"];

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

export async function updateIntegration(formData: FormData) {
  const user = await requirePageUser(MANAGERS);
  const key = text(formData, "key");

  const config = await prisma.integrationConfig.findUnique({ where: { key } });
  if (!config) fail("Integrasi tidak dijumpai.");

  const mode = text(formData, "mode");
  if (mode !== "MOCK" && mode !== "LIVE") fail("Mod integrasi tidak sah.");
  const enabled = formData.get("enabled") === "on";

  const updated = await prisma.integrationConfig.update({
    where: { key: config.key },
    data: { mode, enabled },
  });

  await audit({
    actor: user,
    action: "UPDATE",
    entity: "IntegrationConfig",
    entityId: config.key,
    mosqueId: user.mosqueId,
    before: { mode: config.mode, enabled: config.enabled },
    after: {
      mode: updated.mode,
      enabled: updated.enabled,
      note:
        updated.mode === "LIVE"
          ? "Mod LIVE disimpan sebagai tetapan demo; kelayakan penyedia sebenar diperlukan."
          : undefined,
    },
  });

  revalidatePath(BASE);
  revalidatePath("/system/ops");
  redirect(`${BASE}?selesai=tetapan`);
}

export async function syncIntegration(formData: FormData) {
  const user = await requirePageUser(MANAGERS);
  const key = text(formData, "key");

  const config = await prisma.integrationConfig.findUnique({ where: { key } });
  if (!config) fail("Integrasi tidak dijumpai.");
  if (!config.enabled) fail("Integrasi ini dimatikan. Aktifkan integrasi sebelum menyegerak.");

  type SyncSummary = { id: string; status: string; records: number };
  let run: SyncSummary | null = null;

  if (key === "jainj") {
    run = await syncJainjMasterData();
  } else if (key === "tpmj") {
    run = await reconcileTpmj();
  } else if (key === "messaging") {
    await flushMessaging();
    run = await prisma.syncRun.findFirst({
      where: { integration: "messaging" },
      orderBy: { startedAt: "desc" },
      select: { id: true, status: true, records: true },
    });
  } else {
    fail("Integrasi ini tidak menyokong penyegerakan manual.");
  }

  if (!run) fail("Penyegerakan tidak menghasilkan rekod.");

  await audit({
    actor: user,
    action: "SYNC",
    entity: "SyncRun",
    entityId: run.id,
    mosqueId: user.mosqueId,
    after: { integration: key, status: run.status, records: run.records },
  });

  revalidatePath(BASE);
  revalidatePath("/system/ops");
  redirect(`${BASE}?selesai=segerak`);
}
