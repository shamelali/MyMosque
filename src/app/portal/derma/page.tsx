import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleDollarSign,
  Filter,
  HandCoins,
  HeartHandshake,
  Plus,
  RefreshCw,
  Repeat,
  Target,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, Stat, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { bulanTahun, percent, rm, tarikh, tarikhMasa } from "@/lib/utils";
import { closeCampaign, confirmDonation, createCampaign, syncTpmj } from "./actions";

export const metadata: Metadata = { title: "Derma & Kempen" };

const DONATION_STATUSES = ["MENUNGGU", "DIBAYAR", "GAGAL", "DIPULANGKAN"];

export default async function PortalDermaPage({
  searchParams,
}: {
  searchParams: Promise<{ kempen?: string; status?: string; ralat?: string; maklum?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const params = await searchParams;

  const canManage = ["BENDAHARI", "KETUA", "SETIAUSAHA"].includes(user.role);
  const canConfirm = ["BENDAHARI", "KETUA"].includes(user.role);

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const status = params.status && DONATION_STATUSES.includes(params.status) ? params.status : undefined;
  const campaignId = params.kempen ?? "";

  const campaigns = await prisma.campaign.findMany({
    where: { mosqueId: mosque.id },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  const activeCampaign = campaigns.find((item) => item.id === campaignId);

  const [monthRaised, activeCampaigns, recurringDonors, pendingTpmj, donations] = await Promise.all([
    prisma.donation.aggregate({
      where: {
        mosqueId: mosque.id,
        status: "DIBAYAR",
        paidAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amountSen: true },
    }),
    prisma.campaign.count({ where: { mosqueId: mosque.id, status: "AKTIF" } }),
    prisma.donation.findMany({
      where: { mosqueId: mosque.id, status: "DIBAYAR", recurring: true },
      distinct: ["donorEmail"],
      select: { donorEmail: true },
    }),
    prisma.donation.count({ where: { mosqueId: mosque.id, status: "DIBAYAR", tpmjSynced: false } }),
    prisma.donation.findMany({
      where: {
        mosqueId: mosque.id,
        ...(campaignId && activeCampaign ? { campaignId } : {}),
        ...(status ? { status } : {}),
      },
      include: { campaign: { select: { title: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const totalRaised = monthRaised._sum.amountSen ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Hasil & Komuniti"
        title="Derma & Kempen"
        description={`Urus kempen tabung dan pengesahan derma ${mosque.name}.`}
        actions={
          canManage ? (
            <>
              {canConfirm && (
                <form action={syncTpmj}>
                  <button type="submit" className="btn-secondary">
                    <RefreshCw className="h-4 w-4" /> Reconcile TPMJ
                  </button>
                </form>
              )}
              <a href="#kempen-baharu" className="btn-primary">
                <Plus className="h-4 w-4" /> Kempen baharu
              </a>
            </>
          ) : undefined
        }
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}
      {params.maklum && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          {params.maklum}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Derma bulan ini"
          value={rm(totalRaised)}
          hint={`${bulanTahun(now.getMonth() + 1, now.getFullYear())} · derma dibayar`}
          icon={CircleDollarSign}
        />
        <Stat label="Kempen aktif" value={activeCampaigns} hint={`${campaigns.length} kempen keseluruhan`} icon={Target} />
        <Stat
          label="Penderma berulang"
          value={recurringDonors.length}
          hint="Penyumbang tetap (bulanan/mingguan)"
          icon={Repeat}
        />
        <Stat
          label="Menunggu TPMJ"
          value={pendingTpmj}
          hint="Derma dibayar belum disegerakkan"
          icon={RefreshCw}
        />
      </div>

      <div className="mt-6">
        <SectionTitle
          action={
            <span className="text-xs text-brand-900/45">
              Jumlah disasarkan: {rm(campaigns.reduce((sum, item) => sum + item.targetSen, 0))}
            </span>
          }
        >
          Kempen tabung
        </SectionTitle>

        {campaigns.length === 0 ? (
          <Card>
            <EmptyState
              icon={HeartHandshake}
              title="Belum ada kempen"
              description="Buka kempen tabung baharu supaya jemaah boleh menderma secara dalam talian."
              action={
                canManage ? (
                  <a href="#kempen-baharu" className="btn-primary">
                    <Plus className="h-4 w-4" /> Kempen baharu
                  </a>
                ) : undefined
              }
            />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {campaigns.map((campaign) => {
              const progress = percent(campaign.raisedSen, campaign.targetSen);
              return (
                <Card key={campaign.id} className="flex flex-col p-5">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold text-brand-950">{campaign.title}</h3>
                    <StatusBadge value={campaign.status} />
                  </div>
                  {campaign.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-brand-900/55">{campaign.description}</p>
                  )}
                  <div className="mt-3">
                    <div className="flex items-end justify-between gap-2">
                      <p className="text-lg font-semibold text-brand-950">{rm(campaign.raisedSen)}</p>
                      <p className="text-xs text-brand-900/50">daripada {rm(campaign.targetSen)}</p>
                    </div>
                    <Progress value={progress} className="mt-2" />
                    <p className="mt-1 text-[11px] font-medium text-brand-900/50">{progress}% dicapai</p>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-brand-900/45">
                    <span>
                      {tarikh(campaign.startDate)} — {tarikh(campaign.endDate)}
                    </span>
                    {campaign.qrPayload && <span className="truncate font-mono">QR: {campaign.qrPayload}</span>}
                  </div>
                  {canManage && campaign.status === "AKTIF" && (
                    <form action={closeCampaign} className="mt-4 border-t border-brand-900/5 pt-3">
                      <input type="hidden" name="id" value={campaign.id} />
                      <button type="submit" className="btn-secondary w-full text-xs">
                        Tutup kempen
                      </button>
                    </form>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {canManage && (
        <Card className="mt-6 scroll-mt-20" >
          <span id="kempen-baharu" className="block" />
          <CardHeader
            title="Kempen baharu"
            description="Kempen akan dibuka serta-merta dengan kod QR DuitNow yang dijana untuk tabung ini."
          />
          <form action={createCampaign} className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="campaignTitle">Tajuk kempen *</label>
              <input
                id="campaignTitle"
                name="title"
                required
                placeholder="Contoh: Naik Taraf Ruang Solat Wanita"
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="campaignDescription">Keterangan *</label>
              <textarea
                id="campaignDescription"
                name="description"
                required
                rows={3}
                placeholder="Terangkan tujuan derma dan bagaimana sumbangan digunakan."
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="campaignTarget">Sasaran (RM) *</label>
              <input
                id="campaignTarget"
                name="target"
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="50,000.00"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="campaignEnd">Tarikh tamat *</label>
              <input id="campaignEnd" name="endDate" type="date" required className="input" />
            </div>
            <div className="flex justify-end sm:col-span-2">
              <button type="submit" className="btn-primary">
                <Plus className="h-4 w-4" /> Buka kempen
              </button>
            </div>
          </form>
        </Card>
      )}

      {!canManage && (
        <p className="mt-6 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-600/15">
          Anda boleh melihat kempen dan derma sahaja. Pengurusan kempen dikendalikan oleh Bendahari, Pengerusi dan
          Setiausaha.
        </p>
      )}

      <form method="get" action="/portal/derma" className="card mt-6 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="filterCampaign">Kempen</label>
          <select id="filterCampaign" name="kempen" defaultValue={activeCampaign?.id ?? ""} className="input w-auto">
            <option value="">Semua kempen</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.title}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="filterStatus">Status</label>
          <select id="filterStatus" name="status" defaultValue={status ?? ""} className="input w-auto">
            <option value="">Semua status</option>
            {DONATION_STATUSES.map((value) => (
              <option key={value} value={value}>
                {label(value)}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          <Filter className="h-4 w-4" /> Tapis
        </button>
        {(params.kempen || params.status) && (
          <Link href="/portal/derma" className="text-xs font-medium text-brand-900/50 hover:text-brand-900">
            Set semula
          </Link>
        )}
      </form>

      <Card className="mt-4">
        <CardHeader
          title="Derma terkini"
          description={`${donations.length} rekod dipaparkan${activeCampaign ? ` · ${activeCampaign.title}` : ""}.`}
          action={<HandCoins className="h-5 w-5 text-brand-900/30" />}
        />
        {donations.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Tiada derma bagi tapisan ini"
            description="Cuba pilih kempen atau status lain, atau tunggu derma baharu daripada jemaah."
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Penderma</th>
                  <th>Kempen</th>
                  <th className="text-right">Jumlah</th>
                  <th>Kaedah</th>
                  <th>Status</th>
                  <th>Dibayar</th>
                  <th>TPMJ</th>
                  {canConfirm && <th className="text-right">Tindakan</th>}
                </tr>
              </thead>
              <tbody>
                {donations.map((donation) => (
                  <tr key={donation.id}>
                    <td>
                      <p className="font-medium text-brand-950">
                        {donation.anonymous ? "Penderma Tanpa Nama" : donation.donorName}
                      </p>
                      <p className="text-[11px] text-brand-900/45">
                        {donation.recurring ? label(donation.frequency ?? "BULANAN") : "Sekali"}
                      </p>
                    </td>
                    <td className="text-xs">{donation.campaign?.title ?? "Tabung am"}</td>
                    <td className="whitespace-nowrap text-right font-semibold text-brand-950">
                      {rm(donation.amountSen)}
                    </td>
                    <td className="whitespace-nowrap text-xs">{donation.method ? label(donation.method) : "—"}</td>
                    <td>
                      <StatusBadge value={donation.status} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-brand-900/60">
                      {donation.paidAt ? tarikhMasa(donation.paidAt) : "—"}
                    </td>
                    <td>
                      {donation.tpmjSynced ? (
                        <Badge tone="success">TPMJ</Badge>
                      ) : donation.status === "DIBAYAR" ? (
                        <Badge tone="warning">Belum</Badge>
                      ) : (
                        <span className="text-xs text-brand-900/35">—</span>
                      )}
                    </td>
                    {canConfirm && (
                      <td className="text-right">
                        {donation.status === "MENUNGGU" ? (
                          <form action={confirmDonation}>
                            <input type="hidden" name="id" value={donation.id} />
                            <button type="submit" className="btn-secondary whitespace-nowrap text-xs">
                              Sahkan derma
                            </button>
                          </form>
                        ) : (
                          <span className="text-xs text-brand-900/30">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
