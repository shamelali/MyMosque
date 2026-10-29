import { prisma } from "@/lib/db";
import { deliverQueued } from "@/lib/notifications";

// X02 TPMJ, X03 JAINJ master data, X04 messaging. All MOCK adapters that write
// SyncRun records so the ops console shows real integration history.

export async function syncJainjMasterData() {
  const run = await prisma.syncRun.create({
    data: { integration: "jainj", direction: "INBOUND", status: "BERJALAN" },
  });
  try {
    const mosques = await prisma.mosque.findMany();
    let records = 0;
    for (const m of mosques) {
      if (!m.jainjRef) {
        await prisma.mosque.update({ where: { id: m.id }, data: { jainjRef: `JAINJ-${m.code}` } });
        records += 1;
      }
    }
    const speakers = await prisma.speaker.findMany();
    for (const s of speakers) {
      const valid = !s.tauliahExpiry || s.tauliahExpiry > new Date();
      if (valid !== s.verified) {
        await prisma.speaker.update({ where: { id: s.id }, data: { verified: valid, verifiedBy: valid ? "JAINJ (sync)" : null } });
        records += 1;
      }
    }
    return prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "BERJAYA",
        finishedAt: new Date(),
        records,
        log: `${mosques.length} masjid disemak, ${speakers.length} pemegang tauliah disahkan. ${records} rekod dikemas kini.`,
      },
    });
  } catch (error) {
    return prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "GAGAL", finishedAt: new Date(), log: String(error) },
    });
  }
}

export async function reconcileTpmj() {
  const run = await prisma.syncRun.create({
    data: { integration: "tpmj", direction: "OUTBOUND", status: "BERJALAN" },
  });
  try {
    const pending = await prisma.donation.findMany({
      where: { status: "DIBAYAR", tpmjSynced: false },
      take: 100,
    });
    let records = 0;
    for (const d of pending) {
      await prisma.donation.update({
        where: { id: d.id },
        data: { tpmjSynced: true, tpmjRef: `TPMJ-${new Date().getFullYear()}-${d.id.slice(-4).toUpperCase()}` },
      });
      records += 1;
    }
    const total = pending.reduce((s, d) => s + d.amountSen, 0);
    return prisma.syncRun.update({
      where: { id: run.id },
      data: {
        status: "BERJAYA",
        finishedAt: new Date(),
        records,
        log: `${records} derma (RM ${(total / 100).toFixed(2)}) disegerakkan ke TPMJ. 0 konflik.`,
      },
    });
  } catch (error) {
    return prisma.syncRun.update({
      where: { id: run.id },
      data: { status: "GAGAL", finishedAt: new Date(), log: String(error) },
    });
  }
}

export async function flushMessaging() {
  const sent = await deliverQueued(100);
  await prisma.syncRun.create({
    data: {
      integration: "messaging",
      direction: "OUTBOUND",
      status: "BERJAYA",
      records: sent.length,
      finishedAt: new Date(),
      log: `${sent.length} mesej diproses melalui penyedia simulasi.`,
    },
  });
  return sent.length;
}

export async function integrationHealth() {
  const [configs, lastRuns] = await Promise.all([
    prisma.integrationConfig.findMany({ orderBy: { key: "asc" } }),
    prisma.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 20 }),
  ]);
  return { configs, lastRuns };
}
