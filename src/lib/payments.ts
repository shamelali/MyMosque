import { randomBytes } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { issueReceipt } from "@/lib/documents";
import { notify } from "@/lib/notifications";
import { rm } from "@/lib/utils";

// X01 payment gateway (S11). Two providers: HitPay and Billplz (Malaysian rails
// — DuitNow / FPX / card). Split settlement is computed at source: commission is
// the platform's revenue line and the remainder goes straight to the beneficiary
// (mosque or tutor); the platform never custodies the gross amount.
//
// LIVE mode talks to the provider over the wire using fetch and refuses to fall
// back to MOCK if a key is missing (fail-closed). The gateway returns to
// /api/payments/return, where settleSession() verifies the provider's own view of
// the payment before any domain record is flipped to PAID.

export const COMMISSION_PCT = 1.5;

export type PaymentPurpose = "DONATION" | "QURBAN" | "QURAN_BOOKING" | "STORE";
export type GatewayProvider = "HITPAY" | "BILLPLZ";

export type Intent = {
  /** Our client ref, embedded in the gateway redirect URL; the lookup key on return. */
  ref: string;
  amountSen: number;
  purpose: PaymentPurpose;
  description: string;
  provider: GatewayProvider | "MOCK";
  /** LIVE only — full gateway checkout URL the browser must visit. */
  checkoutUrl: string | null;
  /** MOCK only — local token the simulation UI can display. */
  checkoutToken: string | null;
  expiresAt: Date;
};

export type ConfirmInput = {
  kind: PaymentPurpose;
  id: string;
  actorEmail: string;
  /** Gateway ref; required in LIVE when the payment came through the gateway. */
  sessionId?: string;
};

export type ConfirmResult = {
  already: boolean;
  mosqueId: string | null;
  receiptNumber: string | null;
};

export function splitSettlement(amountSen: number, commissionPct = COMMISSION_PCT) {
  const commissionSen = Math.round((amountSen * commissionPct) / 100);
  return { grossSen: amountSen, commissionSen, netSen: amountSen - commissionSen };
}

function baseUrl(): string {
  const url = process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? "http://localhost:3100";
  return url.replace(/\/+$/, "");
}

function gatewayReturnUrl(ref: string, status: "success" | "cancel"): string {
  const u = new URL("/api/payments/return", `${baseUrl()}/`);
  u.searchParams.set("ref", ref);
  u.searchParams.set("status", status);
  return u.toString();
}

export async function integrationMode(key: string): Promise<"MOCK" | "LIVE"> {
  const cfg = await prisma.integrationConfig.findUnique({ where: { key } });
  return asMode(cfg?.mode);
}

function asMode(value: string | null | undefined): "MOCK" | "LIVE" {
  return value === "LIVE" ? "LIVE" : "MOCK";
}

async function gatewayConfig(): Promise<{ mode: "MOCK" | "LIVE"; provider: GatewayProvider }> {
  const cfg = await prisma.integrationConfig.findUnique({ where: { key: "gateway" } });
  const raw = (cfg?.config ? JSON.parse(cfg.config as string) : {}) as { provider?: string };
  const provider: GatewayProvider =
    String(raw.provider ?? "HITPAY").toUpperCase() === "BILLPLZ" ? "BILLPLZ" : "HITPAY";
  return { mode: asMode(cfg?.mode), provider };
}

/** Fail-closed key resolution — LIVE without a configured key is a setup error, never a fallback. */
function gatewaySecretKey(provider: GatewayProvider): string {
  const key = provider === "HITPAY" ? process.env.HITPAY_API_KEY : process.env.BILLPLZ_API_KEY;
  if (!key) {
    throw new Error(
      provider === "HITPAY"
        ? "HITPAY_API_KEY belum dikonfigurasi. Tambah kunci di persekitaran sebelum mengaktifkan mod LIVE."
        : "BILLPLZ_API_KEY belum dikonfigurasi. Tambah kunci di persekitaran sebelum mengaktifkan mod LIVE.",
    );
  }
  return key;
}

function billplzCollectionId(): string {
  const id = process.env.BILLPLZ_COLLECTION_ID;
  if (!id) throw new Error("BILLPLZ_COLLECTION_ID belum dikonfigurasi.");
  return id;
}

function billplzBase(): string {
  return (process.env.BILLPLZ_API_BASE ?? "https://www.billplz-sandbox.com/api/v3").replace(/\/+$/, "");
}

function hitpayBase(): string {
  return (process.env.HITPAY_API_BASE ?? "https://api.hitpayapp.com/v1").replace(/\/+$/, "");
}

async function callBillplz<T>(path: string, init: RequestInit): Promise<T> {
  const key = gatewaySecretKey("BILLPLZ");
  const auth = Buffer.from(`${key}:`).toString("base64");
  const res = await fetch(`${billplzBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Basic ${auth}`,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Billplz ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }
  return (await res.json()) as T;
}

async function callHitPay<T>(path: string, init: RequestInit): Promise<T> {
  const key = gatewaySecretKey("HITPAY");
  const res = await fetch(`${hitpayBase()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-api-key": key,
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HitPay ${res.status}: ${text.slice(0, 200) || res.statusText}`);
  }
  return (await res.json()) as T;
}

type BillplzPayment = {
  id: string;
  url?: string;
  status?: string;
  paid_amount?: number;
  amount?: number;
};

type HitPayPaymentRequest = {
  id: string;
  status?: string;
  amount?: number;
  currency?: string;
  payment_link?: string;
  additional_data?: { payment_link?: string; url?: string };
};

function pickHitPayUrl(r: HitPayPaymentRequest): string | null {
  return r.payment_link ?? r.additional_data?.payment_link ?? r.additional_data?.url ?? null;
}

/** Create a gateway intent. MOCK simulates; LIVE creates a real payment request. */
export async function createIntent(input: {
  amountSen: number;
  purpose: PaymentPurpose;
  description: string;
  payerName: string;
  payerEmail: string;
  entityId: string;
}): Promise<Intent> {
  const { mode, provider } = await gatewayConfig();
  const ref = `${mode === "LIVE" ? "gw" : "MOCK"}-${input.purpose.slice(0, 3)}-${Date
    .now()
    .toString(36)
    .toUpperCase()}-${randomBytes(3)
    .toString("hex")
    .toUpperCase()}`;
  const expiresAt = new Date(Date.now() + 15 * 60_000);

  if (mode === "MOCK") {
    await prisma.paymentIntent.create({
      data: {
        gatewayRef: ref,
        provider: "MOCK",
        kind: input.purpose,
        entityId: input.entityId,
        amountSen: input.amountSen,
        status: "PENDING",
      },
    });
    return {
      ref,
      amountSen: input.amountSen,
      purpose: input.purpose,
      description: input.description,
      provider: "MOCK",
      checkoutUrl: null,
      checkoutToken: `chk_${randomBytes(12).toString("hex")}`,
      expiresAt,
    };
  }

  let externalId: string;
  let checkoutUrl: string;

  if (provider === "BILLPLZ") {
    const p = await callBillplz<BillplzPayment>("/payments", {
      method: "POST",
      body: JSON.stringify({
        collection_id: billplzCollectionId(),
        description: input.description.slice(0, 140),
        amount: input.amountSen,
        email: input.payerEmail || undefined,
        mobile: undefined,
        name: input.payerName,
        url: gatewayReturnUrl(ref, "success"),
        callback_url: gatewayReturnUrl(ref, "success"),
        redirect_url: gatewayReturnUrl(ref, "cancel"),
      }),
    });
    if (!p.url) throw new Error("Billplz tidak mengembalikan pautan pembayaran.");
    externalId = p.id;
    checkoutUrl = p.url;
  } else {
    const r = await callHitPay<HitPayPaymentRequest>("/payment-requests", {
      method: "POST",
      body: JSON.stringify({
        amount: (input.amountSen / 100).toFixed(2),
        currency: "MYR",
        description: input.description.slice(0, 140),
        success_redirect_url: gatewayReturnUrl(ref, "success"),
        failure_redirect_url: gatewayReturnUrl(ref, "cancel"),
        payer_email: input.payerEmail || undefined,
        payer_name: input.payerName,
      }),
    });
    const url = pickHitPayUrl(r);
    if (!url) throw new Error("HitPay tidak mengembalikan pautan pembayaran.");
    externalId = r.id;
    checkoutUrl = url;
  }

  await prisma.paymentIntent.create({
    data: {
      gatewayRef: ref,
      externalId,
      provider,
      kind: input.purpose,
      entityId: input.entityId,
      amountSen: input.amountSen,
      status: "PENDING",
    },
  });

  return {
    ref,
    amountSen: input.amountSen,
    purpose: input.purpose,
    description: input.description,
    provider,
    checkoutUrl,
    checkoutToken: null,
    expiresAt,
  };
}

/**
 * Verify a gateway payment against the provider's own API. Returns null when the
 * provider still reports the payment as incomplete; throws when the provider
 * reports it as failed or the amount does not match.
 */
export async function settleSession(
  gatewayRef: string,
): Promise<{ intent: Prisma.PaymentIntentGetPayload<object>; netSen: number } | null> {
  const intent = await prisma.paymentIntent.findUnique({ where: { gatewayRef } });
  if (!intent) throw new Error("Intent pembayaran tidak dijumpai.");
  if (intent.status === "PAID") return { intent, netSen: splitSettlement(intent.amountSen).netSen };
  if (intent.status !== "PENDING") return null;
  if (!intent.externalId) throw new Error("Intent LIVE tidak mempunyai rujukan penyedia.");

  let status: string | null = null;
  let paidAmountSen: number | null = null;
  if (intent.provider === "BILLPLZ") {
    const p = await callBillplz<BillplzPayment>(`/payments/${intent.externalId}`, { method: "GET" });
    status = p.status ?? null;
    paidAmountSen = p.paid_amount ?? p.amount ?? null;
  } else if (intent.provider === "HITPAY") {
    const r = await callHitPay<HitPayPaymentRequest>(`/payment-requests/${intent.externalId}`, {
      method: "GET",
    });
    status = r.status ?? null;
    paidAmountSen = r.amount != null ? Math.round(r.amount * 100) : null;
  }

  if (status === "paid") {
    if (paidAmountSen == null || paidAmountSen !== intent.amountSen) {
      await prisma.paymentIntent.update({ where: { id: intent.id }, data: { status: "FAILED" } });
      throw new Error("Jumlah pembayaran tidak sepadan dengan intent.");
    }
    const updated = await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: "PAID" },
    });
    return { intent: updated, netSen: splitSettlement(updated.amountSen).netSen };
  }

  if (status === "cancelled" || status === "declined" || status === "expired" || status === "failed") {
    await prisma.paymentIntent.update({
      where: { id: intent.id },
      data: { status: status === "expired" ? "EXPIRED" : "FAILED" },
    });
    return null;
  }
  return null;
}

/**
 * Record a gateway settlement inside the given transaction:
 *  - QURAN_BOOKING -> Payout to the tutor (net after commission)
 *  - other kinds   -> LedgerEntry on the mosque's HASIL account (net after commission)
 * The platform keeps commission at source; only the net is recorded on the
 * beneficiary's books.
 */
async function recordSettlement(
  tx: Prisma.TransactionClient,
  input: {
    kind: PaymentPurpose;
    entityId: string;
    amountSen: number;
    method: string;
    description: string;
  },
): Promise<void> {
  const { commissionSen, netSen } = splitSettlement(input.amountSen);

  if (input.kind === "QURAN_BOOKING") {
    const booking = await tx.quranBooking.findUnique({
      where: { id: input.entityId },
      include: { tutor: { select: { id: true, mosqueId: true } } },
    });
    if (!booking?.tutor.mosqueId) return;
    const now = new Date();
    await tx.payout.create({
      data: {
        tutorId: booking.tutor.id,
        mosqueId: booking.tutor.mosqueId,
        periodStart: now,
        periodEnd: now,
        grossSen: input.amountSen,
        commissionSen,
        netSen,
        status: "DIBAYAR",
        paidAt: now,
        reference: input.entityId,
      },
    });
    return;
  }

  const mosqueId = await resolveMosqueId(tx, input.kind, input.entityId);
  if (!mosqueId) return;
  const hasil = await tx.ledgerAccount.findFirst({ where: { mosqueId, type: "HASIL" } });
  if (!hasil) return;
  const alreadyPosted = await tx.ledgerEntry.findFirst({
    where: { reference: input.entityId, accountId: hasil.id, type: "MASUK" },
    select: { id: true },
  });
  if (alreadyPosted) return;
  await tx.ledgerEntry.create({
    data: {
      mosqueId,
      accountId: hasil.id,
      date: new Date(),
      description: input.description,
      category: input.kind,
      type: "MASUK",
      amountSen: netSen,
      reference: input.entityId,
      method: input.method,
      status: "POSTED",
    },
  });
}

async function resolveMosqueId(
  tx: Prisma.TransactionClient,
  kind: PaymentPurpose,
  entityId: string,
): Promise<string | null> {
  if (kind === "DONATION") {
    const d = await tx.donation.findUnique({ where: { id: entityId }, select: { mosqueId: true } });
    return d?.mosqueId ?? null;
  }
  if (kind === "QURBAN") {
    const o = await tx.qurbanOrder.findUnique({
      where: { id: entityId },
      select: { program: { select: { mosqueId: true } } },
    });
    return o?.program.mosqueId ?? null;
  }
  if (kind === "STORE") {
    const o = await tx.order.findUnique({ where: { id: entityId }, select: { mosqueId: true } });
    return o?.mosqueId ?? null;
  }
  return null;
}

/**
 * Confirm a payment and move the domain record forward atomically. In LIVE mode
 * `sessionId` is required and the gateway is asked to verify before anything is
 * written. In MOCK mode (or admin manual confirm without a sessionId) the same
 * domain updates run without a network call.
 */
export async function confirmPayment(input: ConfirmInput): Promise<ConfirmResult> {
  const mode = await integrationMode("gateway");
  let verifiedGatewayRef: string | null = null;
  if (mode === "LIVE" && input.sessionId) {
    const settled = await settleSession(input.sessionId);
    if (!settled) throw new Error("Pembayaran belum disahkan oleh gerbang.");
    if (settled.intent.kind !== input.kind || settled.intent.entityId !== input.id) {
      throw new Error("Intent pembayaran tidak sepadan dengan rekod.");
    }
    verifiedGatewayRef = settled.intent.gatewayRef;
  }
  // LIVE without a sessionId is an admin/offline confirmation (cash, bank-in,
  // or counter card). Allowed, but recorded with a MANUAL prefix in the
  // gatewayRef so the audit trail makes the origin explicit.
  if (mode === "LIVE" && !input.sessionId) {
    verifiedGatewayRef = `MANUAL-${input.kind.slice(0, 3)}-${Date.now().toString(36).toUpperCase()}`;
  }

  const ref = verifiedGatewayRef ?? mockGatewayRef(input.kind);

  if (input.kind === "DONATION") {
    const donation = await prisma.donation.findUnique({ where: { id: input.id } });
    if (!donation) throw new Error("Derma tidak dijumpai.");
    if (donation.status === "DIBAYAR")
      return { already: true, mosqueId: donation.mosqueId, receiptNumber: null };

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
      if (mode === "LIVE") {
        await recordSettlement(tx, {
          kind: "DONATION",
          entityId: donation.id,
          amountSen: donation.amountSen,
          method: donation.method ?? "QR",
          description: `Derma — ${donation.campaignId ? "kempen" : "tabung am"} ${rm(donation.amountSen)}`,
        });
      }
    });

    const receipt = await issueReceipt({
      mosqueId: donation.mosqueId,
      issuedTo: donation.anonymous ? "Penderma Tanpa Nama" : donation.donorName,
      email: donation.donorEmail,
      amountSen: donation.amountSen,
      purpose: "Derma — Tabung masjid",
      method: mode === "LIVE" ? "Gerbang pembayaran" : "DuitNow QR (simulasi)",
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
    const order = await prisma.qurbanOrder.findUnique({
      where: { id: input.id },
      include: { program: true },
    });
    if (!order) throw new Error("Pesanan qurban tidak dijumpai.");
    if (order.status === "DIBAYAR")
      return { already: true, mosqueId: order.program.mosqueId, receiptNumber: null };

    await prisma.$transaction(async (tx) => {
      await tx.qurbanOrder.update({
        where: { id: order.id },
        data: { status: "DIBAYAR", paidAt: new Date(), gatewayRef: ref },
      });
      if (mode === "LIVE") {
        await recordSettlement(tx, {
          kind: "QURBAN",
          entityId: order.id,
          amountSen: order.amountSen,
          method: "FPX",
          description: `Qurban ${order.program.year} — ${order.shares} bahagian`,
        });
      }
    });

    const receipt = await issueReceipt({
      mosqueId: order.program.mosqueId,
      issuedTo: order.customerName,
      email: order.email,
      amountSen: order.amountSen,
      purpose: `Qurban ${order.program.year} — ${order.shares} bahagian (${order.program.animal})`,
      method: mode === "LIVE" ? "Gerbang pembayaran" : "FPX (simulasi)",
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
    if (order.status === "DIBAYAR")
      return { already: true, mosqueId: order.mosqueId, receiptNumber: null };

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
      if (mode === "LIVE") {
        await recordSettlement(tx, {
          kind: "STORE",
          entityId: order.id,
          amountSen: order.totalSen,
          method: "KAD",
          description: `Jualan kedai — ${order.orderNo}`,
        });
      } else {
        const hasilAccount = await tx.ledgerAccount.findFirst({
          where: { mosqueId: order.mosqueId, type: "HASIL" },
        });
        if (hasilAccount) {
          await tx.ledgerEntry.create({
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
            },
          });
        }
      }
    });

    const entry = await prisma.ledgerEntry.findFirst({
      where: { reference: order.id, type: "MASUK" },
      select: { id: true },
      orderBy: { date: "desc" },
    });

    const receipt = await issueReceipt({
      mosqueId: order.mosqueId,
      issuedTo: order.buyerName,
      email: order.buyerEmail,
      amountSen: order.totalSen,
      purpose: `Pesanan kedai ${order.orderNo}`,
      method: mode === "LIVE" ? "Gerbang pembayaran" : "Kad (simulasi)",
      entryId: entry?.id ?? null,
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

  const booking = await prisma.quranBooking.findUnique({
    where: { id: input.id },
    include: { tutor: true },
  });
  if (!booking) throw new Error("Tempahan tidak dijumpai.");
  if (booking.status === "DISAHKAN" || booking.status === "SELESAI")
    return { already: true, mosqueId: booking.tutor.mosqueId, receiptNumber: null };
  if (!booking.tutor.mosqueId) throw new Error("Tutor belum dikaitkan dengan masjid.");

  await prisma.$transaction(async (tx) => {
    await tx.quranBooking.update({
      where: { id: booking.id },
      data: { status: "DISAHKAN", gatewayRef: ref },
    });
    await tx.quranSlot.update({ where: { id: booking.slotId }, data: { status: "DITEMPAH" } });
    await tx.slotLock.deleteMany({ where: { slotId: booking.slotId } });
    if (mode === "LIVE") {
      await recordSettlement(tx, {
        kind: "QURAN_BOOKING",
        entityId: booking.id,
        amountSen: booking.amountSen,
        method: "KAD",
        description: `Bayaran tutor — kelas Al-Quran ${booking.hours} jam`,
      });
    }
  });

  const receipt = await issueReceipt({
    mosqueId: booking.tutor.mosqueId,
    issuedTo: `${booking.parentName} (untuk ${booking.studentName})`,
    email: booking.parentEmail,
    amountSen: booking.amountSen,
    purpose: `Tempahan kelas Al-Quran — ${booking.hours} jam bersama ${booking.tutor.name}`,
    method: mode === "LIVE" ? "Gerbang pembayaran" : "Kad (simulasi)",
  });
  return { already: false, mosqueId: booking.tutor.mosqueId, receiptNumber: receipt.number };
}

function mockGatewayRef(kind: PaymentPurpose): string {
  const prefix =
    kind === "DONATION" ? "DON" : kind === "QURBAN" ? "QB" : kind === "STORE" ? "STORE" : "QRN";
  return `MOCK-${prefix}-${Date.now().toString(36).toUpperCase()}`;
}
