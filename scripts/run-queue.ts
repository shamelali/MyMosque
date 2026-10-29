/**
 * Background jobs (D04 cache/queue stand-in for the demo).
 * Production: BullMQ on Redis, same functions as workers.
 *
 *   npm run jobs:notifications
 *   npm run jobs:scoring
 *   npm run jobs:tpmj
 *   npm run jobs:jainj
 */
import { prisma } from "../src/lib/db";
import { computeAllScores } from "../src/lib/scoring";
import { flushMessaging, reconcileTpmj, syncJainjMasterData } from "../src/lib/integrations";
import { releaseExpiredLocks, releaseStaleBookings } from "../src/lib/quran";

async function main() {
  const job = process.argv[2];
  switch (job) {
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
      console.log("Guna: tsx scripts/run-queue.ts <notifications|scoring|tpmj|jainj|quran>");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
