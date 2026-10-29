import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const RM = new Intl.NumberFormat("ms-MY", {
  style: "currency",
  currency: "MYR",
  minimumFractionDigits: 2,
});

/** Format integer sen as RM string. */
export function rm(sen: number | null | undefined) {
  return RM.format((sen ?? 0) / 100);
}

export function senFromRinggit(value: string | number) {
  const n = typeof value === "number" ? value : Number(String(value).replace(/[^\d.-]/g, ""));
  return Math.round((Number.isFinite(n) ? n : 0) * 100);
}

const dateFmt = new Intl.DateTimeFormat("ms-MY", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("ms-MY", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function tarikh(d: Date | string | null | undefined) {
  if (!d) return "—";
  return dateFmt.format(new Date(d));
}

export function tarikhMasa(d: Date | string | null | undefined) {
  if (!d) return "—";
  return dateTimeFmt.format(new Date(d));
}

export function bulanTahun(month: number, year: number) {
  const names = [
    "Januari", "Februari", "Mac", "April", "Mei", "Jun",
    "Julai", "Ogos", "September", "Oktober", "November", "Disember",
  ];
  return `${names[month - 1] ?? month} ${year}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.min(100, Math.round((part / total) * 100));
}
