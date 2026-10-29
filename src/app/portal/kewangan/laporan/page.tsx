import type { Metadata } from "next";
import { CalendarDays, FileText, Info, Send } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatusBadge } from "@/components/ui/card";
import { EmptyState, SectionTitle } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { canManageFinance } from "@/lib/roles";
import { bulanTahun, rm, tarikh } from "@/lib/utils";
import { generateReport, submitReport } from "./actions";

export const metadata: Metadata = { title: "Laporan Bulanan" };

const MONTHS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

export default async function LaporanPage({
  searchParams,
}: {
  searchParams: Promise<{ ralat?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const { ralat } = await searchParams;

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const reports = await prisma.monthlyReport.findMany({
    where: { mosqueId: mosque.id },
    orderBy: [{ year: "desc" }, { month: "desc" }],
  });

  const canManage = canManageFinance(user.role);
  const notes = reports.filter((report) => report.notes || report.reviewerName);

  return (
    <div>
      <PageHeader
        eyebrow="Kewangan"
        title="Laporan Bulanan"
        description="Jana laporan kewangan bulanan daripada lejar dan hantar kepada JAINJ untuk semakan."
        back={{ href: "/portal/kewangan", label: "Kembali ke Lejar & Resit" }}
      />

      {ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {ralat}
        </p>
      )}

      <div className="mb-6 rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Laporan yang dihantar akan disemak dan diluluskan oleh pegawai JAINJ melalui Konsol JAINJ.
            Sebarang nota penyemak akan dipaparkan di halaman ini.
          </span>
        </p>
      </div>

      {canManage ? (
        <Card className="mb-6">
          <CardHeader
            title="Jana laporan"
            description="Jumlah diambil terus daripada transaksi lejar yang diposkan bagi bulan dipilih."
          />
          <form action={generateReport} className="flex flex-wrap items-end gap-3 p-5">
            <div>
              <label className="label" htmlFor="reportMonth">Bulan</label>
              <select id="reportMonth" name="month" defaultValue={currentMonth} className="input w-auto">
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="reportYear">Tahun</label>
              <select id="reportYear" name="year" defaultValue={currentYear} className="input w-auto">
                {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-primary">
              <FileText className="h-4 w-4" /> Jana / kemas kini draf
            </button>
            <p className="w-full text-[11px] text-brand-900/45">
              Laporan sedia ada yang masih berstatus draf akan dikemas kini dengan jumlah terkini. Laporan
              yang telah dihantar atau diluluskan tidak boleh dijana semula.
            </p>
          </form>
        </Card>
      ) : (
        <p className="mb-6 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-600/15">
          Anda boleh melihat laporan sahaja. Penjanaan dan penghantaran laporan adalah tugas Bendahari atau Pengerusi.
        </p>
      )}

      <Card>
        <CardHeader title="Senarai laporan" description={`${reports.length} laporan bagi ${mosque.name}.`} />
        {reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Belum ada laporan bulanan"
            description={
              canManage
                ? "Jana laporan pertama menggunakan borang di atas."
                : "Laporan akan dipaparkan di sini selepas dijana oleh Bendahari."
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bulan</th>
                  <th className="text-right">Masuk</th>
                  <th className="text-right">Keluar</th>
                  <th className="text-right">Bersih</th>
                  <th>Status</th>
                  <th>Dihantar</th>
                  <th>Disemak</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {reports.map((report) => (
                  <tr key={report.id}>
                    <td className="whitespace-nowrap font-medium text-brand-950">
                      {bulanTahun(report.month, report.year)}
                    </td>
                    <td className="whitespace-nowrap text-right text-xs font-medium text-emerald-700">
                      {rm(report.totalInSen)}
                    </td>
                    <td className="whitespace-nowrap text-right text-xs font-medium text-red-600">
                      {rm(report.totalOutSen)}
                    </td>
                    <td className="whitespace-nowrap text-right text-xs font-semibold text-brand-950">
                      {rm(report.totalInSen - report.totalOutSen)}
                    </td>
                    <td>
                      <StatusBadge value={report.status} />
                    </td>
                    <td className="whitespace-nowrap text-xs text-brand-900/60">{tarikh(report.submittedAt)}</td>
                    <td className="whitespace-nowrap text-xs text-brand-900/60">
                      {report.reviewedAt ? tarikh(report.reviewedAt) : "—"}
                      {report.reviewerName && (
                        <span className="block text-[10px] text-brand-900/40">{report.reviewerName}</span>
                      )}
                    </td>
                    <td className="text-right">
                      {canManage && report.status === "DRAF" ? (
                        <form action={submitReport}>
                          <input type="hidden" name="id" value={report.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                          >
                            <Send className="h-3 w-3" /> Hantar untuk semakan
                          </button>
                        </form>
                      ) : (
                        <span className="text-[11px] text-brand-900/30">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="mt-6">
        <SectionTitle>Nota penyemak</SectionTitle>
        <Card>
          {notes.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Tiada nota penyemak"
              description="Nota daripada JAINJ akan dipaparkan di sini selepas laporan disemak."
            />
          ) : (
            <ul className="divide-y divide-brand-900/5">
              {notes.map((report) => (
                <li key={report.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-brand-950">
                      {bulanTahun(report.month, report.year)}
                    </p>
                    <StatusBadge value={report.status} />
                  </div>
                  {report.reviewerName && (
                    <p className="mt-1 text-[11px] text-brand-900/45">Penyemak: {report.reviewerName}</p>
                  )}
                  {report.notes && (
                    <p className="mt-2 whitespace-pre-line rounded-lg bg-sand px-3 py-2 text-xs leading-relaxed text-brand-900/75">
                      {report.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
