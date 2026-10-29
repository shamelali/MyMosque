import type { Metadata } from "next";
import Link from "next/link";
import {
  CheckCircle2,
  ClipboardList,
  Package,
  Play,
  Plus,
  SearchCheck,
  Wrench,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatusBadge } from "@/components/ui/card";
import { EmptyState, Tabs } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { label } from "@/lib/labels";
import { rm, tarikh } from "@/lib/utils";
import {
  addAsset,
  addInspection,
  approveRequest,
  completeRequest,
  createRequest,
  rejectRequest,
  startRequest,
} from "./actions";

export const metadata: Metadata = { title: "Selenggaraan" };

const TABS = [
  { key: "aset", label: "Aset" },
  { key: "aduan", label: "Aduan" },
  { key: "pemeriksaan", label: "Pemeriksaan" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default async function SelenggaraanPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; ralat?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const { tab: rawTab, ralat } = await searchParams;
  const tab: TabKey = TABS.some((t) => t.key === rawTab) ? (rawTab as TabKey) : "aset";

  const [assets, requests, inspections] = await Promise.all([
    prisma.asset.findMany({
      where: { mosqueId: mosque.id },
      include: { _count: { select: { requests: true } } },
      orderBy: { name: "asc" },
    }),
    prisma.maintenanceRequest.findMany({
      where: { mosqueId: mosque.id },
      include: { asset: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.inspection.findMany({
      where: { mosqueId: mosque.id },
      include: { asset: { select: { name: true } } },
      orderBy: { date: "desc" },
    }),
  ]);

  const canAct = user.role === "KETUA" || user.role === "AJK";
  const canCreate = canAct || user.role === "SETIAUSAHA";
  const openRequests = requests.filter((r) => !["SELESAI", "DITOLAK"].includes(r.status)).length;
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <PageHeader
        eyebrow="Operasi"
        title="Selenggaraan"
        description="Urus aset masjid, aduan kerosakan dan rekod pemeriksaan berkala."
      />

      {ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {ralat}
        </p>
      )}

      <Tabs
        active={`/portal/selenggaraan?tab=${tab}`}
        items={TABS.map((t) => ({
          href: `/portal/selenggaraan?tab=${t.key}`,
          label: t.label,
          count: t.key === "aset" ? assets.length : t.key === "aduan" ? openRequests : undefined,
        }))}
      />

      {tab === "aset" && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title="Daftar aset" description="Aset alih dan tak alih milik masjid." />
            {assets.length === 0 ? (
              <EmptyState
                icon={Package}
                title="Belum ada aset didaftarkan"
                description="Tambah aset masjid menggunakan borang di sebelah."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama aset</th>
                      <th>Kategori</th>
                      <th>Lokasi</th>
                      <th>Diperoleh</th>
                      <th className="text-right">Nilai</th>
                      <th>Keadaan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {assets.map((asset) => (
                      <tr key={asset.id}>
                        <td>
                          <p className="font-medium text-brand-950">{asset.name}</p>
                          <p className="text-[11px] text-brand-900/45">{asset._count.requests} aduan berkaitan</p>
                        </td>
                        <td className="whitespace-nowrap text-xs">{label(asset.category)}</td>
                        <td className="text-xs">{asset.location ?? "—"}</td>
                        <td className="whitespace-nowrap text-xs text-brand-900/60">{tarikh(asset.acquiredAt)}</td>
                        <td className="whitespace-nowrap text-right text-xs font-medium">{rm(asset.valueSen)}</td>
                        <td>
                          <StatusBadge value={asset.condition} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="self-start">
            <CardHeader title="Tambah aset" description="Daftarkan aset baharu masjid." />
            {canCreate ? (
              <form action={addAsset} className="space-y-3 p-5">
                <div>
                  <label className="label" htmlFor="assetName">Nama aset</label>
                  <input id="assetName" name="name" required placeholder="Contoh: Penghawa dingin dewan" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="assetCategory">Kategori</label>
                  <select id="assetCategory" name="category" className="input" defaultValue="PERABOT">
                    {["PERABOT", "ELEKTRIK", "KENDERAAN", "BANGUNAN", "AUDIO"].map((category) => (
                      <option key={category} value={category}>{label(category)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="assetLocation">Lokasi</label>
                  <input id="assetLocation" name="location" placeholder="Dewan Solat Utama" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="assetDate">Tarikh diperoleh</label>
                  <input id="assetDate" name="acquiredAt" type="date" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="assetValue">Nilai (RM)</label>
                  <input id="assetValue" name="value" type="number" step="0.01" min="0" placeholder="0.00" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="assetCondition">Keadaan</label>
                  <select id="assetCondition" name="condition" className="input" defaultValue="BAIK">
                    <option value="BAIK">Baik</option>
                    <option value="SEDERHANA">Sederhana</option>
                    <option value="ROSAK">Rosak</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary w-full">
                  <Plus className="h-4 w-4" /> Simpan aset
                </button>
              </form>
            ) : (
              <EmptyState icon={Package} title="Akses terhad" description="Hanya AJK, Setiausaha dan Pengerusi boleh menambah aset." />
            )}
          </Card>
        </div>
      )}

      {tab === "aduan" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            {requests.length === 0 ? (
              <Card>
                <EmptyState
                  icon={Wrench}
                  title="Tiada aduan selenggaraan"
                  description="Aduan kerosakan yang dilaporkan akan dipaparkan di sini."
                />
              </Card>
            ) : (
              requests.map((request) => (
                <Card key={request.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-950">{request.title}</p>
                      <p className="mt-1 text-[11px] text-brand-900/50">
                        Dilaporkan oleh {request.reportedBy ?? "—"} · {tarikh(request.createdAt)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge value={request.priority} />
                      <StatusBadge value={request.status} />
                    </div>
                  </div>

                  {request.description && (
                    <p className="mt-3 text-xs leading-relaxed text-brand-900/70">{request.description}</p>
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-brand-900/55">
                    {request.asset ? (
                      <Link
                        href="/portal/selenggaraan?tab=aset"
                        className="inline-flex items-center gap-1 font-medium text-brand-700 hover:text-brand-900"
                      >
                        <Package className="h-3.5 w-3.5" /> Aset: {request.asset.name}
                      </Link>
                    ) : (
                      <span>Tiada aset berkaitan</span>
                    )}
                    {request.costSen != null && (
                      <span>
                        Kos: <span className="font-semibold text-brand-900/75">{rm(request.costSen)}</span>
                      </span>
                    )}
                    {request.completedAt && <span>Selesai {tarikh(request.completedAt)}</span>}
                  </div>

                  {canAct && (
                    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brand-900/5 pt-3">
                      {request.status === "DIHANTAR" && (
                        <>
                          <form action={approveRequest}>
                            <input type="hidden" name="id" value={request.id} />
                            <button type="submit" className="btn-secondary !px-2.5 !py-1.5 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Lulus
                            </button>
                          </form>
                          <form action={rejectRequest}>
                            <input type="hidden" name="id" value={request.id} />
                            <button type="submit" className="btn-ghost !px-2.5 !py-1.5 text-xs text-red-600 hover:bg-red-50">
                              <XCircle className="h-3.5 w-3.5" /> Tolak
                            </button>
                          </form>
                        </>
                      )}

                      {request.status === "DILULUSKAN" && (
                        <>
                          <form action={startRequest}>
                            <input type="hidden" name="id" value={request.id} />
                            <button type="submit" className="btn-secondary !px-2.5 !py-1.5 text-xs">
                              <Play className="h-3.5 w-3.5" /> Mula kerja
                            </button>
                          </form>
                          <form action={rejectRequest}>
                            <input type="hidden" name="id" value={request.id} />
                            <button type="submit" className="btn-ghost !px-2.5 !py-1.5 text-xs text-red-600 hover:bg-red-50">
                              <XCircle className="h-3.5 w-3.5" /> Tolak
                            </button>
                          </form>
                        </>
                      )}

                      {request.status === "DALAM_PROSES" && (
                        <form action={completeRequest} className="flex items-end gap-2">
                          <input type="hidden" name="id" value={request.id} />
                          <div>
                            <label className="sr-only" htmlFor={`cost-${request.id}`}>Kos pembaikan (RM)</label>
                            <input
                              id={`cost-${request.id}`}
                              name="cost"
                              type="number"
                              step="0.01"
                              min="0"
                              required
                              placeholder="Kos (RM)"
                              className="input !w-32 !py-1.5 text-xs"
                            />
                          </div>
                          <button type="submit" className="btn-primary !px-2.5 !py-1.5 text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Selesai
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </Card>
              ))
            )}
          </div>

          <Card className="self-start">
            <CardHeader title="Lapor aduan" description="Laporkan kerosakan atau kerja selenggaraan." />
            {canCreate ? (
              <form action={createRequest} className="space-y-3 p-5">
                <div>
                  <label className="label" htmlFor="requestTitle">Tajuk aduan</label>
                  <input id="requestTitle" name="title" required placeholder="Contoh: Bocor bumbung Blok B" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="requestDescription">Keterangan</label>
                  <textarea id="requestDescription" name="description" rows={3} placeholder="Terangkan kerosakan…" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="requestAsset">Aset berkaitan</label>
                  <select id="requestAsset" name="assetId" className="input" defaultValue="">
                    <option value="">Tiada aset berkaitan</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="requestPriority">Keutamaan</label>
                  <select id="requestPriority" name="priority" className="input" defaultValue="SEDERHANA">
                    <option value="RENDAH">Rendah</option>
                    <option value="SEDERHANA">Sederhana</option>
                    <option value="TINGGI">Tinggi</option>
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="requestReporter">Dilaporkan oleh</label>
                  <input id="requestReporter" name="reportedBy" defaultValue={user.name ?? ""} className="input" />
                </div>
                <button type="submit" className="btn-primary w-full">
                  <Wrench className="h-4 w-4" /> Hantar aduan
                </button>
              </form>
            ) : (
              <EmptyState icon={Wrench} title="Akses terhad" description="Hanya AJK, Setiausaha dan Pengerusi boleh melaporkan aduan." />
            )}
          </Card>
        </div>
      )}

      {tab === "pemeriksaan" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader title="Rekod pemeriksaan" description="Pemeriksaan keselamatan dan keadaan aset." />
            {inspections.length === 0 ? (
              <EmptyState
                icon={SearchCheck}
                title="Belum ada pemeriksaan"
                description="Rekod pemeriksaan pertama menggunakan borang di sebelah."
              />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Tarikh</th>
                      <th>Aset</th>
                      <th>Pemeriksa</th>
                      <th>Dapatan</th>
                      <th>Keputusan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inspections.map((inspection) => (
                      <tr key={inspection.id}>
                        <td className="whitespace-nowrap text-xs text-brand-900/60">{tarikh(inspection.date)}</td>
                        <td className="text-xs">{inspection.asset?.name ?? "Keseluruhan premis"}</td>
                        <td className="text-xs">{inspection.inspector}</td>
                        <td className="max-w-xs text-xs text-brand-900/70">{inspection.findings}</td>
                        <td>
                          <StatusBadge value={inspection.result} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="self-start">
            <CardHeader title="Rekod pemeriksaan" description="Simpan dapatan pemeriksaan baharu." />
            {canCreate ? (
              <form action={addInspection} className="space-y-3 p-5">
                <div>
                  <label className="label" htmlFor="inspectionDate">Tarikh</label>
                  <input id="inspectionDate" name="date" type="date" required defaultValue={todayValue} className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="inspectionInspector">Pemeriksa</label>
                  <input id="inspectionInspector" name="inspector" required placeholder="Nama atau agensi" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="inspectionAsset">Aset (pilihan)</label>
                  <select id="inspectionAsset" name="assetId" className="input" defaultValue="">
                    <option value="">Keseluruhan premis</option>
                    {assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>{asset.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="inspectionFindings">Dapatan</label>
                  <textarea id="inspectionFindings" name="findings" required rows={4} placeholder="Catatkan dapatan pemeriksaan…" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="inspectionResult">Keputusan</label>
                  <select id="inspectionResult" name="result" className="input" defaultValue="LULUS">
                    <option value="LULUS">Lulus</option>
                    <option value="TINDAKAN">Perlu tindakan</option>
                  </select>
                </div>
                <button type="submit" className="btn-primary w-full">
                  <ClipboardList className="h-4 w-4" /> Simpan pemeriksaan
                </button>
              </form>
            ) : (
              <EmptyState icon={SearchCheck} title="Akses terhad" description="Hanya AJK, Setiausaha dan Pengerusi boleh merekod pemeriksaan." />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
