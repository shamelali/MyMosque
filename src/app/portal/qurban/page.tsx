import type { Metadata } from "next";
import type { QurbanDistribution, QurbanOrder } from "@prisma/client";
import Link from "next/link";
import {
  Beef,
  CalendarDays,
  CheckCircle2,
  PackageCheck,
  Plus,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { percent, rm, tarikh, tarikhMasa } from "@/lib/utils";
import { confirmOrder, createProgram, markDelivered, recordDistribution, setPermission } from "./actions";

export const metadata: Metadata = { title: "Qurban" };

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export default async function PortalQurbanPage({
  searchParams,
}: {
  searchParams: Promise<{ program?: string; ralat?: string; maklum?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const params = await searchParams;

  const canManage = ["BENDAHARI", "KETUA", "SETIAUSAHA"].includes(user.role);
  const canConfirm = ["BENDAHARI", "KETUA"].includes(user.role);
  const canApprove = user.role === "KETUA";

  const programs = await prisma.qurbanProgram.findMany({
    where: { mosqueId: mosque.id },
    orderBy: [{ year: "desc" }, { distributionDate: "desc" }],
  });
  const selected = programs.find((item) => item.id === params.program) ?? programs[0] ?? null;

  let orders: QurbanOrder[] = [];
  let distributions: QurbanDistribution[] = [];
  if (selected) {
    const rows = await Promise.all([
      prisma.qurbanOrder.findMany({
        where: { programId: selected.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
      prisma.qurbanDistribution.findMany({
        where: { programId: selected.id },
        orderBy: { packNo: "asc" },
        take: 100,
      }),
    ]);
    orders = rows[0];
    distributions = rows[1];
  }

  const soldShares = selected ? selected.totalShares - selected.availableShares : 0;
  const delivered = distributions.filter((item) => item.deliveredAt).length;
  const distributionTarget = selected?.totalShares ?? 0;
  const now = new Date();
  const defaultDistributionDate = dateValue(new Date(now.getTime() + 30 * 86_400_000));

  return (
    <div>
      <PageHeader
        eyebrow="Hasil & Komuniti"
        title="Qurban"
        description={`Urus program qurban, kebenaran JAINJ, pesanan dan agihan daging ${mosque.name}.`}
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

      <SectionTitle>Program qurban</SectionTitle>
      {programs.length === 0 ? (
        <Card>
          <EmptyState
            icon={Beef}
            title="Belum ada program qurban"
            description="Buka program qurban baharu untuk mula menerima tempahan bahagian."
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {programs.map((program) => {
            const sold = program.totalShares - program.availableShares;
            return (
              <Card key={program.id} className="flex flex-col p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-gold-600">Qurban {program.year}</p>
                    <h3 className="text-sm font-semibold text-brand-950">{label(program.animal)}</h3>
                  </div>
                  <StatusBadge value={program.status} />
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone={program.permissionStatus === "DILULUSKAN" ? "success" : "warning"}>
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {program.permissionStatus === "DILULUSKAN" ? "Kebenaran JAINJ" : "Kebenaran menunggu"}
                  </Badge>
                  {program.permissionRef && (
                    <span className="text-[11px] text-brand-900/45">{program.permissionRef}</span>
                  )}
                </div>

                <p className="mt-3 text-xl font-semibold text-brand-950">
                  {rm(program.pricePerShareSen)}
                  <span className="ml-1 text-xs font-medium text-brand-900/45">/ bahagian</span>
                </p>

                <div className="mt-3">
                  <div className="flex items-center justify-between text-[11px] text-brand-900/55">
                    <span>
                      {sold} / {program.totalShares} bahagian ditempah
                    </span>
                    <span>{program.availableShares} baki</span>
                  </div>
                  <Progress value={percent(sold, program.totalShares)} className="mt-1.5" />
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-brand-900/45">
                  <span className="inline-flex items-center gap-1">
                    <CalendarDays className="h-3.5 w-3.5" /> Agihan {tarikh(program.distributionDate)}
                  </span>
                  {program.providerName && <span>{program.providerName}</span>}
                </div>

                <div className="mt-auto flex flex-wrap gap-2 pt-4">
                  <Link href={`/portal/qurban?program=${program.id}#pesanan`} className="btn-secondary text-xs">
                    Lihat pesanan
                  </Link>
                  {canApprove && program.permissionStatus === "MENUNGGU" && (
                    <form action={setPermission}>
                      <input type="hidden" name="id" value={program.id} />
                      <button type="submit" className="btn-gold text-xs">
                        <ShieldCheck className="h-3.5 w-3.5" /> Tetapkan kebenaran
                      </button>
                    </form>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {canManage && (
        <Card className="mt-6">
          <CardHeader
            title="Program qurban baharu"
            description="Program dibuka dengan status kebenaran MENUNGGU sehingga Pengerusi merekodkan kebenaran JAINJ."
          />
          <form action={createProgram} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label" htmlFor="qurbanYear">Tahun *</label>
              <input
                id="qurbanYear"
                name="year"
                type="number"
                min={now.getFullYear() - 1}
                max={now.getFullYear() + 5}
                defaultValue={now.getFullYear()}
                required
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="qurbanAnimal">Haiwan *</label>
              <select id="qurbanAnimal" name="animal" className="input" defaultValue="LEMBU">
                <option value="LEMBU">Lembu</option>
                <option value="KAMBING">Kambing</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="qurbanPrice">Harga / bahagian (RM) *</label>
              <input
                id="qurbanPrice"
                name="price"
                type="number"
                step="0.01"
                min="1"
                required
                placeholder="700.00"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="qurbanShares">Jumlah bahagian *</label>
              <input
                id="qurbanShares"
                name="totalShares"
                type="number"
                min="1"
                max="500"
                required
                placeholder="35"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="qurbanDate">Tarikh agihan *</label>
              <input
                id="qurbanDate"
                name="distributionDate"
                type="date"
                required
                defaultValue={defaultDistributionDate}
                className="input"
              />
            </div>
            <div className="flex items-end justify-end">
              <button type="submit" className="btn-primary">
                <Plus className="h-4 w-4" /> Buka program
              </button>
            </div>
          </form>
        </Card>
      )}

      {selected ? (
        <>
          <Card className="mt-6 scroll-mt-20" >
            <span id="pesanan" className="block" />
            <CardHeader
              title={`Pesanan qurban ${selected.year} · ${label(selected.animal)}`}
              description={`${orders.length} pesanan bagi program ini. Sahkan bayaran selepas dana diterima.`}
              action={<Users className="h-5 w-5 text-brand-900/30" />}
            />
            {orders.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Belum ada pesanan"
                description="Pesanan jemaah akan muncul di sini selepas mereka menempah bahagian qurban."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>No. pesanan</th>
                      <th>Pelanggan</th>
                      <th className="text-right">Bahagian</th>
                      <th className="text-right">Jumlah</th>
                      <th>Status</th>
                      <th>Tarikh</th>
                      {canConfirm && <th className="text-right">Tindakan</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td className="whitespace-nowrap font-mono text-xs">{order.orderNo}</td>
                        <td>
                          <p className="font-medium text-brand-950">{order.customerName}</p>
                          <p className="text-[11px] text-brand-900/45">{order.phone ?? order.email ?? "—"}</p>
                        </td>
                        <td className="text-right">{order.shares}</td>
                        <td className="whitespace-nowrap text-right font-semibold">{rm(order.amountSen)}</td>
                        <td>
                          <StatusBadge value={order.status} />
                        </td>
                        <td className="whitespace-nowrap text-xs text-brand-900/60">{tarikh(order.createdAt)}</td>
                        {canConfirm && (
                          <td className="text-right">
                            {order.status === "MENUNGGU" ? (
                              <form action={confirmOrder}>
                                <input type="hidden" name="id" value={order.id} />
                                <button type="submit" className="btn-secondary whitespace-nowrap text-xs">
                                  Sahkan bayaran
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

          <Card className="mt-6">
            <CardHeader
              title="Agihan daging"
              description={`Pek dihantar: ${delivered} / ${distributionTarget} bahagian bagi program ${selected.year}.`}
              action={<PackageCheck className="h-5 w-5 text-brand-900/30" />}
            />
            <div className="px-5 pt-4">
              <Progress value={percent(delivered, distributionTarget)} tone="gold" />
              <p className="mt-1 text-[11px] font-medium text-brand-900/50">
                {percent(delivered, distributionTarget)}% agihan selesai
              </p>
            </div>

            {canManage && (
              <form action={recordDistribution} className="grid gap-3 border-b border-brand-900/5 p-5 sm:grid-cols-2 lg:grid-cols-5">
                <input type="hidden" name="programId" value={selected.id} />
                <div className="lg:col-span-2">
                  <label className="label" htmlFor="recipientName">Nama penerima *</label>
                  <input id="recipientName" name="recipientName" required placeholder="Contoh: Surau Taman Abad" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="recipientPhone">Telefon</label>
                  <input id="recipientPhone" name="recipientPhone" placeholder="012-345 6789" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="recipientArea">Kawasan</label>
                  <input id="recipientArea" name="area" placeholder="Taman Abad" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="deliveredBy">Dihantar oleh</label>
                  <input id="deliveredBy" name="deliveredBy" defaultValue={user.name ?? ""} className="input" />
                </div>
                <div className="flex justify-end sm:col-span-2 lg:col-span-5">
                  <button type="submit" className="btn-primary">
                    <Truck className="h-4 w-4" /> Rekod pek agihan
                  </button>
                </div>
              </form>
            )}

            {distributions.length === 0 ? (
              <EmptyState
                icon={PackageCheck}
                title="Belum ada pek agihan"
                description="Rekod pek pertama selepas daging diagihkan kepada penerima."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Pek</th>
                      <th>Penerima</th>
                      <th>Kawasan</th>
                      <th>Dihantar oleh</th>
                      <th>Status</th>
                      {canManage && <th className="text-right">Tindakan</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {distributions.map((distribution) => (
                      <tr key={distribution.id}>
                        <td className="whitespace-nowrap font-mono text-xs">{distribution.packNo}</td>
                        <td>
                          <p className="font-medium text-brand-950">{distribution.recipientName}</p>
                          <p className="text-[11px] text-brand-900/45">{distribution.recipientPhone ?? "—"}</p>
                        </td>
                        <td className="text-xs">{distribution.area ?? "—"}</td>
                        <td className="text-xs">{distribution.deliveredBy ?? "—"}</td>
                        <td>
                          {distribution.deliveredAt ? (
                            <Badge tone="success">
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Dihantar {tarikhMasa(distribution.deliveredAt)}
                            </Badge>
                          ) : (
                            <Badge tone="warning">Belum dihantar</Badge>
                          )}
                        </td>
                        {canManage && (
                          <td className="text-right">
                            {distribution.deliveredAt ? (
                              <span className="text-xs text-brand-900/30">—</span>
                            ) : (
                              <form action={markDelivered}>
                                <input type="hidden" name="id" value={distribution.id} />
                                <button type="submit" className="btn-secondary whitespace-nowrap text-xs">
                                  Tanda dihantar
                                </button>
                              </form>
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
        </>
      ) : (
        <Card className="mt-6">
          <EmptyState
            icon={Beef}
            title="Pilih program untuk melihat pesanan"
            description="Buka program qurban baharu terlebih dahulu untuk mula menerima tempahan."
          />
        </Card>
      )}
    </div>
  );
}
