/**
 * Background jobs with BullMQ on Redis (production).
 * Falls back to direct execution when REDIS_URL is not set (dev/demo).
 *
 *   Worker (continuous):   tsx scripts/run-queue.ts worker
 *   Enqueue one-off:       tsx scripts/run-queue.ts notifications|scoring|tpmj|jainj|quran
 *
 * Requires REDIS_URL when running in worker mode. Provision Redis externally
 * (Neon does not offer Redis natively — e.g. Upstash, Redis Cloud, or self-hosted).
 */
import { prisma } from "../src/lib/db";
import { computeAllScores } from "../src/lib/scoring";
import { flushMessaging, reconcileTpmj, syncJainjMasterData } from "../src/lib/integrations";
import { releaseExpiredLocks, releaseStaleBookings } from "../src/lib/quran";

const REDIS_URL = process.env.REDIS_URL;

async function runJob(name: string) {
  switch (name) {
    case "notifications": {
      const n = await flushMessaging();
      console.log(`Tersedia: ${n} mesej dihantar.`);
      break;
    }
    case "scoring": {
      const rows = await computeAllScores(0);
      console.log(`Skor dikira untuk ${rows.length} masjid bulan ini.`);
      break;
    }
    case "tpmj": {
      const run = await reconcileTpmj();
      console.log(run.log);
      break;
    }
    case "jainj": {
      const run = await syncJainjMasterData();
      console.log(run.log);
      break;
    }
    case "quran": {
      const locks = await releaseExpiredLocks();
      const stale = await releaseStaleBookings();
      console.log(`Kunci tamat: ${locks}. Tempahan tidak dibayar: ${stale}.`);
      break;
    }
    default:
      console.log("Guna: tsx scripts/run-queue.ts <worker|notifications|scoring|tpmj|jainj|quran>");
      process.exit(1);
  }
}

async function main() {
  const job = process.argv[2];

  // Direct execution mode (dev/demo without Redis).
  if (!REDIS_URL) {
    if (!job || job === "worker") {
      console.log("REDIS_URL tidak ditetapkan — menjalankan mod demo (ekulusi langsung).");
      if (job && job !== "worker") await runJob(job);
      else {
        await runJob("notifications");
        await runJob("scoring");
        await runJob("tpmj");
        await runJob("jainj");
        await runJob("quran");
      }
    } else {
      await runJob(job);
    }
    await prisma.$disconnect();
    return;
  }

  // BullMQ worker mode (production).
  const { Queue, Worker } = await import("bullmq");

  const queues = ["notifications", "scoring", "tpmj", "jainj", "quran"] as const;
  const connection = { url: REDIS_URL };

  const processors: Record<string, () => Promise<void>> = {
    notifications: async () => {
      const n = await flushMessaging();
      console.log(`[notifications] ${n} mesej dihantar.`);
    },
    scoring: async () => {
      const rows = await computeAllScores(0);
      console.log(`[scoring] ${rows.length} masjid.`);
    },
    tpmj: async () => {
      const run = await reconcileTpmj();
      console.log(`[tpmj] ${run.log}`);
    },
    jainj: async () => {
      const run = await syncJainjMasterData();
      console.log(`[jainj] ${run.log}`);
    },
    quran: async () => {
      const locks = await releaseExpiredLocks();
      const stale = await releaseStaleBookings();
      console.log(`[quran] kunci tamat: ${locks}, tempahan batal: ${stale}`);
    },
  };

  // Create queues (idempotent).
  for (const q of queues) {
    await new Queue(q, { connection });
  }

  // Start one worker per queue type.
  const workers = queues.map((name) => {
    const processor = processors[name];
    return new Worker(
      name,
      async (_job) => {
        await processor();
        return { ok: true };
      },
      { connection, concurrency: 5 },
    );
  });

  for (const w of workers) {
    w.on("completed", (_job, result) => {
      console.log(`[${w.name}] selesai`, result);
    });
    w.on("failed", (job, err) => {
      console.error(`[${w.name}] gagal job ${job?.id}:`, err.message);
    });
    w.on("error", (err) => {
      console.error(`[${w.name}] worker error:`, err.message);
    });
  }

  console.log("BullMQ worker berjalan. Tekan Ctrl+C untuk hentikan.");

  // Graceful shutdown.
  const shutdown = async () => {
    console.log("\nMenutup worker...");
    await Promise.all(workers.map((w) => w.close()));
    await prisma.$disconnect();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // If invoked with a specific job type, enqueue it and exit.
  if (job && queues.includes(job as (typeof queues)[number])) {
    const { Queue } = await import("bullmq");
    const q = new Queue(job, { connection });
    await q.add(job, {}, { attempts: 3, backoff: { type: "exponential", delay: 1000 } });
    console.log(`[${job}] job diserakkan ke antrian.`);
    await q.close();
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
