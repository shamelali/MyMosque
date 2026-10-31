import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { issueReceipt } from "@/lib/documents";
import { notify } from "@/lib/notifications";
import { rm } from "@/lib/utils";

// X01 payment gateway. MOCK mode simulates a licensed gateway with split settlement:
// funds settle to the mosque or tutor, commission is deducted at source, and the
// platform never holds the money. Swap createIntent/confirm with the provider SDK.

export const COMMISSION_PCT = 1.5;

export type PaymentPurpose = "DONATION" | "QURBAN" | "QURAN_BOOKING" | "STORE";

export type Intent = {
  ref: string;
  amountSen: number;
  purpose: PaymentPurpose;
  description: string;
  checkoutToken: string;
  expiresAt: Date;
};

export function splitSettlement(amountSen: number, commissionPct = COMMISSION_PCT) {
  const commissionSen = Math.round((amountSen * commissionPct) / 100);
  return { grossSen: amountSen, commissionSen, netSen: amountSen - commissionSen };
}

/** Create a gateway intent. In MOCK mode the ref is a local token; no network call. */
export async function createIntent(input: {
  amountSen: number;
  purpose: PaymentPurpose;
  description: string;
  payerName: string;
  payerEmail: string;
  reference: string;
}): Promise<Intent> {
  const mode = await integrationMode("gateway");
  if (mode === "LIVE") {
    throw new Error("Gerbang pembayaran sebenar belum disambungkan dalam demo ini.");
  }
  return {
    ref: `MOCK-${input.purpose.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`,
    amountSen: input.amountSen,
    purpose: input.purpose,
    description: input.description,
    checkoutToken: `chk_${randomBytes(12).toString("hex")}`,
    expiresAt: new Date(Date.now() + 15 * 60_000),
  };
}

async function integrationMode(key: string) {
  const cfg = await prisma.integrationConfig.findUnique({ where: { key } });
  return cfg?.mode ?? "MOCK";
}

/**
 * Confirm a mocked payment and move the domain record forward atomically-ish.
 * Returns a redirect path for the UI.
 */
export async function confirmPayment(input: { kind: PaymentPurpose; id: string; actorEmail: string }) {
  if (input.kind === "DONATION") {
    const donation = await prisma.donation.findUnique({ where: { id: input.id } });
    if (!donation) throw new Error("Derma tidak dijumpai.");
    if (donation.status === "DIBAYAR") return { already: true, mosqueId: donation.mosqueId };

    const ref = `MOCK-DON-${Date.now().toString(36).toUpperCase()}`;
    const paidAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.donation.update({
        where: { id: donation.id },
        data: { status: "DIBAYAR", paidAt, gatewayRef: ref, method: donation.method ?? "QR" },
      });
      if (donation.campaignId) {
        await tx.campaign.update({
          where: { id: donation.campaignId },
          data: { raisedSen: { increment: donation.amountSen } },
        });
      }
    });

    const receipt = await issueReceipt({
      mosqueId: donation.mosqueId,
      issuedTo: donation.anonymous ? "Penderma Tanpa Nama" : donation.donorName,
      email: donation.donorEmail,
      amountSen: donation.amountSen,
      purpose: "Derma — Tabung masjid",
      method: "DuitNow QR (simulasi)",
      donationId: donation.id,
    });
    await notify({
      channel: "EMAIL",
      to: donation.donorEmail ?? input.actorEmail,
      template: "resit_derma",
      subject: `Resit ${receipt.number}`,
      body: `Terima kasih. Derma ${rm(donation.amountSen)} telah diterima. Resit ${receipt.number} dilampirkan dalam akaun anda.`,
      mosqueId: donation.mosqueId,
      payload: { receiptId: receipt.id },
    });
    return { already: false, mosqueId: donation.mosqueId, receiptNumber: receipt.number };
  }

  if (input.kind === "QURBAN") {
    const order = await prisma.qurbanOrder.findUnique({ where: { id: input.id }, include: { program: true } });
    if (!order) throw new Error("Pesanan qurban tidak dijumpai.");
    if (order.status === "DIBAYAR") return { already: true, mosqueId: order.program.mosqueId };

    const ref = `MOCK-QB-${Date.now().toString(36).toUpperCase()}`;
    await prisma.qurbanOrder.update({
      where: { id: order.id },
      data: { status: "DIBAYAR", paidAt: new Date(), gatewayRef: ref },
    });
    const receipt = await issueReceipt({
      mosqueId: order.program.mosqueId,
      issuedTo: order.customerName,
      email: order.email,
      amountSen: order.amountSen,
      purpose: `Qurban ${order.program.year} — ${order.shares} bahagian (${order.program.animal})`,
      method: "FPX (simulasi)",
    });
    await notify({
      channel: "WHATSAPP",
      to: order.phone ?? input.actorEmail,
      template: "resit_qurban",
      subject: "Pesanan qurban disahkan",
      body: `Pesanan ${order.orderNo} disahkan. ${order.shares} bahagian qurban ${order.program.year}. Resit ${receipt.number}.`,
      mosqueId: order.program.mosqueId,
    });
    return { already: false, mosqueId: order.program.mosqueId, receiptNumber: receipt.number };
  }

  if (input.kind === "STORE") {
    const order = await prisma.order.findUnique({
      where: { id: input.id },
      include: { items: true, mosque: true },
    });
    if (!order) throw new Error("Pesanan kedai tidak dijumpai.");
    if (order.status === "DIBAYAR") return { already: true, mosqueId: order.mosqueId };

    const ref = `MOCK-STORE-${Date.now().toString(36).toUpperCase()}`;
    let entryId: string | null = null;
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: "DIBAYAR", paidAt: new Date(), gatewayRef: ref },
      });
      for (const item of order.items) {
        await tx.storeItem.update({
          where: { id: item.itemId },
          data: { stock: { decrement: item.qty } },
        });
      }
      const hasilAccount = await tx.ledgerAccount.findFirst({
        where: { mosqueId: order.mosqueId, type: "HASIL" },
      });
      if (hasilAccount) {
        const entry = await tx.ledgerEntry.create({
          data: {
            mosqueId: order.mosqueId,
            accountId: hasilAccount.id,
            date: new Date(),
            description: `Jualan kedai — ${order.orderNo}`,
            category: "STORE",
            type: "MASUK",
            amountSen: order.netSen,
            reference: order.id,
            method: "KAD",
            status: "POSTED",
            createdById: undefined,
          },
        });
        entryId = entry.id;
      }
    });

    const receipt = await issueReceipt({
      mosqueId: order.mosqueId,
      issuedTo: order.buyerName,
      email: order.buyerEmail,
      amountSen: order.totalSen,
      purpose: `Pesanan kedai ${order.orderNo}`,
      method: "Kad (simulasi)",
      entryId,
    });
    await notify({
      channel: "EMAIL",
      to: order.buyerEmail,
      template: "resit_beli",
      subject: `Resit ${receipt.number}`,
      body: `Terima kasih. Pesanan ${order.orderNo} telah dibayar. Resit ${receipt.number} dilampirkan dalam akaun anda.`,
      mosqueId: order.mosqueId,
      payload: { receiptId: receipt.id },
    });
    return { already: false, mosqueId: order.mosqueId, receiptNumber: receipt.number };
  }

  const booking = await prisma.quranBooking.findUnique({ where: { id: input.id }, include: { tutor: true } });
  if (!booking) throw new Error("Tempahan tidak dijumpai.");
  if (booking.status === "DISAHKAN") return { already: true, mosqueId: booking.tutor.mosqueId };

  if (!booking.tutor.mosqueId) throw new Error("Tutor belum dikaitkan dengan masjid.");
  const ref = `MOCK-QRN-${Date.now().toString(36).toUpperCase()}`;
  await prisma.$transaction([
    prisma.quranBooking.update({
      where: { id: booking.id },
      data: { status: "DISAHKAN", gatewayRef: ref },
    }),
    prisma.quranSlot.update({ where: { id: booking.slotId }, data: { status: "DITEMPAH" } }),
    prisma.slotLock.deleteMany({ where: { slotId: booking.slotId } }),
  ]);
  const receipt = await issueReceipt({
    mosqueId: booking.tutor.mosqueId,
    issuedTo: `${booking.parentName} (untuk ${booking.studentName})`,
    email: booking.parentEmail,
    amountSen: booking.amountSen,
    purpose: `Tempahan kelas Al-Quran — ${booking.hours} jam bersama ${booking.tutor.name}`,
    method: "Kad (simulasi)",
  });
  return { already: false, mosqueId: booking.tutor.mosqueId, receiptNumber: receipt.number };
}
