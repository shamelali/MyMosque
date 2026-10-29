import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import {
  BadgeCheck,
  ChevronRight,
  CircleAlert,
  FileWarning,
  Gauge,
  Info,
  Megaphone,
  Moon,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
  Wrench,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Stat } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty";
import { buildAlerts, type AlertCategory, type MonitoringAlert } from "./alerts";

export const metadata: Metadata = { title: "Amaran & Risiko" };

const CATEGORY_ICON: Record<AlertCategory, ComponentType<{ className?: string }>> = {
  LAPORAN: FileWarning,
  SKOR: Gauge,
  SELENGGARAAN: Wrench,
  TAULIAH: BadgeCheck,
  QURBAN: Moon,
  KEMPEN: Megaphone,
};

const CATEGORY_LABEL: Record<AlertCategory, string> = {
  LAPORAN: "Laporan bulanan",
  SKOR: "Skor prestasi",
  SELENGGARAAN: "Selenggaraan",
  TAULIAH: "Tauliah",
  QURBAN: "Qurban",
  KEMPEN: "Kempen derma",
};

const SEVERITY_GROUPS = [
  {
    key: "TINGGI",
    title: "Keutamaan tinggi",
    description: "Perlu tindakan segera pihak masjid atau JAINJ.",
    tone: "danger",
  },
  {
    key: "SEDERHANA",
    title: "Keutamaan sederhana",
    description: "Pantau dan ambil tindakan dalam tempoh terdekat.",
    tone: "warning",
  },
  {
    key: "RENDAH",
    title: "Keutamaan rendah",
    description: "Perlu pemantauan berkala dan pengemaskinian rekod.",
    tone: "info",
  },
] as const;

function severityStyle(severity: MonitoringAlert["severity"]) {
  if (severity === "TINGGI") {
    return "bg-red-50 text-red-600 ring-red-600/15";
  }
  if (severity === "SEDERHANA") {
    return "bg-amber-50 text-amber-700 ring-amber-600/15";
  }
  return "bg-sky-50 text-sky-700 ring-sky-600/15";
}

export default async function AmaranPage() {
  const alerts = await buildAlerts();
  const counts = {
    TINGGI: alerts.filter((alert) => alert.severity === "TINGGI").length,
    SEDERHANA: alerts.filter((alert) => alert.severity === "SEDERHANA").length,
    RENDAH: alerts.filter((alert) => alert.severity === "RENDAH").length,
  };

  return (
    <div className="mobile-pad">
      <PageHeader
        eyebrow="Pemantauan"
        title="Amaran & Risiko"
        description="Amaran pematuhan dijana secara automatik daripada data laporan, skor, selenggaraan, tauliah dan qurban."
      />

      <div className="mb-6 rounded-xl bg-sky-50 px-4 py-3 text-xs leading-relaxed text-sky-800 ring-1 ring-inset ring-sky-600/15">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Halaman ini adalah paparan baca sahaja. Amaran dikira semula setiap kali halaman dibuka dan
            tiada perubahan data dilakukan. Sila gunakan pautan pada setiap amaran untuk menyemak rekod
            berkaitan.
          </span>
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Jumlah amaran"
          value={alerts.length}
          hint="Merentas semua kategori pematuhan"
          icon={CircleAlert}
        />
        <Stat
          label="Keutamaan tinggi"
          value={counts.TINGGI}
          hint="Memerlukan tindakan segera"
          icon={ShieldAlert}
        />
        <Stat
          label="Keutamaan sederhana"
          value={counts.SEDERHANA}
          hint="Pantau dalam tempoh terdekat"
          icon={TriangleAlert}
        />
        <Stat
          label="Keutamaan rendah"
          value={counts.RENDAH}
          hint="Pemantauan berkala"
          icon={ShieldCheck}
        />
      </div>

      {alerts.length === 0 ? (
        <Card className="mt-6">
          <EmptyState
            icon={ShieldCheck}
            title="Tiada amaran aktif"
            description="Semua masjid mematuhi kriteria laporan, skor, selenggaraan, tauliah dan qurban pada masa ini."
          />
        </Card>
      ) : (
        <div className="mt-6 space-y-6">
          {SEVERITY_GROUPS.map((group) => {
            const groupAlerts = alerts.filter((alert) => alert.severity === group.key);
            return (
              <Card key={group.key}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {group.title}
                      <span className="rounded-full bg-brand-900/5 px-2 py-0.5 text-[10px] font-semibold text-brand-900/60">
                        {groupAlerts.length}
                      </span>
                    </span>
                  }
                  description={group.description}
                  action={<Badge tone={group.tone}>{groupAlerts.length} amaran</Badge>}
                />
                {groupAlerts.length === 0 ? (
                  <EmptyState
                    icon={ShieldCheck}
                    title="Tiada amaran pada tahap ini"
                    description="Tiada isu dikesan bagi kategori keutamaan ini."
                    className="py-8"
                  />
                ) : (
                  <ul className="divide-y divide-brand-900/5">
                    {groupAlerts.map((alert) => {
                      const Icon = CATEGORY_ICON[alert.category];
                      return (
                        <li key={alert.id}>
                          <Link
                            href={alert.href}
                            className="group flex items-start gap-3 px-5 py-4 transition hover:bg-brand-50/50"
                          >
                            <span
                              className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${severityStyle(alert.severity)}`}
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex flex-wrap items-center gap-2">
                                <span className="text-sm font-semibold text-brand-950">{alert.title}</span>
                                <Badge tone={group.tone}>
                                  {group.key === "TINGGI"
                                    ? "Tinggi"
                                    : group.key === "SEDERHANA"
                                      ? "Sederhana"
                                      : "Rendah"}
                                </Badge>
                              </span>
                              <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-brand-900/45">
                                <span>{CATEGORY_LABEL[alert.category]}</span>
                                {alert.mosqueName && (
                                  <>
                                    <span>·</span>
                                    <span>{alert.mosqueName}</span>
                                  </>
                                )}
                              </span>
                              <span className="mt-1 block text-xs leading-relaxed text-brand-900/65">
                                {alert.description}
                              </span>
                            </span>
                            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-brand-900/25 transition group-hover:text-brand-700" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <div className="mt-6 rounded-xl bg-sand px-4 py-3 text-[11px] leading-relaxed text-brand-900/55 ring-1 ring-inset ring-brand-900/5">
        Kriteria amaran: laporan bulanan belum dihantar atau masih draf; skor terkini bawah 70; aduan
        selenggaraan terbuka melebihi 14 hari; tauliah tamat atau hampir tamat dalam 60 hari; kebenaran
        qurban tahun semasa belum diluluskan; dan kempen derma melepasi tarikh tamat.
      </div>
    </div>
  );
}
