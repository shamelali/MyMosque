import type { Metadata } from "next";
import Link from "next/link";
import { Download, Files, FolderOpen, Plus, ReceiptText } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { PORTAL_ROLES, type Role } from "@/lib/roles";
import { tarikh } from "@/lib/utils";
import { createLetter, uploadDocument } from "./actions";

export const metadata: Metadata = { title: "Dokumen" };

const MANAGER_ROLES: Role[] = ["SETIAUSAHA", "BENDAHARI", "KETUA"];

function saizFail(bytes: number) {
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default async function DokumenPage({
  searchParams,
}: {
  searchParams: Promise<{ selesai?: string; ralat?: string }>;
}) {
  const user = await requirePageUser(PORTAL_ROLES);
  const mosque = await currentMosque();
  const params = await searchParams;
  const canManage = MANAGER_ROLES.includes(user.role);

  const [documents, documentCount, receiptCount, receiptPdfCount, documentKeys, receiptKeys] =
    await Promise.all([
      prisma.document.findMany({
        where: { mosqueId: mosque.id },
        include: { mosque: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
      prisma.document.count({ where: { mosqueId: mosque.id } }),
      prisma.receipt.count({ where: { mosqueId: mosque.id } }),
      prisma.receipt.count({ where: { mosqueId: mosque.id, storageKey: { not: null } } }),
      prisma.document.findMany({ where: { mosqueId: mosque.id }, select: { storageKey: true } }),
      prisma.receipt.findMany({
        where: { mosqueId: mosque.id, storageKey: { not: null } },
        select: { storageKey: true },
      }),
    ]);

  // StoredFile tiada mosqueId; gabungkan kunci dokumen dan resit masjid ini
  // (dengan deduplikasi) sebelum menjumlahkan saiz.
  const storageKeySet = new Set<string>([
    ...documentKeys.map((row) => row.storageKey),
    ...receiptKeys.flatMap((row) => (row.storageKey ? [row.storageKey] : [])),
  ]);

  const storage = await prisma.storedFile.aggregate({
    where: { key: { in: [...storageKeySet] } },
    _sum: { size: true },
  });
  const storageBytes = storage._sum.size ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Platform"
        title="Dokumen"
        description="Jana surat, minit dan laporan rasmi masjid, serta muat turun dokumen dan resit yang tersimpan."
        actions={<Badge tone="info">{documentCount} dokumen</Badge>}
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}
      {params.selesai === "surat" && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          Dokumen berjaya dijana dan disimpan dalam storan dokumen masjid.
        </p>
      )}
      {params.selesai === "muatnaik" && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          Fail berjaya dimuat naik dan disimpan dalam storan dokumen masjid.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Dokumen" value={documentCount} hint="Surat, minit, laporan dan resit" icon={Files} />
        <Stat
          label="Resit dijana"
          value={receiptCount}
          hint={`${receiptPdfCount} resit mempunyai fail PDF`}
          icon={ReceiptText}
        />
        <Stat label="Saiz storan" value={saizFail(storageBytes)} hint="Jumlah fail dokumen masjid" icon={FolderOpen} />
      </div>

      {canManage && (
        <Card className="mt-6">
          <CardHeader
            title="Muat naik fail"
            description="Muat naik PDF, gambar atau fail dokumen lain untuk disimpan dalam storan masjid."
          />
          <form action={uploadDocument} className="grid gap-4 p-5">
            <div>
              <label className="label" htmlFor="uploadTitle">Tajuk *</label>
              <input
                id="uploadTitle"
                name="title"
                required
                maxLength={160}
                placeholder="Contoh: Surat Akuan Terima Sumbangan"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="uploadType">Jenis *</label>
              <select id="uploadType" name="type" defaultValue="SURAT" className="input">
                <option value="SURAT">Surat</option>
                <option value="MINIT">Minit mesyuarat</option>
                <option value="LAPORAN">Laporan</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="uploadFile">Fail *</label>
              <input
                id="uploadFile"
                name="file"
                type="file"
                required
                accept=".pdf,.png,.jpg,.jpeg,.webp"
                className="input"
              />
            </div>
            <div className="flex justify-end">
              <button type="submit" className="btn-primary">
                <Plus className="h-4 w-4" /> Muat naik fail
              </button>
            </div>
          </form>
        </Card>
      )}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.75fr)]">
        <Card className="self-start">
          <CardHeader
            title="Jana surat"
            description="Dokumen PDF dijana mengikut maklumat masjid dan disimpan secara automatik."
          />
          {canManage ? (
            <form action={createLetter} className="grid gap-4 p-5">
              <div>
                <label className="label" htmlFor="documentTitle">
                  Tajuk *
                </label>
                <input
                  id="documentTitle"
                  name="title"
                  required
                  maxLength={160}
                  placeholder="Contoh: Surat Jemputan Mesyuarat AJK"
                  className="input"
                />
              </div>
              <div>
                <label className="label" htmlFor="documentType">
                  Jenis *
                </label>
                <select id="documentType" name="type" defaultValue="SURAT" className="input">
                  <option value="SURAT">Surat</option>
                  <option value="MINIT">Minit mesyuarat</option>
                  <option value="LAPORAN">Laporan</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="documentBody">
                  Kandungan *
                </label>
                <textarea
                  id="documentBody"
                  name="body"
                  rows={10}
                  required
                  maxLength={20000}
                  placeholder="Tulis kandungan dokumen dalam Bahasa Melayu…"
                  className="input"
                />
              </div>
              <div className="flex justify-end">
                <button type="submit" className="btn-primary">
                  <Plus className="h-4 w-4" /> Jana dokumen
                </button>
              </div>
            </form>
          ) : (
            <p className="p-5 text-xs leading-relaxed text-brand-900/55">
              Anda boleh melihat dan memuat turun dokumen sahaja. Hanya Bendahari, Pengerusi dan
              Setiausaha boleh menjana dokumen baharu.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Storan dokumen"
            description={`${documents.length} daripada ${documentCount} dokumen dipaparkan (terbaharu dahulu).`}
          />
          {documents.length === 0 ? (
            <EmptyState
              icon={FolderOpen}
              title="Belum ada dokumen"
              description="Jana surat, minit atau laporan menggunakan borang di sebelah. Resit yang dijana semasa transaksi juga akan muncul di sini."
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Jenis</th>
                    <th>Tajuk</th>
                    <th>Masjid</th>
                    <th>Dicipta</th>
                    <th>Storan</th>
                    <th>Tindakan</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((document) => {
                    const receiptHref =
                      document.type === "RESIT" && document.refId
                        ? `/api/receipts/${document.refId}`
                        : `/api/documents/${document.id}`;
                    const isReceiptLink = document.type === "RESIT" && Boolean(document.refId);
                    return (
                      <tr key={document.id}>
                        <td>
                          <StatusBadge value={document.type} />
                        </td>
                        <td className="max-w-[220px]">
                          <p className="truncate text-xs font-medium text-brand-950" title={document.title}>
                            {document.title}
                          </p>
                        </td>
                        <td className="text-xs text-brand-900/65">{document.mosque?.name ?? "—"}</td>
                        <td className="whitespace-nowrap text-xs text-brand-900/60">
                          {tarikh(document.createdAt)}
                        </td>
                        <td>
                          {document.type === "RESIT" ? (
                            <span
                              className="block max-w-[150px] truncate font-mono text-[10px] text-brand-900/45"
                              title={document.refId ?? undefined}
                            >
                              {document.refId ?? "Tanpa rujukan resit"}
                            </span>
                          ) : (
                            <span
                              className="block max-w-[180px] truncate font-mono text-[10px] text-brand-900/45"
                              title={document.storageKey}
                            >
                              {document.storageKey}
                            </span>
                          )}
                        </td>
                        <td>
                          <Link
                            href={receiptHref}
                            className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                          >
                            <Download className="h-3.5 w-3.5" />
                            {isReceiptLink ? "Resit PDF" : "Muat turun"}
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
