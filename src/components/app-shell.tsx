"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { signOut } from "next-auth/react";
import {
  AlertTriangle, BadgeCheck, Beef, Bell, BookMarked, BookOpen, Building2, Calendar,
  CalendarCheck, ChevronDown, Files, HardHat, HeartHandshake, Home, LayoutDashboard,
  LogOut, Menu, MoonStar, Plug, ScrollText, Server, ShieldCheck, Smartphone, Trophy,
  UserRound, Users, Wallet, WalletCards, Wrench, X, Landmark, FileText,
} from "lucide-react";
import { cn, initials } from "@/lib/utils";
import { ROLE_LABEL, type Role } from "@/lib/roles";
import { CHANNEL_META, type Channel, type IconName, type NavSection } from "@/lib/nav";

const ICONS = {
  dashboard: LayoutDashboard, registry: Building2, finance: Wallet, report: FileText,
  maintenance: Wrench, projects: HardHat, kuliah: BookOpen, donations: HeartHandshake,
  qurban: Beef, quran: BookMarked, bell: Bell, documents: Files, audit: ScrollText,
  integrations: Plug, mosques: Landmark, score: Trophy, alerts: AlertTriangle,
  tauliah: BadgeCheck, calendar: Calendar, bookings: CalendarCheck, payout: WalletCards,
  profile: UserRound, home: Home, users: Users, server: Server, shield: ShieldCheck,
  smartphone: Smartphone,
} satisfies Record<IconName, React.ComponentType<{ className?: string }>>;

type ShellUser = {
  name: string | null;
  email: string;
  role: Role;
  mosqueName?: string | null;
};

function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  return pathname === href || pathname.startsWith(href + "/");
}

export function AppShell({
  channel,
  nav,
  user,
  children,
}: {
  channel: Channel;
  nav: NavSection[];
  user: ShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const meta = CHANNEL_META[channel];

  const sections = nav
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.roles || item.roles.includes(user.role)),
    }))
    .filter((section) => section.items.length > 0);

  const flat = sections.flatMap((s) => s.items).slice(0, 5);

  const navList = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {sections.map((section, i) => (
        <div key={section.title ?? i}>
          {section.title && (
            <p className="mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/35">
              {section.title}
            </p>
          )}
          <ul className="space-y-0.5">
            {section.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(pathname, item.href, item.exact);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition",
                      active
                        ? "bg-white/10 text-white shadow-sm ring-1 ring-inset ring-white/10"
                        : "text-white/65 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-gold-400" : "text-white/45")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2.5 border-b border-white/10 px-4 py-4">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gold-500 text-brand-950">
        <MoonStar className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-white">{meta.name}</p>
        <p className="truncate text-[11px] text-white/45">{user.mosqueName ?? meta.subtitle}</p>
      </div>
    </div>
  );

  const userBlock = (
    <div className="border-t border-white/10 p-3">
      <div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white/10 text-[11px] font-semibold text-white ring-1 ring-inset ring-white/10">
          {initials(user.name ?? user.email)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-white">{user.name ?? "Pengguna"}</p>
          <p className="truncate text-[10px] text-white/45">{ROLE_LABEL[user.role]}</p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          title="Log keluar"
          className="rounded-md p-1.5 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-brand-900 lg:flex">
        {brand}
        {navList}
        {userBlock}
      </aside>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Tutup menu"
            className="absolute inset-0 bg-brand-950/50 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col bg-brand-900 shadow-2xl">
            <div className="flex items-center justify-between pr-2">
              <div className="flex-1">{brand}</div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-white/60 hover:bg-white/10 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            {navList}
            {userBlock}
          </div>
        </div>
      )}

      <div className="min-w-0 flex-1 lg:pl-60">
        <header className="sticky top-0 z-30 border-b border-brand-900/5 bg-sand/85 backdrop-blur">
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="rounded-lg p-2 text-brand-900/70 hover:bg-brand-900/5 lg:hidden"
                aria-label="Buka menu"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="flex items-center gap-2 lg:hidden">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-900 text-gold-400">
                  <MoonStar className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-brand-950">SPMJ</span>
              </div>
              <p className="hidden text-xs text-brand-900/50 lg:block">
                Sistem Pengurusan Masjid Johor <span className="mx-1.5 text-brand-900/25">/</span>
                <span className="font-medium text-brand-900/70">{meta.name}</span>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="hidden rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-brand-800 ring-1 ring-inset ring-brand-900/10 sm:inline-flex">
                {ROLE_LABEL[user.role]}
              </span>
              <UserMenu user={user} />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 mobile-pad">
          {children}
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-brand-900/10 bg-white/95 backdrop-blur lg:hidden">
        <ul className="mx-auto flex max-w-lg items-stretch justify-between px-2 py-1.5">
          {flat.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item.href, item.exact);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-0.5 rounded-lg px-1 py-1.5 text-[10px] font-medium",
                    active ? "text-brand-800" : "text-brand-900/45",
                  )}
                >
                  <span className={cn("rounded-lg p-1", active && "bg-brand-50")}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="truncate">{item.label.split(" ")[0]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function UserMenu({ user }: { user: ShellUser }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-2.5 ring-1 ring-inset ring-brand-900/10 hover:ring-brand-900/20"
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-700 text-[10px] font-semibold text-white">
          {initials(user.name ?? user.email)}
        </span>
        <span className="hidden max-w-[10rem] truncate text-xs font-medium text-brand-900 sm:block">
          {user.name ?? user.email}
        </span>
        <ChevronDown className="h-3.5 w-3.5 text-brand-900/40" />
      </button>
      {open && (
        <>
          <button className="fixed inset-0 z-10 cursor-default" aria-label="Tutup menu" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-xl bg-white shadow-xl ring-1 ring-brand-900/10">
            <div className="border-b border-brand-900/5 px-3 py-2.5">
              <p className="truncate text-xs font-semibold text-brand-950">{user.name ?? "Pengguna"}</p>
              <p className="truncate text-[11px] text-brand-900/50">{user.email}</p>
            </div>
            <div className="p-1.5">
              <MenuLink href="/jemaah" label="Aplikasi Jemaah" icon={Smartphone} onClick={() => setOpen(false)} />
              {(user.role === "TUTOR" || user.role === "JEMAAH") && (
                <MenuLink href="/portal" label="Portal Masjid (demo)" icon={LayoutDashboard} onClick={() => setOpen(false)} />
              )}
              <MenuLink href="/login" label="Tukar akaun demo" icon={UserRound} onClick={() => setOpen(false)} />
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Log keluar
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function MenuLink({
  href, label, icon: Icon, onClick,
}: { href: string; label: string; icon: React.ComponentType<{ className?: string }>; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-brand-900/80 hover:bg-brand-50">
      <Icon className="h-4 w-4 text-brand-900/50" /> {label}
    </Link>
  );
}
