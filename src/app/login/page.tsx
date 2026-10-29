import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MoonStar, ShieldCheck, Landmark, ArrowRight, KeyRound } from "lucide-react";
import { auth, googleEnabled, homeFor } from "@/lib/auth";
import { demoSignIn, googleSignIn } from "./actions";
import { ROLE_LABEL, type Role } from "@/lib/roles";

export const metadata: Metadata = { title: "Log masuk" };

const DEMO_EMAILS = [
  { email: "ketua@masjid.demo", name: "Hj. Kamarudin bin Salleh", role: "KETUA" as Role, note: "Masjid Al-Falah, Johor Bahru" },
  { email: "setiausaha@masjid.demo", name: "Noraini binti Hashim", role: "SETIAUSAHA" as Role, note: "Pendaftaran, mesyuarat, kuliah" },
  { email: "bendahari@masjid.demo", name: "Mohd Farid bin Osman", role: "BENDAHARI" as Role, note: "Lejar, resit, laporan bulanan" },
  { email: "ajk@masjid.demo", name: "Siti Zubaidah binti Ahmad", role: "AJK" as Role, note: "Selenggaraan & program" },
  { email: "pegawai@jainj.demo", name: "En. Rizal bin Hamzah", role: "JAINJ" as Role, note: "Konsol negeri & daerah" },
  { email: "auditor@jainj.demo", name: "Puan Lim Mei Ling", role: "AUDITOR" as Role, note: "Audit & pematuhan" },
  { email: "tutor@masjid.demo", name: "Ustazah Nur Aisyah", role: "TUTOR" as Role, note: "Slot, tempahan, bayaran" },
  { email: "jemaah@demo.my", name: "Ahmad Faiz bin Yusof", role: "JEMAAH" as Role, note: "Derma, qurban, kelas Quran" },
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ ralat?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role) redirect(homeFor(session.user.role));
  const { ralat } = await searchParams;

  return (
    <div className="min-h-dvh bg-brand-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }} />
        <div className="relative">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gold-500 text-brand-950">
              <MoonStar className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold tracking-wide text-white">SPMJ</p>
              <p className="text-[11px] text-white/50">Sistem Pengurusan Masjid Johor</p>
            </div>
          </Link>
        </div>

        <div className="relative max-w-lg">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold-400">Demo rasmi</p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight text-white xl:text-4xl">
            Tadbir urus masjid yang telus, daripada AJK hingga JAINJ.
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-white/60">
            Satu platform untuk pendaftaran masjid, kewangan, selenggaraan, kuliah, derma, qurban dan
            tempahan kelas Al-Quran. Log masuk sebagai mana-mana peranan di sebelah untuk melihat aliran
            kerja penuh.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-white/70">
            <li className="flex items-center gap-3"><ShieldCheck className="h-4 w-4 text-gold-400" /> Satu identiti, kawalan akses mengikut peranan</li>
            <li className="flex items-center gap-3"><Landmark className="h-4 w-4 text-gold-400" /> Data masjid negeri Johor, patuh PDPA</li>
            <li className="flex items-center gap-3"><KeyRound className="h-4 w-4 text-gold-400" /> MFA untuk pegawai, jejak audit penuh</li>
          </ul>
        </div>

        <p className="relative text-[11px] text-white/35">
          © 2026 PIJ Holdings · Demo untuk semakan, bukan data sebenar.
        </p>
      </div>

      <div className="flex min-h-dvh items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gold-500 text-brand-950">
              <MoonStar className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-semibold text-white">SPMJ</p>
              <p className="text-[11px] text-white/50">Sistem Pengurusan Masjid Johor</p>
            </div>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <h2 className="text-lg font-semibold text-brand-950">Log masuk</h2>
            <p className="mt-1 text-xs text-brand-900/55">
              Pilih akaun demo di bawah, atau gunakan e-mel dan kata laluan anda.
            </p>

            {ralat && (
              <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
                {ralat === "kelayakan"
                  ? "E-mel atau kata laluan tidak sah."
                  : "Akaun tidak dijumpai. Gunakan salah satu akaun demo."}
              </p>
            )}

            <form action={googleSignIn} className="mt-5">
              <button
                type="submit"
                disabled={!googleEnabled}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-brand-900/15 bg-white px-4 py-2.5 text-sm font-semibold text-brand-950 transition hover:bg-sand disabled:cursor-not-allowed disabled:opacity-45"
              >
                <GoogleMark />
                Teruskan dengan Google
              </button>
            </form>
            {!googleEnabled && (
              <p className="mt-2 text-[11px] leading-relaxed text-brand-900/45">
                Google log masuk belum dikonfigurasi. Tetapkan <code className="rounded bg-sand px-1 py-0.5">GOOGLE_CLIENT_ID</code> dan{" "}
                <code className="rounded bg-sand px-1 py-0.5">GOOGLE_CLIENT_SECRET</code> dalam <code className="rounded bg-sand px-1 py-0.5">.env</code>.
              </p>
            )}

            <div className="my-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-brand-900/10" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-900/35">atau akaun demo</span>
              <span className="h-px flex-1 bg-brand-900/10" />
            </div>

            <div className="max-h-[19rem] space-y-1.5 overflow-y-auto pr-1">
              {DEMO_EMAILS.map((account) => (
                <form key={account.email} action={demoSignIn}>
                  <input type="hidden" name="email" value={account.email} />
                  <button
                    type="submit"
                    className="group flex w-full items-center gap-3 rounded-xl border border-brand-900/8 px-3 py-2.5 text-left transition hover:border-brand-700/30 hover:bg-brand-50/60"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-800">
                      {account.role.slice(0, 2)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold text-brand-950">{account.name}</span>
                      <span className="block truncate text-[10px] text-brand-900/50">
                        {ROLE_LABEL[account.role]} · {account.note}
                      </span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0 text-brand-900/25 transition group-hover:translate-x-0.5 group-hover:text-brand-700" />
                  </button>
                </form>
              ))}
            </div>

            <details className="mt-4 rounded-lg bg-sand px-3 py-2.5">
              <summary className="cursor-pointer text-xs font-semibold text-brand-900/65">Masuk dengan e-mel & kata laluan</summary>
              <form action={demoSignIn} className="mt-3 space-y-2.5">
                <div>
                  <label className="label" htmlFor="email">E-mel</label>
                  <input id="email" name="email" type="email" required placeholder="nama@masjid.demo" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="password">Kata laluan</label>
                  <input id="password" name="password" type="password" required placeholder="demo1234" className="input" />
                </div>
                <button type="submit" className="btn-primary w-full">Masuk</button>
              </form>
              <p className="mt-2 text-[10px] text-brand-900/40">Kata laluan demo untuk semua akaun: <b>demo1234</b></p>
            </details>
          </div>

          <p className="mt-4 text-center text-[11px] text-white/35 lg:hidden">
            © 2026 PIJ Holdings · Demo
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 18.9 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.2 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.4-11.3-8.1l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C36.9 40.2 44 35 44 24c0-1.3-.1-2.6-.4-3.9z" />
    </svg>
  );
}
