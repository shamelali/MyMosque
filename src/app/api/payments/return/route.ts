import { NextResponse } from "next/server";
import { handleApiError, HttpError, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/db";
import { confirmPayment, settleSession, type PaymentPurpose } from "@/lib/payments";
import { notify } from "@/lib/notifications";
import { rm } from "@/lib/utils";

export const runtime = "nodejs";

// GET /api/payments/return?ref=<gatewayRef>&status=success|cancel
//
// The user is redirected here by HitPay or Billplz after paying (or backing
// out). We never trust the query string alone: settleSession() re-fetches the
// payment from the provider's own API. Only after the provider confirms `paid`
// do we flip the domain record via confirmPayment.

const KINDS: PaymentPurpose[] = ["DONATION", "QURBAN", "QURAN_BOOKING", "STORE"];

function redirectWithFallback(target: URL | string): NextResponse {
  const headers = new Headers();
  headers.set("Cache-Control", "no-store");
  return NextResponse.redirect(typeof target === "string" ? target : target.toString(), {
    status: 303,
    headers,
  });
}

function payPageUrl(origin: string, kind: PaymentPurpose, entityId: string, params?: Record<string, string>): string {
  const u = new URL(`/jemaah/bayar/${kind}/${entityId}/selesai`, origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  }
  return u.toString();
}

function payFailureUrl(origin: string, kind: PaymentPurpose, entityId: string, message: string): string {
  const u = new URL(`/jemaah/bayar/${kind}/${entityId}`, origin);
  u.searchParams.set("ralat", message);
  return u.toString();
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const ref = url.searchParams.get("ref") ?? "";
    const status = url.searchParams.get("status") ?? "";

    if (!ref) throw new HttpError(400, "Rujukan pembayaran tidak Provided.");

    const intent = await prisma.paymentIntent.findUnique({ where: { gatewayRef: ref } });
    if (!intent) {
      // Unknown ref — send the user back to /jemaah with an explanatory error.
      return redirectWithFallback(new URL("/jemaah?ralat=payment-not-found", url.origin).toString());
    }

    const kind = intent.kind as PaymentPurpose;
    if (!KINDS.includes(kind)) throw new HttpError(400, "Jenis pembayaran tidak sah.");

    if (status === "cancel") {
      return redirectWithFallback(
        payFailureUrl(url.origin, kind, intent.entityId, "Pembayaran dibatalkan. Sila cuba semula."),
      );
    }

    let settled;
    try {
      settled = await settleSession(intent.gatewayRef);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pengesahan gerbang gagal.";
      return redirectWithFallback(payFailureUrl(url.origin, kind, intent.entityId, message));
    }
    if (!settled) {
      // Provider still reports incomplete — do not flip the record yet.
      return redirectWithFallback(
        payFailureUrl(
          url.origin,
          kind,
          intent.entityId,
          "Pembayaran belum disahkan oleh gerbang. Sila tunggu sebentar dan muat semula halaman ini.",
        ),
      );
    }

    let result;
    try {
      result = await confirmPayment({
        kind,
        id: intent.entityId,
        actorEmail: user.email ?? "gerbang@spmj.local",
        sessionId: intent.gatewayRef,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Pengesahan pembayaran gagal.";
      return redirectWithFallback(payFailureUrl(url.origin, kind, intent.entityId, message));
    }

    if (!result.already) {
      const payer = await payerFor(kind, intent.entityId);
      if (payer?.email) {
        await notify({
          channel: "EMAIL",
          to: payer.email,
          template: "pembayaran_diterima",
          subject: "Pembayaran diterima — SPMJ",
          body: `Terima kasih. Bayaran ${rm(payer.amountSen)} telah diterima${
            result.receiptNumber ? ` dan resit ${result.receiptNumber} telah dijana` : ""
          }.`,
          mosqueId: result.mosqueId,
          userId: user.id,
          payload: { kind, id: intent.entityId, gatewayRef: intent.gatewayRef },
        });
      }
    }

    const query: Record<string, string> = {};
    if (result.receiptNumber) query.resit = result.receiptNumber;
    return redirectWithFallback(payPageUrl(url.origin, kind, intent.entityId, query));
  } catch (error) {
    return handleApiError(error);
  }
}

type PayerLite = { email: string | null; amountSen: number };

async function payerFor(kind: PaymentPurpose, id: string): Promise<PayerLite | null> {
  if (kind === "DONATION") {
    const d = await prisma.donation.findUnique({
      where: { id },
      select: { donorEmail: true, amountSen: true },
    });
    return d ? { email: d.donorEmail, amountSen: d.amountSen } : null;
  }
  if (kind === "QURBAN") {
    const o = await prisma.qurbanOrder.findUnique({
      where: { id },
      select: { email: true, amountSen: true },
    });
    return o ? { email: o.email, amountSen: o.amountSen } : null;
  }
  if (kind === "QURAN_BOOKING") {
    const b = await prisma.quranBooking.findUnique({
      where: { id },
      select: { parentEmail: true, amountSen: true },
    });
    return b ? { email: b.parentEmail, amountSen: b.amountSen } : null;
  }
  const so = await prisma.order.findUnique({
    where: { id },
    select: { buyerEmail: true, totalSen: true },
  });
  return so ? { email: so.buyerEmail, amountSen: so.totalSen } : null;
}
