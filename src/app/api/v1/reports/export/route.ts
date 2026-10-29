import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { handleApiError, requireApiUser } from "@/lib/api";

export const runtime = "nodejs";

const STATUSES = ["DRAF", "DIHANTAR", "DILULUSKAN", "DITOLAK"];

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function ringgit(sen: number) {
  return (sen / 100).toFixed(2);
}

export async function GET(request: Request) {
  try {
    const user = await requireApiUser(["JAINJ", "AUDITOR"]);
    const url = new URL(request.url);

    const bulan = url.searchParams.get("bulan") ?? "";
    const period = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(bulan);
    const status = url.searchParams.get("status") ?? "";
    const masjid = url.searchParams.get("masjid") ?? "";

    const where: { year?: number; month?: number; status?: string; mosqueId?: string } = {};
    if (period) {
      where.year = Number(period[1]);
      where.month = Number(period[2]);
    }
    if (STATUSES.includes(status)) where.status = status;
    if (masjid) where.mosqueId = masjid;

    const reports = await prisma.monthlyReport.findMany({
      where,
      include: { mosque: { select: { name: true } } },
      orderBy: [{ year: "desc" }, { month: "desc" }],
    });

    const lines = [
      ["mosque", "period", "totalIn", "totalOut", "status"].join(","),
      ...reports.map((report) =>
        [
          csvCell(report.mosque.name),
          csvCell(`${report.year}-${String(report.month).padStart(2, "0")}`),
          ringgit(report.totalInSen),
          ringgit(report.totalOutSen),
          csvCell(report.status),
        ].join(","),
      ),
    ];
    const csv = `${lines.join("\r\n")}\r\n`;

    await audit({
      actor: user,
      action: "EXPORT",
      entity: "MonthlyReport",
      after: {
        format: "CSV",
        filters: {
          bulan: period ? `${period[1]}-${period[2]}` : null,
          status: where.status ?? null,
          masjid: masjid || null,
        },
        count: reports.length,
      },
    });

    const filename = period
      ? `laporan-bulanan-${period[1]}-${period[2]}.csv`
      : "laporan-bulanan-semua.csv";

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
