import Link from "next/link";
import { redirect } from "next/navigation";
import {
  MoonStar, ArrowRight, Landmark, BookOpen, HeartHandshake, ShieldCheck,
  Smartphone, Wrench, Trophy, CheckCircle2,
} from "lucide-react";
import { auth, homeFor } from "@/lib/auth";

const CHANNELS = [
  {
    href: "/portal",
    title: "Portal Masjid",
    who: "Pengerusi, setiausaha, bendahari, AJK",
    body: "Pendaftaran masjid, mesyuarat, lejar dan resit, selenggaraan aset, projek renovasi dan jadual kuliah.",
    icon: Landmark,
  },
  {
    href: "/jainj",
    title: "Konsol JAINJ",
    who: "Pegawai negeri & daerah, auditor",
    body: "Papan pemuka daerah, senarai masjid berdaftar, skor prestasi bulanan, amaran risiko dan data tauliah.",
    icon: ShieldCheck,
  },
  {
    href: "/jemaah",
    title: "Aplikasi Jemaah",
    who: "Orang awam, ibu bapa, penderma",
    body: "Derma QR dan berulang, tempahan qurban, tempahan kelas Al-Quran dengan persetujuan penjaga.",
    icon: Smartphone,
  },
  {
    href: "/tutor",
    title: "Aplikasi Tutor",
    who: "Ustaz & ustazah bertauliah",
    body: "Urus slot kelas, terima tempahan, sahkan kehadiran dan lihat bayaran selepas komisen.",
    icon: BookOpen,
  },
];

const PHASES = [
  { phase: "Fasa 1", title: "Pilot teras", items: ["Pendaftaran & AJK", "Kewangan & laporan", "Selenggaraan", "Kuliah", "Identiti & audit"], icon: Landmark, pct: "23 komponen" },
  { phase: "Fasa 2", title: "Wang & komuniti", items: ["Derma & QR", "Qurban", "Tempahan Al-Quran", "Projek renovasi", "Aplikasi jemaah & tutor"], icon: HeartHandshake, pct: "9 komponen" },
  { phase: "Fasa 3", title: "Skor & skala", items: ["Enjin skor bulanan", "Analitik daerah", "Papan pemuka JAINJ", "Amaran awal"], icon: Trophy, pct: "2 komponen" },
];

export default async function LandingPage() {
  const session = await auth();
  if (session?.user?.role) redirect(homeFor(session.user.role));

  return (
    <div className="min-h-dvh bg-sand">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand-900 text-gold-400">
            <MoonStar className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-brand-950">SPMJ</p>
            <p className="text-[10px] text-brand-900/50">Sistem Pengurusan Masjid Johor</p>
          </div>
        </div>
        <Link href="/login" className="btn-primary">
          Masuk demo <ArrowRight className="h-4 w-4" />
        </Link>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-brand-950" />
          <div
            className="absolute inset-0 opacity-[0.08]"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "24px 24px" }}
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
            <div className="max-w-3xl">
              <p className="inline-flex items-center gap-2 rounded-full bg-white/5 px-3 py-1 text-[11px] font-medium text-gold-400 ring-1 ring-inset ring-white/10">
                <span className="h-1.5 w-1.5 rounded-full bg-gold-400" /> Demo platform · Johor Darul Ta'zim
              </p>
              <h1 className="mt-5 text-3xl font-semibold leading-[1.15] tracking-tight text-white sm:text-5xl">
                Satu platform untuk setiap urusan masjid.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-relaxed text-white/60 sm:text-base">
                Daripada daftar AJK dan lejar bulanan, hingga derma QR, qurban dan kelas Al-Quran — dengan
                pengawasan JAINJ dan jejak audit yang tidak boleh diubah. Dibina untuk talian lemah,
                Bahasa Melayu dahulu, di telefon dan desktop.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link href="/login" className="btn-gold">
                  Terokai demo penuh <ArrowRight className="h-4 w-4" />
                </Link>
                <Link href="#saluran" className="btn inline-flex bg-white/5 text-white ring-1 ring-inset ring-white/15 hover:bg-white/10">
                  Lihat semua saluran
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-[11px] text-white/45">
                {["Data di Malaysia", "MFA untuk pegawai", "PDPA & jejak audit", "Sasaran 99.5% ketersediaan"].map((f) => (
                  <span key={f} className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-gold-400" /> {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="saluran" className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">Empat saluran</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-950">Satu akaun, peranan berbeza</h2>
            </div>
            <p className="max-w-md text-xs text-brand-900/55">
              Aplikasi mudah alih dan web berkongsi satu kod dan satu identiti. Setiap peranan melihat skrin
              dan tindakan yang berbeza.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {CHANNELS.map((c) => (
              <Link key={c.href} href="/login" className="card group p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
                <span className="inline-grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-700/10">
                  <c.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-base font-semibold text-brand-950">{c.title}</h3>
                <p className="mt-0.5 text-[11px] font-medium uppercase tracking-wide text-gold-600">{c.who}</p>
                <p className="mt-2 text-sm leading-relaxed text-brand-900/60">{c.body}</p>
                <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-brand-700">
                  Log masuk sebagai peranan ini <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-y border-brand-900/5 bg-white/60">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gold-600">Pelan pelaksanaan</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-brand-950">34 komponen, tiga fasa</h2>
            <p className="mt-2 max-w-2xl text-sm text-brand-900/60">
              Demo ini meliputi keseluruhan inventori seni bina: setiap komponen boleh dilihat dan dijalankan,
              dengan pembayaran dan integrasi disimulasikan.
            </p>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {PHASES.map((p) => (
                <div key={p.phase} className="card p-5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-2 text-xs font-semibold text-brand-700">
                      <p.icon className="h-4 w-4" /> {p.phase}
                    </span>
                    <span className="text-[10px] font-medium text-brand-900/40">{p.pct}</span>
                  </div>
                  <h3 className="mt-3 text-sm font-semibold text-brand-950">{p.title}</h3>
                  <ul className="mt-3 space-y-1.5">
                    {p.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-xs text-brand-900/60">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" /> {item}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
          <div className="grid gap-6 rounded-2xl bg-brand-900 p-8 text-white sm:grid-cols-[1.3fr_1fr] sm:p-10">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Sedia untuk melihat aliran kerja penuh?</h2>
              <p className="mt-2 max-w-md text-sm text-white/60">
                Lapan akaun demo merangkumi kesemua peranan — daripada kelulusan laporan kewangan hingga
                pembayaran qurban dan bayaran tutor.
              </p>
            </div>
            <div className="flex items-end justify-start sm:justify-end">
              <Link href="/login" className="btn-gold">
                Buka halaman log masuk <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-brand-900/5">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-6 text-[11px] text-brand-900/45 sm:px-6 lg:px-8">
          <p>© 2026 PIJ Holdings · Demo untuk semakan seni bina, bukan data sebenar.</p>
          <p className="inline-flex items-center gap-1.5">
            <Wrench className="h-3 w-3" /> Fasa 1–3 · 34 komponen · PWA
          </p>
        </div>
      </footer>
    </div>
  );
}
