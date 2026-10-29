import type { Metadata } from "next";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  Search,
  SearchX,
  SlidersHorizontal,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, StatusBadge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { prisma } from "@/lib/db";
import { percent } from "@/lib/utils";

export const metadata: Metadata = { title: "Senarai Masjid" };

const STATUS_OPTIONS = ["AKTIF", "PROJEK", "TUTUP"] as const;

export default async function SenaraiMasjidPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; daerah?: string; status?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const district = (params.daerah ?? "").trim();
  const status = STATUS_OPTIONS.includes((params.status ?? "") as (typeof STATUS_OPTIONS)[number])
    ? (params.status as string)
    : "";

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [mosques, districts] = await Promise.all([
    prisma.mosque.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(district ? { district } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q } },
                { code: { contains: q } },
                { district: { contains: q } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        code: true,
        name: true,
        district: true,
        phone: true,
        status: true,
        capacity: true,
        scores: { where: { month, year }, select: { total: true } },
        _count: { select: { officers: true, users: true } },
      },
      orderBy: [{ name: "asc" }],
    }),
    prisma.mosque.findMany({
      distinct: ["district"],
      select: { district: true },
      orderBy: { district: "asc" },
    }),
  ]);

  const filtered = Boolean(q || district || status);

  return (
    <div className="mobile-pad">
      <PageHeader
        eyebrow="Pemantauan"
        title="Senarai Masjid"
        description="Daftar masjid berdaftar JAINJ beserta skor prestasi dan status pematuhan semasa."
        actions={
          <Link href="/jainj/skor" className="btn-secondary">
            <Building2 className="h-4 w-4" /> Skor prestasi
          </Link>
        }
      />

      <Card className="mb-6">
        <CardHeader
          title="Tapis senarai"
          description="Cari mengikut nama, kod masjid atau daerah."
        />
        <form action="/jainj/masjid" className="flex flex-wrap items-end gap-3 p-5">
          <div className="min-w-[200px] flex-1">
            <label className="label" htmlFor="q">
              Carian
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-900/35" />
              <input
                id="q"
                name="q"
                defaultValue={q}
                className="input pl-9"
                placeholder="Nama atau kod masjid"
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="daerah">
              Daerah
            </label>
            <select id="daerah" name="daerah" defaultValue={district} className="input w-auto">
              <option value="">Semua daerah</option>
              {districts.map((item) => (
                <option key={item.district} value={item.district}>
                  {item.district}
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
              {STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {value === "AKTIF" ? "Aktif" : value === "PROJEK" ? "Dalam projek" : "Ditutup"}
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="btn-primary">
            <SlidersHorizontal className="h-4 w-4" /> Tapis
          </button>
          {filtered && (
            <Link href="/jainj/masjid" className="btn-ghost">
              Set semula
            </Link>
          )}
        </form>
      </Card>

      <Card>
        <CardHeader
          title="Masjid berdaftar"
          description={`${mosques.length} masjid dipaparkan bagi penapis semasa.`}
        />
        {mosques.length === 0 ? (
          <EmptyState
            icon={SearchX}
            title="Tiada masjid ditemui"
            description="Laraskan carian atau penapis daerah dan status untuk melihat rekod lain."
            action={
              <Link href="/jainj/masjid" className="btn-secondary">
                Set semula penapis
              </Link>
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Masjid</th>
                  <th>Daerah</th>
                  <th className="text-center">Pegawai</th>
                  <th className="text-center">Skor bulan ini</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {mosques.map((mosque) => {
                  const score = mosque.scores[0]?.total ?? null;
                  const officerCoverage = percent(mosque._count.officers, 5);
                  return (
                    <tr key={mosque.id}>
                      <td className="whitespace-nowrap font-mono text-[11px] text-brand-900/60">
                        {mosque.code}
                      </td>
                      <td>
                        <Link
                          href={`/jainj/masjid/${mosque.id}`}
                          className="font-medium text-brand-950 hover:text-brand-700"
                        >
                          {mosque.name}
                        </Link>
                        <p className="text-[11px] text-brand-900/45">
                          {mosque.phone ?? "Tiada telefon"} · kapasiti {mosque.capacity ?? "—"}
                        </p>
                      </td>
                      <td className="whitespace-nowrap text-xs">{mosque.district}</td>
                      <td className="text-center">
                        <span className="inline-flex items-center gap-1 text-xs font-medium">
                          <Users className="h-3.5 w-3.5 text-brand-900/35" />
                          {mosque._count.officers}
                        </span>
                        <p className="text-[10px] text-brand-900/40">{mosque._count.users} akaun portal</p>
                      </td>
                      <td>
                        <div className="mx-auto w-24">
                          <p className="text-center text-xs font-semibold">
                            {score === null ? "—" : `${score}/100`}
                          </p>
                          <Progress
                            value={score ?? 0}
                            tone={score === null ? "brand" : score >= 80 ? "brand" : score >= 70 ? "gold" : "danger"}
                            className="mt-1 h-1.5"
                          />
                        </div>
                      </td>
                      <td>
                        <StatusBadge value={mosque.status} />
                        <p className="mt-1 text-[10px] text-brand-900/40">
                          Liputan AJK {officerCoverage}%
                        </p>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/jainj/masjid/${mosque.id}`}
                          className="inline-flex items-center gap-1 whitespace-nowrap text-[11px] font-semibold text-brand-700 hover:text-brand-900"
                        >
                          Butiran <ChevronRight className="h-3.5 w-3.5" />
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
  );
}
