import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Download,
  Filter,
  Plus,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat, StatusBadge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { canManageFinance } from "@/lib/roles";
import { label } from "@/lib/labels";
import { bulanTahun, rm, tarikh } from "@/lib/utils";
import { recordEntry } from "./actions";

export const metadata: Metadata = { title: "Lejar & Resit" };

const pad = (n: number) => String(n).padStart(2, "0");

export default async function KewanganPage({
  searchParams,
}: {
  searchParams: Promise<{ bulan?: string; jenis?: string; ralat?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const params = await searchParams;

  const now = new Date();
  const defaultBulan = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
  const bulan = params.bulan && /^\d{4}-(0[1-9]|1[0-2])$/.test(params.bulan) ? params.bulan : defaultBulan;
  const [year, month] = bulan.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const jenis = params.jenis === "MASUK" || params.jenis === "KELUAR" ? params.jenis : undefined;

  const [accounts, grouped, entries, receipts] = await Promise.all([
    prisma.ledgerAccount.findMany({
      where: { mosqueId: mosque.id, type: { in: ["HASIL", "PERBELANJAAN"] } },
      orderBy: { code: "asc" },
    }),
    prisma.ledgerEntry.groupBy({
      by: ["type"],
      where: { mosqueId: mosque.id, status: "POSTED", date: { gte: start, lt: end } },
      _sum: { amountSen: true },
      _count: { _all: true },
    }),
    prisma.ledgerEntry.findMany({
      where: {
        mosqueId: mosque.id,
        date: { gte: start, lt: end },
        ...(jenis ? { type: jenis } : {}),
      },
      include: { account: { select: { name: true, code: true } } },
      orderBy: { date: "desc" },
    }),
    prisma.receipt.findMany({
      where: { mosqueId: mosque.id },
      orderBy: { issuedAt: "desc" },
      take: 8,
    }),
  ]);

  const totalIn = grouped.find((g) => g.type === "MASUK")?._sum.amountSen ?? 0;
  const totalOut = grouped.find((g) => g.type === "KELUAR")?._sum.amountSen ?? 0;
  const count = grouped.reduce((sum, g) => sum + g._count._all, 0);
  const incomeAccounts = accounts.filter((a) => a.type === "HASIL");
  const expenseAccounts = accounts.filter((a) => a.type === "PERBELANJAAN");
  const canRecord = canManageFinance(user.role);

  return (
    <div>
      <PageHeader
        eyebrow="Kewangan"
        title="Lejar & Resit"
        description="Rekod transaksi masuk dan keluar, pantau baki dan jana resit rasmi masjid."
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}

      <form method="get" action="/portal/kewangan" className="card mb-5 flex flex-wrap items-end gap-3 p-4">
        <div>
          <label className="label" htmlFor="bulan">Bulan</label>
          <input id="bulan" name="bulan" type="month" defaultValue={bulan} className="input w-auto" />
        </div>
        <div>
          <label className="label" htmlFor="jenis">Jenis</label>
          <select id="jenis" name="jenis" defaultValue={jenis ?? ""} className="input w-auto">
            <option value="">Semua</option>
            <option value="MASUK">Masuk</option>
            <option value="KELUAR">Keluar</option>
          </select>
        </div>
        <button type="submit" className="btn-secondary">
          <Filter className="h-4 w-4" /> Tapis
        </button>
        {(params.bulan || params.jenis) && (
          <Link href="/portal/kewangan" className="text-xs font-medium text-brand-900/50 hover:text-brand-900">
            Set semula
          </Link>
        )}
        <span className="ml-auto text-xs text-brand-900/50">
          Paparan: <span className="font-semibold text-brand-900/75">{bulanTahun(month, year)}</span>
        </span>
      </form>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Jumlah masuk" value={rm(totalIn)} hint={bulanTahun(month, year)} icon={ArrowDownLeft} />
        <Stat label="Jumlah keluar" value={rm(totalOut)} hint={bulanTahun(month, year)} icon={ArrowUpRight} />
        <Stat label="Baki bersih" value={rm(totalIn - totalOut)} hint="Masuk tolak keluar" icon={Wallet} />
        <Stat label="Bilangan transaksi" value={count} hint="Rekod diposkan" icon={ReceiptText} />
      </div>

      {canRecord ? (
        <Card className="mt-6">
          <CardHeader
            title="Rekod transaksi"
            description="Simpan transaksi baharu ke dalam lejar masjid. Medan bertanda * wajib diisi."
          />
          <form action={recordEntry} className="grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-3">
            <input type="hidden" name="bulan" value={bulan} />
            <div>
              <label className="label" htmlFor="entryDate">Tarikh *</label>
              <input
                id="entryDate"
                name="date"
                type="date"
                required
                defaultValue={`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`}
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="entryType">Jenis *</label>
              <select id="entryType" name="type" className="input" defaultValue="MASUK">
                <option value="MASUK">Masuk (hasil)</option>
                <option value="KELUAR">Keluar (perbelanjaan)</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="entryCategory">Kategori *</label>
              <input
                id="entryCategory"
                name="category"
                required
                list="kategori-transaksi"
                placeholder="Derma, Utiliti…"
                className="input"
              />
              <datalist id="kategori-transaksi">
                <option value="Derma" />
                <option value="Infaq" />
                <option value="Sumbangan" />
                <option value="Utiliti" />
                <option value="Selenggaraan" />
                <option value="Operasi" />
                <option value="Program" />
              </datalist>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="entryDescription">Keterangan *</label>
              <input
                id="entryDescription"
                name="description"
                required
                placeholder="Contoh: Derma Jumaat minggu pertama"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="entryAmount">Jumlah (RM) *</label>
              <input
                id="entryAmount"
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0.00"
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="entryAccount">Akaun lejar *</label>
              <select id="entryAccount" name="accountId" required defaultValue="" className="input">
                <option value="" disabled>Pilih akaun mengikut jenis transaksi…</option>
                <optgroup label="Akaun hasil (transaksi masuk)">
                  {incomeAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Akaun perbelanjaan (transaksi keluar)">
                  {expenseAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.code} — {account.name}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="mt-1 text-[11px] text-brand-900/45">
                Akaun dipilih mengikut jenis: hasil untuk transaksi masuk, perbelanjaan untuk transaksi keluar.
              </p>
            </div>
            <div>
              <label className="label" htmlFor="entryMethod">Kaedah bayaran</label>
              <select id="entryMethod" name="method" className="input" defaultValue="TUNAI">
                <option value="TUNAI">Tunai</option>
                <option value="BANK">Bank</option>
                <option value="QR">DuitNow QR</option>
                <option value="FPX">FPX</option>
                <option value="KAD">Kad</option>
              </select>
            </div>
            <div>
              <label className="label" htmlFor="payerName">Nama pembayar</label>
              <input id="payerName" name="payerName" placeholder="Untuk resit" className="input" />
            </div>
            <div>
              <label className="label" htmlFor="payerEmail">E-mel pembayar (pilihan)</label>
              <input id="payerEmail" name="payerEmail" type="email" placeholder="nama@contoh.my" className="input" />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-xs font-medium text-brand-900/70">
                <input
                  type="checkbox"
                  name="receipt"
                  className="h-4 w-4 rounded border-brand-900/20 text-brand-700 focus:ring-brand-600"
                />
                Jana resit untuk transaksi masuk
              </label>
            </div>
            <div className="flex items-end justify-end sm:col-span-2 lg:col-span-3">
              <button type="submit" className="btn-primary">
                <Plus className="h-4 w-4" /> Simpan transaksi
              </button>
            </div>
          </form>
        </Card>
      ) : (
        <p className="mt-6 rounded-lg bg-sky-50 px-3 py-2 text-xs font-medium text-sky-800 ring-1 ring-inset ring-sky-600/15">
          Anda boleh melihat rekod kewangan sahaja. Hanya Bendahari dan Pengerusi boleh merekod transaksi.
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Transaksi"
            description={`${bulanTahun(month, year)}${jenis ? ` · ${label(jenis)}` : ""} · ${entries.length} rekod`}
          />
          {entries.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Tiada transaksi bagi tapisan ini"
              description={
                canRecord
                  ? "Rekod transaksi baharu menggunakan borang di atas."
                  : "Cuba pilih bulan atau jenis transaksi yang lain."
              }
            />
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tarikh</th>
                    <th>Keterangan</th>
                    <th>Kategori</th>
                    <th>Kaedah</th>
                    <th>Jenis</th>
                    <th className="text-right">Jumlah</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <td className="whitespace-nowrap text-xs text-brand-900/60">{tarikh(entry.date)}</td>
                      <td>
                        <p className="font-medium text-brand-950">{entry.description}</p>
                        <p className="text-[11px] text-brand-900/45">
                          {entry.account.code} · {entry.account.name}
                        </p>
                      </td>
                      <td className="text-xs">{entry.category}</td>
                      <td className="whitespace-nowrap text-xs">{entry.method ? label(entry.method) : "—"}</td>
                      <td>
                        <StatusBadge value={entry.type} />
                      </td>
                      <td
                        className={
                          entry.type === "MASUK"
                            ? "whitespace-nowrap text-right font-semibold text-emerald-700"
                            : "whitespace-nowrap text-right font-semibold text-red-600"
                        }
                      >
                        {entry.type === "MASUK" ? "+" : "−"}
                        {rm(entry.amountSen)}
                      </td>
                      <td>
                        <StatusBadge value={entry.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="self-start">
          <CardHeader title="Resit terkini" description="Lapan resit rasmi terbaharu." />
          {receipts.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="Belum ada resit"
              description="Resit akan muncul di sini selepas transaksi masuk direkod dengan pilihan jana resit."
            />
          ) : (
            <ul className="divide-y divide-brand-900/5">
              {receipts.map((receipt) => (
                <li key={receipt.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-700/10">
                    <ReceiptText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-brand-950">{receipt.number}</p>
                    <p className="truncate text-[11px] text-brand-900/50">
                      {receipt.issuedTo} · {tarikh(receipt.issuedAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="whitespace-nowrap text-xs font-semibold text-brand-950">{rm(receipt.amountSen)}</p>
                    <Link
                      href={`/api/receipts/${receipt.id}`}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                    >
                      <Download className="h-3 w-3" /> Muat turun
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
