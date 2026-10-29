import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Download, HeartHandshake, ReceiptText, Repeat, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, StatusBadge } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { percent, rm, tarikh, tarikhMasa } from "@/lib/utils";
import { createDonation } from "./actions";

export const metadata: Metadata = { title: "Derma & Infaq" };

const PRESETS = ["50", "100", "200", "500"];

export default async function JemaahDermaPage({
  searchParams,
}: {
  searchParams: Promise<{ kempen?: string; jumlah?: string; ralat?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;

  const campaigns = await prisma.campaign.findMany({
    where: {
      status: "AKTIF",
      ...(user.mosqueId ? { mosqueId: user.mosqueId } : {}),
    },
    orderBy: { startDate: "desc" },
  });
  const selected = campaigns.find((campaign) => campaign.id === params.kempen) ?? campaigns[0] ?? null;
  const presetAmount = params.jumlah && PRESETS.includes(params.jumlah) ? params.jumlah : "";

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, phone: true },
  });

  const myDonations = await prisma.donation.findMany({
    where: { donorEmail: profile?.email ?? "__tiada__" },
    include: { campaign: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  const receipts = await prisma.receipt.findMany({
    where: { donationId: { in: myDonations.map((donation) => donation.id) } },
    select: { id: true, donationId: true, number: true },
  });
  const receiptByDonation = new Map<string, { id: string; number: string }>();
  for (const receipt of receipts) {
    if (receipt.donationId) receiptByDonation.set(receipt.donationId, receipt);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Jemaah"
        title="Derma & infaq"
        description="Setiap sumbangan, sekecil mana pun, membantu masjid terus berkhidmat kepada komuniti."
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}

      <SectionTitle
        action={<span className="text-xs text-brand-900/45">{campaigns.length} kempen aktif</span>}
      >
        Kempen semasa
      </SectionTitle>

      {campaigns.length === 0 ? (
        <Card>
          <EmptyState
            icon={HeartHandshake}
            title="Tiada kempen aktif buat masa ini"
            description="Sila kembali semula tidak lama lagi. Masjid sedang menyediakan kempen baharu untuk jemaah."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {campaigns.map((campaign) => {
            const progress = percent(campaign.raisedSen, campaign.targetSen);
            return (
              <Card key={campaign.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-brand-950">{campaign.title}</h3>
                  <StatusBadge value={campaign.status} />
                </div>
                {campaign.description && (
                  <p className="mt-1 text-xs leading-relaxed text-brand-900/60">{campaign.description}</p>
                )}
                <div className="mt-4">
                  <div className="flex items-end justify-between">
                    <p className="text-lg font-semibold text-brand-950">{rm(campaign.raisedSen)}</p>
                    <p className="text-xs text-brand-900/50">sasaran {rm(campaign.targetSen)}</p>
                  </div>
                  <Progress value={progress} className="mt-2" />
                  <div className="mt-1 flex items-center justify-between text-[11px] text-brand-900/50">
                    <span>{progress}% dicapai</span>
                    <span>Hingga {tarikh(campaign.endDate)}</span>
                  </div>
                </div>
                <Link
                  href={`/jemaah/derma?kempen=${campaign.id}#borang-derma`}
                  className="btn-primary mt-4 w-full"
                >
                  Derma sekarang <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <Card className="mt-6 scroll-mt-20">
          <span id="borang-derma" className="block" />
          <CardHeader
            title="Borang derma"
            description="Isi maklumat anda dan teruskan ke halaman pembayaran simulasi. Tiada wang sebenar dipindahkan."
          />
          <form action={createDonation} className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="donationCampaign">Kempen *</label>
              <select
                id="donationCampaign"
                name="campaignId"
                required
                defaultValue={selected.id}
                className="input"
              >
                {campaigns.map((campaign) => (
                  <option key={campaign.id} value={campaign.id}>
                    {campaign.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <span className="label">Jumlah pantas</span>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((value) => (
                  <Link
                    key={value}
                    href={`/jemaah/derma?kempen=${selected.id}&jumlah=${value}#borang-derma`}
                    className={
                      presetAmount === value
                        ? "btn bg-brand-700 px-4 text-sm text-white"
                        : "btn-secondary px-4 text-sm"
                    }
                  >
                    RM {value}
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <label className="label" htmlFor="donationAmount">Jumlah derma (RM) *</label>
              <input
                id="donationAmount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={presetAmount}
                placeholder="100.00"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="donationPhone">No. telefon</label>
              <input
                id="donationPhone"
                name="donorPhone"
                type="tel"
                defaultValue={profile?.phone ?? ""}
                placeholder="012-345 6789"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="donationName">Nama *</label>
              <input
                id="donationName"
                name="donorName"
                required
                defaultValue={profile?.name ?? user.name ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="donationEmail">E-mel *</label>
              <input
                id="donationEmail"
                name="donorEmail"
                type="email"
                required
                defaultValue={profile?.email ?? user.email ?? ""}
                className="input"
              />
            </div>

            <div className="space-y-3 sm:col-span-2">
              <label className="flex items-start gap-2 text-xs font-medium text-brand-900/70">
                <input
                  type="checkbox"
                  name="anonymous"
                  className="mt-0.5 h-4 w-4 rounded border-brand-900/20 text-brand-700 focus:ring-brand-600"
                />
                <span>
                  Sembunyikan nama saya daripada paparan awam
                  <span className="block text-[11px] font-normal text-brand-900/45">
                    Resit rasmi tetap dikeluarkan atas nama anda.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs font-medium text-brand-900/70">
                <input
                  type="checkbox"
                  name="recurring"
                  className="mt-0.5 h-4 w-4 rounded border-brand-900/20 text-brand-700 focus:ring-brand-600"
                />
                <span>
                  Jadikan derma berulang
                  <span className="block text-[11px] font-normal text-brand-900/45">
                    Gerbang simulasi akan mengulang derma mengikut frekuensi dipilih.
                  </span>
                </span>
              </label>
              <div>
                <label className="label" htmlFor="donationFrequency">Frekuensi</label>
                <select id="donationFrequency" name="frequency" defaultValue="BULANAN" className="input sm:max-w-xs">
                  <option value="BULANAN">Bulanan</option>
                  <option value="MINGGUAN">Mingguan</option>
                </select>
              </div>
            </div>

            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                Teruskan ke pembayaran <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-900/45">
                <ShieldCheck className="h-3.5 w-3.5" /> Dana terus diselesaikan kepada masjid. Platform tidak memegang wang anda.
              </p>
            </div>
          </form>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Derma terakhir saya"
          description="Sejarah derma yang direkodkan dengan e-mel akaun anda."
          action={<ReceiptText className="h-5 w-5 text-brand-900/30" />}
        />
        {myDonations.length === 0 ? (
          <EmptyState
            icon={Repeat}
            title="Belum ada derma direkodkan"
            description="Selepas anda menderma, rekod dan resit akan muncul di sini."
          />
        ) : (
          <ul className="divide-y divide-brand-900/5">
            {myDonations.map((donation) => {
              const receipt = receiptByDonation.get(donation.id);
              return (
                <li key={donation.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-brand-950">
                      {donation.campaign?.title ?? "Derma tabung masjid"}
                    </p>
                    <p className="text-[11px] text-brand-900/50">
                      {tarikhMasa(donation.createdAt)}
                      {donation.recurring ? " · Derma berulang" : ""}
                      {donation.anonymous ? " · Tanpa nama" : ""}
                    </p>
                    <div className="mt-1">
                      <StatusBadge value={donation.status} />
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-brand-950">{rm(donation.amountSen)}</p>
                    {donation.status === "DIBAYAR" && receipt ? (
                      <Link
                        href={`/api/receipts/${receipt.id}`}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                      >
                        <Download className="h-3 w-3" /> Resit {receipt.number}
                      </Link>
                    ) : donation.status === "DIBAYAR" ? (
                      <span className="mt-1 block text-[11px] text-brand-900/40">Resit dalam proses</span>
                    ) : (
                      <Link
                        href={`/jemaah/bayar/DONATION/${donation.id}`}
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                      >
                        Teruskan bayaran <ArrowRight className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
