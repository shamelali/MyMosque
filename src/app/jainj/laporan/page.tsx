import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheck,
  CircleDollarSign,
  CircleX,
  ClipboardList,
  Download,
  FileText,
  Info,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat, StatusBadge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { bulanTahun, rm, tarikh } from "@/lib/utils";
import { approveReport, rejectReport } from "./actions";

export const metadata: Metadata = { title: "Laporan Konsolidasi" };

const STATUSES = ["DRAF", "DIHANTAR", "DILULUSKAN", "DITOLAK"] as const;

export default async function LaporanKonsolidasiPage({
  searchParams,
}: {
  searchParams: Promise<{
    bulan?: string;
    status?: string;
    masjid?: string;
    selesai?: string;
    ralat?: string;
  }>;
}) {
  const user = await requirePageUser();
  const params = await searchParams;

  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const key = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.bulan ?? "") ? params.bulan! : currentKey;
  const [year, month] = key.split("-").map(Number);

  const selectedStatus = STATUSES.includes(
    (params.status ?? "") as (typeof STATUSES)[number],
  )
    ? (params.status as string)
    : "SEMUA";
  const masjid = (params.masjid ?? "").trim();

  const [reports, mosques] = await Promise.all([
    prisma.monthlyReport.findMany({
      where: {
        month,
        year,
        ...(selectedStatus !== "SEMUA" ? { status: selectedStatus } : {}),
        ...(masjid ? { mosqueId: masjid } : {}),
      },
      include: {
        mosque: { select: { id: true, name: true, district: true, code: true } },
      },
    }),
    prisma.mosque.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  reports.sort((a, b) => a.mosque.name.localeCompare(b.mosque.name));

  const totalIn = reports.reduce((sum, report) => sum + report.totalInSen, 0);
  const totalOut = reports.reduce((sum, report) => sum + report.totalOutSen, 0);
  const awaiting = reports.filter((report) => report.status === "DIHANTAR").length;
  const approved = reports.filter((report) => report.status === "DILULUSKAN").length;

  const exportParams = new URLSearchParams({ bulan: key });
  if (selectedStatus !== "SEMUA") exportParams.set("status", selectedStatus);
  if (masjid) exportParams.set("masjid", masjid);
  const exportHref = `/api/v1/reports/export?${exportParams.toString()}`;

  const hasFilter = selectedStatus !== "SEMUA" || Boolean(masjid);

  return (
    <div className="mobile-pad">
      <PageHeader
        eyebrow="Data induk"
        title="Laporan Konsolidasi"
        description={`Semakan dan kelulusan laporan kewangan bulanan masjid bagi ${bulanTahun(month, year)}.`}
        actions={
          <a href={exportHref} className="btn-secondary" download>
            <Download className="h-4 w-4" /> Eksport CSV
          </a>
        }
      />

      {(params.selesai || params.ralat) && (
        <p
          className={
            params.ralat
              ? "mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15"
              : params.selesai === "tolak"
                ? "mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-600/15"
                : "mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-600/15"
          }
        >
          {params.ralat
            ? params.ralat
            : params.selesai === "tolak"
              ? "Laporan telah ditolak. Nota penyemak akan dipaparkan kepada pihak masjid."
              : "Laporan telah diluluskan dan keputusan direkodkan dalam jejak audit."}
        </p>
      )}

      {user.role === "AUDITOR" && (
        <div className="mb-4 rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
          <p className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Anda log masuk sebagai auditor. Semua laporan boleh dilihat dan dieksport, tetapi
              kelulusan dan penolakan laporan hanya boleh dilakukan oleh pegawai JAINJ.
            </span>
          </p>
        </div>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Laporan dipaparkan"
          value={reports.length}
          hint={bulanTahun(month, year)}
          icon={FileText}
        />
        <Stat
          label="Menunggu semakan"
          value={awaiting}
          hint="Berstatus dihantar"
          icon={ClipboardList}
        />
        <Stat
          label="Diluluskan"
          value={approved}
          hint="Bagi penapis semasa"
          icon={CircleCheck}
        />
        <Stat
          label="Jumlah bersih"
          value={rm(totalIn - totalOut)}
          hint="Hasil tolak perbelanjaan"
          icon={CircleDollarSign}
        />
      </div>

      <Card className="mb-6">
        <CardHeader title="Tapis laporan" description="Pilih bulan, status semakan atau masjid tertentu." />
        <form action="/jainj/laporan" className="flex flex-wrap items-end gap-3 p-5">
          <div>
            <label className="label" htmlFor="bulan">
              Bulan
            </label>
            <input id="bulan" type="month" name="bulan" defaultValue={key} className="input w-auto" />
          </div>
          <div>
            <label className="label" htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={selectedStatus} className="input w-auto">
              <option value="SEMUA">Semua status</option>
              {STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status === "DRAF"
                    ? "Draf"
                    : status === "DIHANTAR"
                      ? "Dihantar"
                      : status === "DILULUSKAN"
                        ? "Diluluskan"
                        : "Ditolak"}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[200px]">
            <label className="label" htmlFor="masjid">
              Masjid
            </label>
            <select id="masjid" name="masjid" defaultValue={masjid} className="input">
              <option value="">Semua masjid</option>
              {mosques.map((mosque) => (
                <option key={mosque.id} value={mosque.id}>
                  {mosque.name}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            Tapis
          </button>
          {hasFilter && (
            <Link href={`/jainj/laporan?bulan=${key}`} className="btn-ghost">
              Set semula
            </Link>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Laporan bulanan masjid"
          description={`${reports.length} laporan bagi ${bulanTahun(month, year)}.`}
          action={
            <a href={exportHref} className="text-xs font-semibold text-brand-700 hover:text-brand-900" download>
              Muat turun CSV
            </a>
          }
        />
        {reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Tiada laporan bagi penapis ini"
            description="Tiada laporan bulanan dihantar bagi bulan, status atau masjid yang dipilih."
            action={
              <Link href={`/jainj/laporan?bulan=${key}`} className="btn-secondary">
                Set semula penapis
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Masjid</th>
                  <th>Tempoh</th>
                  <th className="text-right">Masuk</th>
                  <th className="text-right">Keluar</th>
                  <th className="text-right">Bersih</th>
                  <th>Status</th>
                  <th>Dihantar</th>
                  <th>Disemak</th>
                  <th className="text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => {
                  const canReview = user.role === "JAINJ" && report.status === "DIHANTAR";
                  return (
                    <tr key={report.id}>
                      <td>
                        <Link
                          href={`/jainj/masjid/${report.mosque.id}`}
                          className="font-medium text-brand-950 hover:text-brand-700"
                        >
                          {report.mosque.name}
                        </Link>
                        <p className="text-[10px] text-brand-900/45">
                          {report.mosque.district} · {report.mosque.code}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-xs">
                        {bulanTahun(report.month, report.year)}
                      </td>
                      <td className="whitespace-nowrap text-right text-xs font-medium text-emerald-700">
                        {rm(report.totalInSen)}
                      </td>
                      <td className="whitespace-nowrap text-right text-xs font-medium text-red-600">
                        {rm(report.totalOutSen)}
                      </td>
                      <td className="whitespace-nowrap text-right text-xs font-semibold">
                        {rm(report.totalInSen - report.totalOutSen)}
                      </td>
                      <td>
                        <StatusBadge value={report.status} />
                      </td>
                      <td className="whitespace-nowrap text-xs text-brand-900/60">
                        {report.submittedAt ? tarikh(report.submittedAt) : "—"}
                      </td>
                      <td className="text-xs text-brand-900/60">
                        {report.reviewedAt ? tarikh(report.reviewedAt) : "—"}
                        {report.reviewerName && (
                          <p className="text-[10px] text-brand-900/40">{report.reviewerName}</p>
                        )}
                        {report.notes && (
                          <p className="mt-1 max-w-[220px] whitespace-pre-line rounded bg-sand px-2 py-1 text-[10px] leading-relaxed text-brand-900/55">
                            {report.notes}
                          </p>
                        )}
                      </td>
                      <td className="text-right">
                        {canReview ? (
                          <div className="flex flex-col items-end gap-1.5">
                            <form action={approveReport}>
                              <input type="hidden" name="id" value={report.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-emerald-700 hover:text-emerald-900"
                              >
                                <CircleCheck className="h-3.5 w-3.5" /> Lulus
                              </button>
                            </form>
                            <details className="text-right">
                              <summary className="cursor-pointer list-none whitespace-nowrap text-[11px] font-semibold text-red-600 hover:text-red-700">
                                Tolak
                              </summary>
                              <form action={rejectReport} className="mt-2 min-w-[190px] space-y-1.5 text-left">
                                <input type="hidden" name="id" value={report.id} />
                                <textarea
                                  name="notes"
                                  rows={2}
                                  required
                                  className="input text-xs"
                                  placeholder="Sebab penolakan..."
                                />
                                <button
                                  type="submit"
                                  className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-red-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-red-700"
                                >
                                  <CircleX className="h-3.5 w-3.5" /> Hantar penolakan
                                </button>
                              </form>
                            </details>
                          </div>
                        ) : (
                          <span className="text-[11px] text-brand-900/35">
                            {report.status === "DIHANTAR" ? "Menunggu JAINJ" : "—"}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-sand/70">
                  <td
                    colSpan={2}
                    className="border-t border-brand-900/10 px-3 py-3 text-xs font-semibold text-brand-950"
                  >
                    Jumlah ({reports.length} laporan)
                  </td>
                  <td className="border-t border-brand-900/10 px-3 py-3 text-right text-xs font-semibold text-emerald-700">
                    {rm(totalIn)}
                  </td>
                  <td className="border-t border-brand-900/10 px-3 py-3 text-right text-xs font-semibold text-red-600">
                    {rm(totalOut)}
                  </td>
                  <td className="border-t border-brand-900/10 px-3 py-3 text-right text-xs font-semibold text-brand-950">
                    {rm(totalIn - totalOut)}
                  </td>
                  <td colSpan={4} className="border-t border-brand-900/10 px-3 py-3 text-[11px] text-brand-900/45">
                    Ringkasan bagi penapis semasa
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
