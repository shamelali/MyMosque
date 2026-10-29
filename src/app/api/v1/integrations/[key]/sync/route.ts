import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import type { SyncRun } from "@prisma/client";
import { assertSameOrigin, handleApiError, HttpError, requireApiUser } from "@/lib/api";
import { audit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import {
  flushMessaging,
  reconcileTpmj,
  syncJainjMasterData,
} from "@/lib/integrations";

export const runtime = "nodejs";

const INTEGRATIONS = new Set(["jainj", "tpmj", "messaging"]);

export async function POST(
  request: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  try {
    const user = await requireApiUser(["JAINJ"]);
    assertSameOrigin(request);

    const { key } = await params;
    if (!INTEGRATIONS.has(key)) {
      throw new HttpError(404, "Integrasi tidak dikenali.");
    }

    let run: SyncRun | null = null;
    if (key === "jainj") {
      run = await syncJainjMasterData();
    } else if (key === "tpmj") {
      run = await reconcileTpmj();
    } else {
      await flushMessaging();
      run = await prisma.syncRun.findFirst({
        where: { integration: "messaging" },
        orderBy: { startedAt: "desc" },
      });
      if (!run) throw new HttpError(500, "Rekod penyegerakan mesej tidak dijumpai.");
    }

    if (!run) throw new HttpError(500, "Penyegerakan tidak menghasilkan rekod.");

    await audit({
      actor: user,
      action: "SYNC",
      entity: "SyncRun",
      entityId: run.id,
      after: {
        integration: key,
        status: run.status,
        records: run.records,
      },
    });

    revalidatePath("/system/ops");
    revalidatePath("/jainj");

    return NextResponse.json({ ok: true, run });
  } catch (error) {
    return handleApiError(error);
  }
}
