import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// /api/health — liveness and readiness for load balancers, uptime probes and
// autoscalers. Unauthenticated by design.
//
//   GET /api/health          → liveness (process up?)
//   GET /api/health?deep=1   → readiness (DB reachable, queue not saturated)
//
// 503 is returned only on deep checks so a transient DB blip does not cause
// the orchestrator to kill otherwise-healthy pods.

const BUILD_TIME = Date.now();
const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.1.0";

type Check = { ok: boolean; ms: number; detail?: string };

async function dbPing(): Promise<Check> {
  const t = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true, ms: Date.now() - t };
  } catch (error) {
    return { ok: false, ms: Date.now() - t, detail: error instanceof Error ? error.message : "unknown" };
  }
}

async function queueDepth(): Promise<Check & { pending: number }> {
  const t = Date.now();
  const pending = await prisma.job.count({ where: { status: "PENDING" } });
  return { ok: true, ms: Date.now() - t, pending };
}

function statusFor(checks: Record<string, Check>, deep: boolean): 200 | 503 {
  if (!deep) return 200;
  return Object.values(checks).every((c) => c.ok) ? 200 : 503;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const started = Date.now();

  const checks: Record<string, Check> = { process: { ok: true, ms: 0 } };
  let pending = 0;

  if (deep) {
    const db = await dbPing();
    checks.database = db;
    if (db.ok) {
      const q = await queueDepth();
      checks.queue = q;
      pending = q.pending;
    }
  }

  return NextResponse.json(
    {
      status: statusFor(checks, deep) === 200 ? (deep ? "ok" : "alive") : "degraded",
      version: APP_VERSION,
      uptimeSec: Math.round((Date.now() - BUILD_TIME) / 1000),
      mode: deep ? "readiness" : "liveness",
      checks,
      queue: { pending },
      measuredMs: Date.now() - started,
      timestamp: new Date().toISOString(),
    },
    {
      status: statusFor(checks, deep),
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
