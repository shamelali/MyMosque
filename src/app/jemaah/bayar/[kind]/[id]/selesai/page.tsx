import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, CheckCircle2, Download, Home, ReceiptText, UserRound } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, StatusBadge } from "@/components/ui/card";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import type { PaymentPurpose } from "@/lib/payments";
import { label } from "@/lib/labels";
import { rm, tarikhMasa } from "@/lib/utils";

export const metadata: Metadata = { title: "Pembayaran Selesai" };

const KINDS: PaymentPurpose[] = ["DONATION", "QURBAN", "QURAN_BOOKING"];

type DoneView = {
  amountSen: number;
  purpose: string;
  payerName: string;
  payerEmail: string | null;
  status: string;
  paid: boolean;
  paidAt: Date | null;
};

function isKind(value: string): value is PaymentPurpose {
  return (KINDS as string[]).includes(value);
}

async function loadDone(kind: PaymentPurpose, id: string): Promise<DoneView | null> {
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
      paid: donation.status === "DIBAYAR",
      paidAt: donation.paidAt,
    };
  }

  if (kind === "QURBAN") {
    const order = await prisma.qurbanOrder.findUnique({
      where: { id },
      include: { program: { select: { year: true, animal: true } } },
    });
    if (!order) return null;
    return {
      amountSen: order.amountSen,
      purpose: `Qurban ${order.program.year} — ${order.shares} bahagian (${label(order.program.animal)})`,
      payerName: order.customerName,
      payerEmail: order.email,
      status: order.status,
      paid: order.status === "DIBAYAR",
      paidAt: order.paidAt,
    };
  }

  const booking = await prisma.quranBooking.findUnique({
    where: { id },
    include: { tutor: { select: { name: true } } },
  });
  if (!booking) return null;
  return {
    amountSen: booking.amountSen,
    purpose: `Kelas Al-Quran — ${booking.hours} jam bersama ${booking.tutor.name}`,
    payerName: booking.parentName,
    payerEmail: booking.parentEmail,
    status: booking.status,
    paid: booking.status === "DISAHKAN" || booking.status === "SELESAI",
    paidAt: null,
  };
}

async function findReceipt(kind: PaymentPurpose, id: string, view: DoneView, number?: string) {
  if (number) {
    const byNumber = await prisma.receipt.findUnique({ where: { number } });
    if (byNumber) return byNumber;
  }
  if (kind === "DONATION") {
    return prisma.receipt.findFirst({ where: { donationId: id }, orderBy: { issuedAt: "desc" } });
  }
  if (kind === "QURBAN") {
    return prisma.receipt.findFirst({
      where: { amountSen: view.amountSen, issuedTo: view.payerName, donationId: null },
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

export default async function PembayaranSelesaiPage({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<{ resit?: string }>;
}) {
  await requirePageUser();
  const { kind: kindRaw, id } = await params;
  const { resit } = await searchParams;

  if (!isKind(kindRaw)) notFound();
  const kind = kindRaw;

  const view = await loadDone(kind, id);
  if (!view) notFound();

  const receipt = view.paid ? await findReceipt(kind, id, view, resit) : null;
  const base = `/jemaah/bayar/${kind}/${id}`;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow="Pembayaran"
        title={view.paid ? "Terima kasih" : "Bayaran belum disahkan"}
        description={
          view.paid
            ? "Sumbangan anda telah diterima dan dijana dalam rekod rasmi masjid."
            : "Kami belum menerima pengesahan bayaran bagi rekod ini."
        }
      />

      {view.paid ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col items-center bg-brand-900 px-6 py-8 text-center text-white">
            <span className="grid h-14 w-14 place-items-center rounded-full bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-400/30">
              <CheckCircle2 className="h-8 w-8" />
            </span>
            <p className="mt-3 text-xs font-medium text-white/60">Jumlah dibayar</p>
            <p className="text-3xl font-semibold tracking-tight">{rm(view.amountSen)}</p>
            <p className="mt-1 max-w-sm text-xs text-white/60">{view.purpose}</p>
          </div>

          <div className="space-y-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">Pembayar</p>
                <p className="text-sm font-semibold text-brand-950">{view.payerName}</p>
                <p className="text-[11px] text-brand-900/50">{view.payerEmail ?? "—"}</p>
              </div>
              <StatusBadge value={view.status} />
            </div>

            {view.paidAt && (
              <p className="text-[11px] text-brand-900/50">Disahkan pada {tarikhMasa(view.paidAt)}</p>
            )}

            <div className="rounded-xl bg-sand px-4 py-3 ring-1 ring-inset ring-brand-900/5">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-brand-900/45">
                <ReceiptText className="h-3.5 w-3.5" /> Resit rasmi
              </p>
              <p className="mt-1 font-mono text-sm font-semibold text-brand-950">
                {receipt?.number ?? resit ?? "Sedang dijana"}
              </p>
              <p className="mt-1 text-[11px] text-brand-900/50">
                Resit turut dihantar ke e-mel anda dan disimpan dalam dokumen masjid.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {receipt ? (
                <Link href={`/api/receipts/${receipt.id}`} className="btn-primary">
                  <Download className="h-4 w-4" /> Muat turun resit
                </Link>
              ) : (
                <Link href={base} className="btn-secondary">
                  Semak status bayaran <ArrowRight className="h-4 w-4" />
                </Link>
              )}
              <Link href="/jemaah" className="btn-secondary">
                <Home className="h-4 w-4" /> Utama
              </Link>
              <Link href="/jemaah/saya" className="btn-secondary">
                <UserRound className="h-4 w-4" /> Akaun saya
              </Link>
            </div>

            <p className="text-[11px] leading-relaxed text-brand-900/40">
              Nota demo: ini adalah transaksi simulasi. Tiada wang sebenar dipindahkan, dan resit adalah rekod
              simulator untuk tujuan demonstrasi.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="p-6">
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/15">
            Status semasa: {label(view.status)}. Jika anda telah membayar, sila kembali ke halaman pembayaran untuk
            mencuba semula gerbang simulasi.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={base} className="btn-primary">
              Kembali ke pembayaran <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/jemaah" className="btn-secondary">
              Kembali ke utama
            </Link>
          </div>
        </Card>
      )}
    </div>
  );
}
