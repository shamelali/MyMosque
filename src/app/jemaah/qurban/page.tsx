import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Beef, CalendarDays, HandCoins, Package, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { percent, rm, tarikh } from "@/lib/utils";
import { createOrder } from "./actions";

export const metadata: Metadata = { title: "Qurban" };

export default async function JemaahQurbanPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; ralat?: string }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;

  const programs = await prisma.qurbanProgram.findMany({
    where: {
      status: "DIBUKA",
      availableShares: { gt: 0 },
      ...(user.mosqueId ? { mosqueId: user.mosqueId } : {}),
    },
    orderBy: [{ year: "desc" }, { distributionDate: "asc" }],
  });
  const selected = programs.find((program) => program.id === params.program) ?? programs[0] ?? null;
  const maxShares = Math.max(1, ...programs.map((program) => program.availableShares));

  const profile = await prisma.user.findUnique({
    where: { id: user.id },
    select: { name: true, email: true, phone: true },
  });

  const myOrders = await prisma.qurbanOrder.findMany({
    where: { email: profile?.email ?? "__tiada__" },
    include: { program: { select: { year: true, animal: true } } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  return (
    <div>
      <PageHeader
        eyebrow="Jemaah"
        title="Qurban"
        description="Tempah bahagian qurban dan semak status pesanan anda. Setiap bahagian diagihkan kepada penerima yang memerlukan."
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}

      <SectionTitle action={<span className="text-xs text-brand-900/45">{programs.length} program dibuka</span>}>
        Program qurban
      </SectionTitle>

      {programs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Beef}
            title="Tiada program qurban dibuka"
            description="Program baharu akan diumumkan menjelang musim qurban. Sila kembali semula nanti."
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs.map((program) => {
            const sold = program.totalShares - program.availableShares;
            return (
              <Card key={program.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-600">Qurban {program.year}</p>
                    <h3 className="text-base font-semibold text-brand-950">{label(program.animal)}</h3>
                  </div>
                  <Badge tone={program.permissionStatus === "DILULUSKAN" ? "success" : "warning"}>
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {program.permissionStatus === "DILULUSKAN" ? "Kebenaran JAINJ" : "Menunggu kebenaran"}
                  </Badge>
                </div>

                <p className="mt-3 text-xl font-semibold text-brand-950">
                  {rm(program.pricePerShareSen)}
                  <span className="ml-1 text-xs font-medium text-brand-900/45">/ bahagian</span>
                </p>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-brand-900/55">
                    <span>{sold} daripada {program.totalShares} ditempah</span>
                    <span>{program.availableShares} baki</span>
                  </div>
                  <Progress value={percent(sold, program.totalShares)} className="mt-1.5" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-brand-900/50">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> Agihan {tarikh(program.distributionDate)}
                  </span>
                  {program.providerName && <span>{program.providerName}</span>}
                </div>

                {program.permissionStatus === "MENUNGGU" && (
                  <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] font-medium text-amber-800 ring-1 ring-inset ring-amber-600/15">
                    Kebenaran JAINJ bagi program ini masih diproses. Anda boleh menempah, dan masjid akan menghubungi
                    anda jika terdapat perubahan.
                  </p>
                )}

                <Link
                  href={`/jemaah/qurban?program=${program.id}#tempah`}
                  className="btn-primary mt-4 w-full"
                >
                  Tempah bahagian <ArrowRight className="h-4 w-4" />
                </Link>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <Card className="mt-6 scroll-mt-20">
          <span id="tempah" className="block" />
          <CardHeader
            title="Borang tempahan qurban"
            description="Jumlah bayaran ialah bilangan bahagian × harga sebahagian bagi program yang dipilih."
          />
          <form action={createOrder} className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="orderProgram">Program *</label>
              <select id="orderProgram" name="programId" required defaultValue={selected.id} className="input">
                {programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    Qurban {program.year} · {label(program.animal)} · {rm(program.pricePerShareSen)}/bahagian ·{" "}
                    {program.availableShares} baki
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label" htmlFor="orderShares">Bilangan bahagian *</label>
              <input
                id="orderShares"
                name="shares"
                type="number"
                min="1"
                max={maxShares}
                defaultValue="1"
                required
                className="input"
              />
              <p className="mt-1 text-[11px] text-brand-900/45">Baki bahagian disemak semula semasa tempahan dibuat.</p>
            </div>
            <div>
              <label className="label" htmlFor="orderPhone">No. telefon</label>
              <input
                id="orderPhone"
                name="phone"
                type="tel"
                defaultValue={profile?.phone ?? ""}
                placeholder="012-345 6789"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="orderName">Nama penempah *</label>
              <input
                id="orderName"
                name="customerName"
                required
                defaultValue={profile?.name ?? user.name ?? ""}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="orderEmail">E-mel *</label>
              <input
                id="orderEmail"
                name="email"
                type="email"
                required
                defaultValue={profile?.email ?? user.email ?? ""}
                className="input"
              />
            </div>

            <div className="sm:col-span-2">
              <button type="submit" className="btn-primary w-full sm:w-auto">
                Teruskan ke pembayaran <ArrowRight className="h-4 w-4" />
              </button>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-brand-900/45">
                <ShieldCheck className="h-3.5 w-3.5" /> Bayaran diselesaikan terus kepada masjid melalui gerbang simulasi.
              </p>
            </div>
          </form>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader
          title="Pesanan saya"
          description="Pesanan qurban yang direkodkan dengan e-mel akaun anda."
          action={<Package className="h-5 w-5 text-brand-900/30" />}
        />
        {myOrders.length === 0 ? (
          <EmptyState
            icon={HandCoins}
            title="Belum ada pesanan qurban"
            description="Tempah bahagian pertama anda menggunakan borang di atas."
          />
        ) : (
          <ul className="divide-y divide-brand-900/5">
            {myOrders.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-brand-950">
                    {order.orderNo} · Qurban {order.program.year} ({label(order.program.animal)})
                  </p>
                  <p className="text-[11px] text-brand-900/50">
                    {order.shares} bahagian · {tarikh(order.createdAt)}
                  </p>
                  <div className="mt-1">
                    <StatusBadge value={order.status} />
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-brand-950">{rm(order.amountSen)}</p>
                  {order.status === "MENUNGGU" ? (
                    <Link
                      href={`/jemaah/bayar/QURBAN/${order.id}`}
                      className="mt-1 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                    >
                      Bayar sekarang <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : (
                    <span className="mt-1 block text-[11px] text-brand-900/40">
                      {order.status === "DIBAYAR" ? "Bayaran diterima" : label(order.status)}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
