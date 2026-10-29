import type { Metadata } from "next";
import Link from "next/link";
import { BellRing, Clock, Filter, Inbox, Send, XCircle } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, Stat, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { PORTAL_ROLES, type Role } from "@/lib/roles";
import { label, type Tone } from "@/lib/labels";
import { percent, tarikhMasa } from "@/lib/utils";
import { processQueue, sendMessage } from "./actions";

export const metadata: Metadata = { title: "Pemberitahuan" };

const CHANNELS = ["SMS", "WHATSAPP", "EMAIL", "INAP"] as const;
const STATUSES = ["BERGILIR", "DIHANTAR", "GAGAL"] as const;
const MANAGER_ROLES: Role[] = ["SETIAUSAHA", "BENDAHARI", "KETUA"];

const CHANNEL_TONE: Record<string, Tone> = {
  SMS: "info",
  WHATSAPP: "success",
  EMAIL: "neutral",
  INAP: "warning",
};

export default async function PemberitahuanPage({
  searchParams,
}: {
  searchParams: Promise<{
    saluran?: string;
    status?: string;
    selesai?: string;
    ralat?: string;
    diproses?: string;
  }>;
}) {
  const user = await requirePageUser(PORTAL_ROLES);
  const mosque = await currentMosque();
  const params = await searchParams;

  const saluran = CHANNELS.includes((params.saluran ?? "") as (typeof CHANNELS)[number])
    ? (params.saluran as string)
    : "";
  const status = STATUSES.includes((params.status ?? "") as (typeof STATUSES)[number])
    ? (params.status as string)
    : "";
  const canManage = MANAGER_ROLES.includes(user.role);

  const where = {
    mosqueId: mosque.id,
    ...(saluran ? { channel: saluran } : {}),
    ...(status ? { status } : {}),
  };

  const [grouped, notifications, users] = await Promise.all([
    prisma.notification.groupBy({
      by: ["channel", "status"],
      where: { mosqueId: mosque.id },
      _count: { _all: true },
    }),
    prisma.notification.findMany({
      where,
      include: { user: { select: { name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    prisma.user.findMany({
      where: { mosqueId: mosque.id },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const total = grouped.reduce((sum, row) => sum + row._count._all, 0);
  const sent = grouped
    .filter((row) => row.status === "DIHANTAR")
    .reduce((sum, row) => sum + row._count._all, 0);
  const queued = grouped
    .filter((row) => row.status === "BERGILIR")
    .reduce((sum, row) => sum + row._count._all, 0);
  const failed = grouped
    .filter((row) => row.status === "GAGAL")
    .reduce((sum, row) => sum + row._count._all, 0);

  const channelStats = CHANNELS.map((channel) => ({
    channel,
    count: grouped
      .filter((row) => row.channel === channel)
      .reduce((sum, row) => sum + row._count._all, 0),
  }));

  const hasFilter = Boolean(saluran || status);

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Pemberitahuan"
        description="Hantar dan pantau mesej SMS, WhatsApp, e-mel dan pemberitahuan dalam aplikasi bagi masjid ini."
        actions={<Badge tone="info">Penyedia simulasi</Badge>}
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}
      {params.selesai === "hantar" && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          Mesej telah direkodkan dan diproses oleh penyedia mesej simulasi.
        </p>
      )}
      {params.selesai === "barisan" && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          Barisan diproses: {params.diproses ?? "0"} mesej diambil untuk penghantaran.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Dihantar"
          value={sent}
          hint={`${percent(sent, total)}% daripada ${total} rekod`}
          icon={Send}
        />
        <Stat label="Bergilir" value={queued} hint="Menunggu pemprosesan" icon={Clock} />
        <Stat label="Gagal" value={failed} hint="Perlu semakan semula" icon={XCircle} />
        <Stat label="Jumlah rekod" value={total} hint="Skop masjid ini" icon={BellRing} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Hantar mesej"
              description="Mesej dimasukkan ke dalam barisan dan dihantar melalui penyedia simulasi. Medan bertanda * wajib diisi."
            />
            {canManage ? (
              <form action={sendMessage} className="grid gap-4 p-5 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="channel">
                    Saluran *
                  </label>
                  <select id="channel" name="channel" defaultValue="SMS" className="input">
                    <option value="SMS">SMS</option>
                    <option value="WHATSAPP">WhatsApp</option>
                    <option value="EMAIL">E-mel</option>
                    <option value="INAP">Dalam aplikasi</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="recipient">
                    Penerima
                  </label>
                  <input
                    id="recipient"
                    name="recipient"
                    placeholder="012-345 6789 atau nama@contoh.my"
                    className="input"
                  />
                  <p className="mt-1 text-[11px] text-brand-900/45">
                    Untuk SMS/WhatsApp masukkan nombor telefon; untuk e-mel masukkan alamat e-mel. Untuk
                    INAP, pilih pengguna di bawah.
                  </p>
                </div>
                <div>
                  <label className="label" htmlFor="userId">
                    Pengguna dalam aplikasi (INAP)
                  </label>
                  <select id="userId" name="userId" defaultValue="" className="input">
                    <option value="">— Pilih pengguna —</option>
                    {users.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name ?? item.email} — {item.email} ({label(item.role)})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="subject">
                    Subjek
                  </label>
                  <input
                    id="subject"
                    name="subject"
                    placeholder="Wajib untuk e-mel dan INAP"
                    className="input"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="messageBody">
                    Kandungan *
                  </label>
                  <textarea
                    id="messageBody"
                    name="body"
                    rows={4}
                    required
                    maxLength={4000}
                    placeholder="Tulis kandungan mesej dalam Bahasa Melayu…"
                    className="input"
                  />
                </div>
                <div className="flex justify-end sm:col-span-2">
                  <button type="submit" className="btn-primary">
                    <Send className="h-4 w-4" /> Hantar mesej
                  </button>
                </div>
              </form>
            ) : (
              <p className="p-5 text-xs leading-relaxed text-brand-900/55">
                Anda boleh melihat rekod pemberitahuan sahaja. Hanya Bendahari, Pengerusi dan Setiausaha
                boleh menghantar mesej atau memproses barisan.
              </p>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Senarai pemberitahuan"
              description={`${notifications.length} rekod dipaparkan (terbaharu dahulu, maksimum 200).`}
            />
            <form method="get" action="/portal/pemberitahuan" className="flex flex-wrap items-end gap-3 border-b border-brand-900/5 p-4">
              <div>
                <label className="label" htmlFor="saluran">
                  Saluran
                </label>
                <select id="saluran" name="saluran" defaultValue={saluran} className="input w-auto">
                  <option value="">Semua saluran</option>
                  {CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {label(channel)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="status">
                  Status
                </label>
                <select id="status" name="status" defaultValue={status} className="input w-auto">
                  <option value="">Semua status</option>
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {label(value)}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-secondary">
                <Filter className="h-4 w-4" /> Tapis
              </button>
              {hasFilter && (
                <Link href="/portal/pemberitahuan" className="text-xs font-medium text-brand-900/50 hover:text-brand-900">
                  Set semula
                </Link>
              )}
            </form>

            {notifications.length === 0 ? (
              <EmptyState
                icon={Inbox}
                title="Tiada pemberitahuan"
                description={
                  hasFilter
                    ? "Tiada mesej sepadan dengan tapisan ini. Cuba saluran atau status yang lain."
                    : "Mesej yang dihantar akan dipaparkan di sini bersama status penghantaran."
                }
                action={
                  hasFilter ? (
                    <Link href="/portal/pemberitahuan" className="btn-secondary">
                      Set semula tapisan
                    </Link>
                  ) : undefined
                }
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Masa</th>
                      <th>Saluran</th>
                      <th>Penerima</th>
                      <th>Templat</th>
                      <th>Subjek</th>
                      <th>Status</th>
                      <th>Ralat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {notifications.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <p className="whitespace-nowrap text-xs text-brand-900/65">
                            {tarikhMasa(row.createdAt)}
                          </p>
                          {row.sentAt && (
                            <p className="text-[10px] text-brand-900/40">
                              Dihantar {tarikhMasa(row.sentAt)}
                            </p>
                          )}
                        </td>
                        <td>
                          <Badge tone={CHANNEL_TONE[row.channel] ?? "neutral"}>{label(row.channel)}</Badge>
                        </td>
                        <td>
                          <p className="text-xs font-medium text-brand-950">
                            {row.channel === "INAP" && row.user ? row.user.email : row.to}
                          </p>
                          {row.user && (
                            <p className="text-[10px] text-brand-900/45">{row.user.name}</p>
                          )}
                        </td>
                        <td className="text-xs">{label(row.template)}</td>
                        <td className="max-w-[200px]">
                          <p className="truncate text-xs" title={row.subject ?? undefined}>
                            {row.subject ?? "—"}
                          </p>
                        </td>
                        <td>
                          <StatusBadge value={row.status} />
                        </td>
                        <td className="max-w-[180px]">
                          <p className="truncate text-[11px] text-red-600" title={row.error ?? undefined}>
                            {row.error ?? "—"}
                          </p>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Mengikut saluran" description="Jumlah rekod mengikut saluran bagi masjid ini." />
            <div className="space-y-4 p-5">
              {channelStats.map(({ channel, count }) => (
                <div key={channel}>
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-brand-950">{label(channel)}</span>
                    <span className="text-brand-900/50">
                      {count} · {percent(count, total)}%
                    </span>
                  </div>
                  <Progress
                    value={percent(count, total)}
                    className="mt-1.5"
                    tone={channel === "INAP" ? "gold" : "brand"}
                  />
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <CardHeader
              title="Barisan penghantaran"
              description="Proses mesej berstatus Bergilir melalui penyedia simulasi."
            />
            <div className="p-5">
              <div className="flex items-center justify-between rounded-xl bg-sand/70 p-4">
                <div>
                  <p className="text-2xl font-semibold tracking-tight text-brand-950">{queued}</p>
                  <p className="text-xs text-brand-900/55">mesej bergilir</p>
                </div>
                <Clock className="h-6 w-6 text-brand-700/60" />
              </div>

              {canManage ? (
                <form action={processQueue} className="mt-4">
                  <button type="submit" className="btn-primary w-full" disabled={queued === 0}>
                    <BellRing className="h-4 w-4" /> Proses barisan
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-brand-900/55">
                  Hanya Bendahari, Pengerusi dan Setiausaha boleh memproses barisan.
                </p>
              )}

              <p className="mt-3 text-[11px] leading-relaxed text-brand-900/45">
                Pemprosesan mengambil sehingga 50 mesej dalam satu masa. Dalam demo, penghantaran adalah
                simulasi dan tiada mesej sebenar dihantar.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
