import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  Info,
  Landmark,
  Lock,
  QrCode,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { COMMISSION_PCT, type PaymentPurpose } from "@/lib/payments";
import { label } from "@/lib/labels";
import { rm, tarikh } from "@/lib/utils";
import { payNow } from "./actions";

export const metadata: Metadata = { title: "Pembayaran" };

const KINDS: PaymentPurpose[] = ["DONATION", "QURBAN", "QURAN_BOOKING", "STORE"];

type Detail = { label: string; value: string };

type CheckoutView = {
  amountSen: number;
  purpose: string;
  payerName: string;
  payerEmail: string | null;
  status: string;
  canPay: boolean;
  paid: boolean;
  details: Detail[];
};

function isKind(value: string): value is PaymentPurpose {
  return (KINDS as string[]).includes(value);
}

async function loadCheckout(kind: PaymentPurpose, id: string): Promise<CheckoutView | null> {
  if (kind === "DONATION") {
    const donation = await prisma.donation.findUnique({
      where: { id },
      include: { campaign: { select: { title: true } } },
    });
    if (!donation) return null;
    return {
      amountSen: donation.amountSen,
      purpose: donation.campaign?.title ?? "Derma tabung masjid",
      payerName: donation.anonymous ? "Penderma Tanpa Nama" : donation.donorName,
      payerEmail: donation.donorEmail,
      status: donation.status,
      canPay: donation.status === "MENUNGGU",
      paid: donation.status === "DIBAYAR",
      details: [
        { label: "Kempen", value: donation.campaign?.title ?? "Tabung am masjid" },
        { label: "Jenis derma", value: donation.recurring ? `Berulang · ${label(donation.frequency ?? "BULANAN")}` : "Sekali" },
        { label: "Paparan", value: donation.anonymous ? "Tanpa nama" : "Nama penuh" },
      ],
    };
  }

  if (kind === "QURBAN") {
    const order = await prisma.qurbanOrder.findUnique({
      where: { id },
      include: { program: { select: { year: true, animal: true, pricePerShareSen: true, distributionDate: true } } },
    });
    if (!order) return null;
    return {
      amountSen: order.amountSen,
      purpose: `Qurban ${order.program.year} — ${order.shares} bahagian (${label(order.program.animal)})`,
      payerName: order.customerName,
      payerEmail: order.email,
      status: order.status,
      canPay: order.status === "MENUNGGU",
      paid: order.status === "DIBAYAR",
      details: [
        { label: "Program", value: `Qurban ${order.program.year} · ${label(order.program.animal)}` },
        { label: "Bahagian", value: `${order.shares} × ${rm(order.program.pricePerShareSen)}` },
        { label: "Agihan", value: tarikh(order.program.distributionDate) },
        { label: "Telefon", value: order.phone ?? "—" },
      ],
    };
  }

  if (kind === "QURAN_BOOKING") {
    const booking = await prisma.quranBooking.findUnique({
      where: { id },
      include: { tutor: { select: { name: true } }, slot: { select: { date: true, startTime: true, endTime: true } } },
    });
    if (!booking) return null;
    return {
      amountSen: booking.amountSen,
      purpose: `Kelas Al-Quran — ${booking.hours} jam bersama ${booking.tutor.name}`,
      payerName: booking.parentName,
      payerEmail: booking.parentEmail,
      status: booking.status,
      canPay: booking.status === "MENUNGGU_BAYARAN",
      paid: booking.status === "DISAHKAN" || booking.status === "SELESAI",
      details: [
        { label: "Tutor", value: booking.tutor.name },
        { label: "Pelajar", value: `${booking.studentName} (${booking.studentAge} tahun)` },
        {
          label: "Slot",
          value: `${tarikh(booking.slot.date)} · ${booking.slot.startTime}–${booking.slot.endTime}`,
        },
        { label: "Bilangan pelajar", value: `${booking.studentCount} pelajar · ${booking.hours} jam` },
        { label: "Persetujuan penjaga", value: booking.guardianConsent ? booking.consentRef ?? "Direkod" : "Tiada" },
      ],
    };
  }

  const storeOrder = await prisma.order.findUnique({
    where: { id },
    include: { items: { include: { item: true } } },
  });
  if (!storeOrder) return null;
  const itemList = storeOrder.items.map((i) => `${i.qty}× ${i.name}`).join(", ");
  return {
    amountSen: storeOrder.totalSen,
    purpose: `Pesanan kedai ${storeOrder.orderNo} — ${itemList}`,
    payerName: storeOrder.buyerName,
    payerEmail: storeOrder.buyerEmail,
    status: storeOrder.status,
    canPay: storeOrder.status === "MENUNGGU_BAYARAN",
    paid: storeOrder.status === "DIBAYAR",
    details: [
      { label: "Nombor pesanan", value: storeOrder.orderNo },
      { label: "Item", value: itemList },
      { label: "Telefon", value: storeOrder.buyerPhone ?? "—" },
      { label: "Commission", value: `${rm(storeOrder.commissionSen)} dibenarkan di punca` },
    ],
  };
}

async function findReceipt(kind: PaymentPurpose, id: string, view: CheckoutView) {
  if (kind === "DONATION") {
    return prisma.receipt.findFirst({ where: { donationId: id }, orderBy: { issuedAt: "desc" } });
  }
  if (kind === "QURBAN") {
    return prisma.receipt.findFirst({
      where: { amountSen: view.amountSen, issuedTo: view.payerName, donationId: null },
      orderBy: { issuedAt: "desc" },
    });
  }
  if (kind === "STORE") {
    return prisma.receipt.findFirst({
      where: { amountSen: view.amountSen, issuedTo: view.payerName, donationId: null, entryId: { not: null } },
      orderBy: { issuedAt: "desc" },
    });
  }
  return prisma.receipt.findFirst({
    where: {
      amountSen: view.amountSen,
      issuedTo: { startsWith: view.payerName },
      donationId: null,
      ...(view.payerEmail ? { email: view.payerEmail } : {}),
    },
    orderBy: { issuedAt: "desc" },
  });
}

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ ralat?: string }>;
}) {
  const user = await requirePageUser();
  const { kind: kindRaw, id } = await params;
  const { ralat } = await searchParams;

  if (!isKind(kindRaw)) notFound();
  const kind = kindRaw;

  const view = await loadCheckout(kind, id);
  if (!view) notFound();

  const receipt = view.paid ? await findReceipt(kind, id, view) : null;
  const backHref = kind === "DONATION" ? "/jemaah/derma" : kind === "QURBAN" ? "/jemaah/qurban" : kind === "STORE" ? "/jemaah/kedai" : "/jemaah/quran";
  const base = `/jemaah/bayar/${kind}/${id}`;
  const payingForOther = view.payerEmail && view.payerEmail !== (user.email ?? "");

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Pembayaran"
        title={view.paid ? "Bayaran diterima" : view.canPay ? "Selesaikan bayaran" : "Status bayaran"}
        description={view.purpose}
        back={{ href: backHref, label: "Kembali" }}
      />

      {ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {ralat}
        </p>
      )}

      <Card className="mb-4 overflow-hidden">
        <div className="bg-brand-900 px-5 py-6 text-white">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-400">Jumlah perlu dibayar</p>
          <p className="mt-1 text-3xl font-semibold tracking-tight">{rm(view.amountSen)}</p>
          <p className="mt-1 text-xs text-white/60">{view.purpose}</p>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">Pembayar</p>
            <p className="text-sm font-semibold text-brand-950">{view.payerName}</p>
            <p className="text-[11px] text-brand-900/50">{view.payerEmail ?? "Tiada e-mel"}</p>
          </div>
          <div className="sm:text-right">
            <p className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">Status</p>
            <div className="mt-1">
              <StatusBadge value={view.status} />
            </div>
          </div>
          <dl className="grid gap-2 sm:col-span-2 sm:grid-cols-2">
            {view.details.map((detail) => (
              <div key={detail.label} className="flex items-start justify-between gap-3 border-t border-brand-900/5 pt-2 text-xs">
                <dt className="text-brand-900/50">{detail.label}</dt>
                <dd className="text-right font-medium text-brand-950">{detail.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </Card>

      {view.paid ? (
        <Card>
          <CardHeader title="Pembayaran telah disahkan" description="Resit rasmi dijana oleh masjid." />
          <div className="p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-5 w-5" /> Terima kasih, {view.payerName}.
            </p>
            <p className="mt-1 text-xs text-brand-900/55">
              Bayaran {rm(view.amountSen)} bagi {view.purpose} telah diterima.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {receipt ? (
                <Link href={`/api/receipts/${receipt.id}`} className="btn-primary">
                  <ShieldCheck className="h-4 w-4" /> Muat turun resit {receipt.number}
                </Link>
              ) : (
                <Link href={`${base}/selesai`} className="btn-primary">
                  Lihat pengesahan <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link href="/jemaah" className="btn-secondary">
                Kembali ke utama
              </Link>
            </div>
          </div>
        </Card>
      ) : !view.canPay ? (
        <Card>
          <CardHeader title="Rekod ini tidak boleh dibayar" description="Status semasa rekod ini tidak membenarkan pembayaran." />
          <div className="p-5">
            <p className="text-xs text-brand-900/60">
              Status rekod ialah <strong>{label(view.status)}</strong>. Sila hubungi masjid jika anda memerlukan bantuan.
            </p>
            <Link href={backHref} className="btn-secondary mt-4">
              Kembali
            </Link>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader
              title="Simulasi gerbang pembayaran"
              description="Pilih kaedah bayaran. Tiada transaksi wang sebenar berlaku dalam demo ini."
            />
            <div className="p-5">
              <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-[11px] leading-relaxed text-amber-800 ring-1 ring-inset ring-amber-600/15">
                <p className="flex items-center gap-1.5 font-semibold">
                  <Info className="h-3.5 w-3.5" /> Mod simulasi
                </p>
                <p className="mt-1">
                  Ini bukan gerbang sebenar. Dana diandaikan diselesaikan terus kepada masjid atau tutor, komisen
                  platform {COMMISSION_PCT}% ditolak di punca, dan platform tidak memegang wang anda.
                </p>
              </div>

              {payingForOther && (
                <p className="mt-3 rounded-lg bg-sky-50 px-3 py-2 text-[11px] text-sky-800 ring-1 ring-inset ring-sky-600/15">
                  Anda membayar bagi pihak <strong>{view.payerName}</strong>. Tindakan ini akan direkodkan atas nama
                  akaun anda dalam jejak audit.
                </p>
              )}

              <form action={payNow} className="mt-4 space-y-3">
                <input type="hidden" name="kind" value={kind} />
                <input type="hidden" name="id" value={id} />

                <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-inset ring-brand-900/10 hover:ring-brand-600/40">
                  <input type="radio" name="method" value="QR" defaultChecked className="h-4 w-4 text-brand-700 focus:ring-brand-600" />
                  <QrCode className="h-5 w-5 text-brand-700" />
                  <span className="flex-1">
                    <span className="block text-xs font-semibold text-brand-950">DuitNow QR</span>
                    <span className="block text-[11px] text-brand-900/50">Imbas dengan aplikasi bank</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-inset ring-brand-900/10 hover:ring-brand-600/40">
                  <input type="radio" name="method" value="FPX" className="h-4 w-4 text-brand-700 focus:ring-brand-600" />
                  <Landmark className="h-5 w-5 text-brand-700" />
                  <span className="flex-1">
                    <span className="block text-xs font-semibold text-brand-950">FPX</span>
                    <span className="block text-[11px] text-brand-900/50">Perbankan dalam talian</span>
                  </span>
                </label>
                <label className="flex cursor-pointer items-center gap-3 rounded-lg bg-white p-3 ring-1 ring-inset ring-brand-900/10 hover:ring-brand-600/40">
                  <input type="radio" name="method" value="KAD" className="h-4 w-4 text-brand-700 focus:ring-brand-600" />
                  <CreditCard className="h-5 w-5 text-brand-700" />
                  <span className="flex-1">
                    <span className="block text-xs font-semibold text-brand-950">Kad kredit / debit</span>
                    <span className="block text-[11px] text-brand-900/50">Visa atau Mastercard</span>
                  </span>
                </label>

                <button type="submit" className="btn-primary w-full">
                  <Lock className="h-4 w-4" /> Bayar {rm(view.amountSen)}
                </button>
                <p className="text-center text-[11px] text-brand-900/40">
                  Dengan meneruskan, anda mengesahkan butiran bayaran di atas.
                </p>
              </form>
            </div>
          </Card>

          <Card className="self-start">
            <CardHeader title="Bagaimana dana diselesaikan" />
            <div className="space-y-3 p-5 text-[11px] leading-relaxed text-brand-900/60">
              <p className="flex gap-2">
                <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                Bayaran daripada jemaah diselesaikan terus kepada masjid (derma, qurban) atau tutor (kelas Al-Quran).
              </p>
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                Komisen platform sebanyak {COMMISSION_PCT}% ditolak di punca pembayaran. Baki bersih masuk terus ke akaun
                penerima manfaat.
              </p>
              <p className="flex gap-2">
                <Badge tone="warning" className="shrink-0">
                  {COMMISSION_PCT}%
                </Badge>
                SPMJ tidak memegang dana jemaah pada bila-bila masa. Resit rasmi dijana selepas pembayaran disahkan.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
