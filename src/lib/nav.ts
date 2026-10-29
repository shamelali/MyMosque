import type { Role } from "@/lib/roles";

export type IconName =
  | "dashboard" | "registry" | "finance" | "report" | "maintenance" | "projects"
  | "kuliah" | "donations" | "qurban" | "quran" | "bell" | "documents" | "audit"
  | "integrations" | "mosques" | "score" | "alerts" | "tauliah" | "calendar"
  | "bookings" | "payout" | "profile" | "home" | "users" | "server" | "shield"
  | "smartphone";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  roles?: Role[];
  exact?: boolean;
};

export type NavSection = { title?: string; items: NavItem[] };

export const PORTAL_NAV: NavSection[] = [
  {
    items: [{ href: "/portal", label: "Papan Pemuka", icon: "dashboard", exact: true }],
  },
  {
    title: "Tadbir Urus",
    items: [
      { href: "/portal/daftar", label: "Daftar Masjid & AJK", icon: "registry" },
      { href: "/portal/kuliah", label: "Kuliah & Program", icon: "kuliah" },
    ],
  },
  {
    title: "Kewangan",
    items: [
      { href: "/portal/kewangan", label: "Lejar & Resit", icon: "finance" },
      { href: "/portal/kewangan/laporan", label: "Laporan Bulanan", icon: "report" },
    ],
  },
  {
    title: "Operasi",
    items: [
      { href: "/portal/selenggaraan", label: "Selenggaraan", icon: "maintenance" },
      { href: "/portal/projek", label: "Projek Renovasi", icon: "projects" },
    ],
  },
  {
    title: "Hasil & Komuniti",
    items: [
      { href: "/portal/derma", label: "Derma", icon: "donations" },
      { href: "/portal/qurban", label: "Qurban", icon: "qurban" },
      { href: "/portal/quran", label: "Tempahan Al-Quran", icon: "quran" },
    ],
  },
  {
    title: "Platform",
    items: [
      { href: "/portal/pemberitahuan", label: "Pemberitahuan", icon: "bell" },
      { href: "/portal/dokumen", label: "Dokumen", icon: "documents" },
      { href: "/portal/audit", label: "Jejak Audit", icon: "audit" },
      { href: "/portal/tetapan", label: "Integrasi & Tetapan", icon: "integrations" },
    ],
  },
];

export const JAINJ_NAV: NavSection[] = [
  {
    items: [{ href: "/jainj", label: "Papan Pemuka", icon: "dashboard", exact: true }],
  },
  {
    title: "Pemantauan",
    items: [
      { href: "/jainj/masjid", label: "Senarai Masjid", icon: "mosques" },
      { href: "/jainj/skor", label: "Skor Prestasi", icon: "score" },
      { href: "/jainj/amaran", label: "Amaran & Risiko", icon: "alerts" },
    ],
  },
  {
    title: "Data Induk",
    items: [
      { href: "/jainj/tauliah", label: "Pegawai & Tauliah", icon: "tauliah" },
      { href: "/jainj/laporan", label: "Laporan Konsolidasi", icon: "report" },
      { href: "/jainj/audit", label: "Jejak Audit", icon: "audit" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { href: "/system/ops", label: "Operasi & Infrastruktur", icon: "server" },
      { href: "/system/keselamatan", label: "Keselamatan & Pematuhan", icon: "shield" },
    ],
  },
];

export const TUTOR_NAV: NavSection[] = [
  {
    items: [
      { href: "/tutor", label: "Papan Pemuka", icon: "dashboard", exact: true },
      { href: "/tutor/jadual", label: "Jadual Slot", icon: "calendar" },
      { href: "/tutor/tempahan", label: "Tempahan", icon: "bookings" },
      { href: "/tutor/bayaran", label: "Bayaran", icon: "payout" },
      { href: "/tutor/profil", label: "Profil & Tauliah", icon: "profile" },
    ],
  },
];

export const JEMAAH_NAV: NavSection[] = [
  {
    items: [
      { href: "/jemaah", label: "Utama", icon: "home", exact: true },
      { href: "/jemaah/derma", label: "Derma", icon: "donations" },
      { href: "/jemaah/qurban", label: "Qurban", icon: "qurban" },
      { href: "/jemaah/quran", label: "Kelas Quran", icon: "quran" },
      { href: "/jemaah/saya", label: "Saya", icon: "profile" },
    ],
  },
];

export const CHANNEL_META = {
  portal: { name: "Portal Masjid", subtitle: "Pentadbiran masjid", accent: "Portal" },
  jainj: { name: "Konsol JAINJ", subtitle: "Pemantauan negeri & daerah", accent: "JAINJ" },
  tutor: { name: "Aplikasi Tutor", subtitle: "Slot & bayaran", accent: "Tutor" },
  jemaah: { name: "Aplikasi Jemaah", subtitle: "Derma, qurban & kelas", accent: "Jemaah" },
} as const;

export type Channel = keyof typeof CHANNEL_META;
