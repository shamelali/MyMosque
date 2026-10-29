"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { commissionFor } from "@/lib/quran";
import { label } from "@/lib/labels";
import { bulanTahun, rm } from "@/lib/utils";
import { requireTutor } from "../_lib";

const BASE = "/tutor/bayaran";

function fail(message: string): never {
  redirect(`${BASE}?ralat=${encodeURIComponent(message)}`);
}

function maklum(message: string): never {
  redirect(`${BASE}?maklum=${encodeURIComponent(message)}`);
}

export async function requestPayout() {
  const { user, tutor } = await requireTutor();

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const period = bulanTahun(now.getMonth() + 1, now.getFullYear());

  const existing = await prisma.payout.findFirst({
    where: {
      tutorId: tutor.id,
      periodStart: { lt: monthEnd },
      periodEnd: { gt: monthStart },
    },
  });
  if (existing) {
    fail(
      `Permohonan bayaran untuk ${period} sudah wujud (status: ${label(existing.status)}). Sila tunggu proses pembayaran oleh masjid.`,
    );
  }

  const result = await prisma.quranBooking.aggregate({
    where: {
      tutorId: tutor.id,
      status: { in: ["DISAHKAN", "SELESAI"] },
      slot: { date: { gte: monthStart, lt: monthEnd } },
    },
    _sum: { amountSen: true },
    _count: { _all: true },
  });

  const grossSen = result._sum.amountSen ?? 0;
  if (result._count._all === 0 || grossSen <= 0) {
    fail(`Tiada tempahan disahkan atau selesai untuk ${period}. Permohonan bayaran belum boleh dibuat.`);
  }

  const commissionSen = commissionFor(grossSen);
  const netSen = grossSen - commissionSen;

  const payout = await prisma.payout.create({
    data: {
      tutorId: tutor.id,
      mosqueId: tutor.mosqueId,
      periodStart: monthStart,
      periodEnd: monthEnd,
      grossSen,
      commissionSen,
      netSen,
      status: "MENUNGGU",
    },
  });

  await notify({
    channel: "INAP",
    to: user.email ?? "tutor@spmj.local",
    template: "permohonan_bayaran",
    subject: `Permohonan bayaran ${period} diterima`,
    body: `Permohonan bayaran anda bagi ${period} telah diterima. Kasar ${rm(
      grossSen,
    )}, komisen platform ${rm(commissionSen)} (15%), bersih ${rm(
      netSen,
    )}. Status: menunggu pembayaran oleh masjid.`,
    userId: user.id,
    mosqueId: tutor.mosqueId,
    payload: { payoutId: payout.id, periodStart: monthStart.toISOString(), periodEnd: monthEnd.toISOString() },
  });

  await audit({
    actor: user,
    action: "CREATE",
    entity: "Payout",
    entityId: payout.id,
    mosqueId: tutor.mosqueId,
    after: {
      tutorId: tutor.id,
      periodStart: monthStart.toISOString(),
      periodEnd: monthEnd.toISOString(),
      grossSen,
      commissionSen,
      netSen,
      status: "MENUNGGU",
      bookingCount: result._count._all,
    },
  });

  revalidatePath(BASE);
  revalidatePath("/tutor");
  revalidatePath("/portal/quran");
  maklum(`Permohonan bayaran ${rm(netSen)} untuk ${period} telah dihantar. Status: menunggu.`);
}
