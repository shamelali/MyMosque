import type { Metadata } from "next";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarDays,
  GraduationCap,
  Info,
  Landmark,
  Save,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, StatusBadge } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { commissionFor, priceFor, tierMultiplier } from "@/lib/quran";
import { rm, tarikh } from "@/lib/utils";
import { requireTutor } from "../_lib";
import { updateProfile } from "./actions";

export const metadata: Metadata = { title: "Profil & Tauliah" };

function genderLabel(value: string) {
  return value === "PEREMPUAN" ? "Perempuan" : "Lelaki";
}

export default async function TutorProfilPage({
  searchParams,
}: {
  searchParams: Promise<{ ralat?: string; maklum?: string }>;
}) {
  const { tutor } = await requireTutor();
  const params = await searchParams;

  const expiry = tutor.tauliahExpiry;
  const daysLeft = expiry ? Math.ceil((expiry.getTime() - Date.now()) / 86_400_000) : null;

  const tiers = [1, 2, 3].map((studentCount) => {
    const multiplier = tierMultiplier(studentCount);
    const gross = priceFor({ hourlyRateSen: tutor.hourlyRateSen, hours: 1, studentCount });
    const commission = commissionFor(gross);
    return { studentCount, multiplier, gross, commission, net: gross - commission };
  });

  return (
    <div>
      <PageHeader
        eyebrow="Aplikasi Tutor"
        title="Profil & tauliah"
        description="Kemas kini maklumat pengajaran anda. Pengesahan tauliah adalah hak JAINJ dan pentadbir masjid."
      />

      {params.ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {params.ralat}
        </p>
      )}
      {params.maklum && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/15">
          {params.maklum}
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Maklumat tauliah"
              description="Butiran ini dipaparkan kepada jemaah yang ingin menempah kelas."
              action={
                tutor.verified ? (
                  <Badge tone="success">
                    <BadgeCheck className="mr-1 h-3 w-3" /> Disahkan
                  </Badge>
                ) : (
                  <Badge tone="warning">Belum disahkan</Badge>
                )
              }
            />
            <dl className="grid gap-x-6 gap-y-4 p-5 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">Nama penuh</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm font-semibold text-brand-950">
                  <UserRound className="h-3.5 w-3.5 text-brand-900/35" /> {tutor.name}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">Jantina</dt>
                <dd className="mt-0.5 text-sm text-brand-950">{genderLabel(tutor.gender)}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">No. tauliah</dt>
                <dd className="mt-0.5 font-mono text-sm text-brand-950">{tutor.tauliahNo}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">Tamat tauliah</dt>
                <dd className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-brand-950">
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 text-brand-900/35" /> {tarikh(expiry)}
                  </span>
                  {daysLeft === null ? (
                    <Badge tone="neutral">Tiada tarikh</Badge>
                  ) : daysLeft < 0 ? (
                    <Badge tone="warning">Tamat tempoh</Badge>
                  ) : daysLeft < 60 ? (
                    <Badge tone="warning">{daysLeft} hari lagi</Badge>
                  ) : (
                    <Badge tone="success">Sah</Badge>
                  )}
                </dd>
                {daysLeft !== null && daysLeft < 60 && (
                  <p className="mt-1 text-[11px] leading-relaxed text-amber-700">
                    {daysLeft < 0
                      ? "Tauliah telah tamat. Hubungi JAINJ atau setiausaha masjid untuk pembaharuan sebelum menerima tempahan baharu."
                      : "Tauliah akan tamat tidak lama lagi. Sila mulakan pembaharuan dengan JAINJ."}
                  </p>
                )}
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">Status pengesahan</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-brand-950">
                  {tutor.verified ? (
                    <>
                      <BadgeCheck className="h-4 w-4 text-emerald-600" /> Disahkan
                      {tutor.verifiedBy ? <span className="text-xs text-brand-900/45">oleh {tutor.verifiedBy}</span> : null}
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4 text-amber-600" /> Dalam semakan JAINJ
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-wide text-brand-900/45">Masjid</dt>
                <dd className="mt-0.5 flex items-center gap-1.5 text-sm text-brand-950">
                  <Landmark className="h-3.5 w-3.5 text-brand-900/35" />
                  {tutor.mosque?.name ?? "Belum dikaitkan"}
                </dd>
              </div>
            </dl>
            <p className="flex items-start gap-1.5 border-t border-brand-900/5 px-5 py-3 text-[11px] leading-relaxed text-brand-900/50">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Status disahkan dan no. tauliah hanya boleh dikemas kini oleh JAINJ atau pentadbir masjid. Hubungi
              setiausaha masjid jika terdapat pembetulan.
            </p>
          </Card>

          <Card>
            <CardHeader
              title="Kemas kini profil"
              description="Perubahan akan dipaparkan serta-merta kepada jemaah."
              action={<GraduationCap className="h-5 w-5 text-brand-900/30" />}
            />
            <form action={updateProfile} className="grid gap-4 p-5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="label" htmlFor="tutorBio">Bio ringkas</label>
                <textarea
                  id="tutorBio"
                  name="bio"
                  rows={4}
                  maxLength={1000}
                  defaultValue={tutor.bio ?? ""}
                  placeholder="Contoh: Pengkhususan tajwid dan hafazan untuk kanak-kanak 6-12 tahun."
                  className="input resize-y"
                />
                <p className="mt-1 text-[11px] text-brand-900/45">
                  Ceritakan pengalaman dan bidang pengkhususan anda. Maksimum 1000 aksara.
                </p>
              </div>

              <div>
                <label className="label" htmlFor="tutorRate">Kadar sejam (RM) *</label>
                <input
                  id="tutorRate"
                  name="hourlyRate"
                  type="number"
                  step="0.01"
                  min="10"
                  max="500"
                  required
                  defaultValue={(tutor.hourlyRateSen / 100).toFixed(2)}
                  className="input"
                />
                <p className="mt-1 text-[11px] text-brand-900/45">Antara RM10.00 dan RM500.00 sejam.</p>
              </div>

              <div>
                <label className="label" htmlFor="tutorStatus">Status</label>
                <select id="tutorStatus" name="status" defaultValue={tutor.status} className="input">
                  <option value="AKTIF">Aktif — menerima tempahan</option>
                  <option value="DIGANTUNG">Digantung — berhenti sementara</option>
                </select>
                <p className="mt-1 text-[11px] text-brand-900/45">
                  Status digantung menyembunyikan profil anda daripada tempahan baharu.
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 border-t border-brand-900/5 pt-4 sm:col-span-2">
                <p className="text-[11px] text-brand-900/45">
                  Status semasa: <StatusBadge value={tutor.status} />
                </p>
                <button type="submit" className="btn-primary text-xs">
                  <Save className="h-4 w-4" /> Simpan perubahan
                </button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Kadar mengikut bilangan pelajar"
              description="Kadar sejam didarab dengan bilangan pelajar dalam kumpulan."
            />
            <div className="table-wrap">
              <table className="data-table min-w-0">
                <thead>
                  <tr>
                    <th>Pelajar</th>
                    <th className="text-right">Pengganda</th>
                    <th className="text-right">Caj sejam</th>
                    <th className="text-right">Bersih anda</th>
                  </tr>
                </thead>
                <tbody>
                  {tiers.map((tier) => (
                    <tr key={tier.studentCount}>
                      <td className="whitespace-nowrap text-xs">
                        {tier.studentCount === 3 ? "3 atau lebih" : `${tier.studentCount} pelajar`}
                      </td>
                      <td className="text-right text-xs">{tier.multiplier.toFixed(1)}×</td>
                      <td className="whitespace-nowrap text-right text-xs">{rm(tier.gross)}</td>
                      <td className="whitespace-nowrap text-right text-xs font-semibold text-emerald-700">
                        {rm(tier.net)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="border-t border-brand-900/5 px-5 py-3 text-[11px] leading-relaxed text-brand-900/50">
              Caj sejam dikira daripada kadar asas {rm(tutor.hourlyRateSen)} × pengganda. Jumlah kelas = caj sejam ×
              bilangan jam. Komisen platform 15% ditolak pada sumber, jadi &quot;Bersih anda&quot; ialah anggaran
              bayaran yang diterima.
            </p>
          </Card>

          <div className="rounded-2xl bg-brand-50 p-4 ring-1 ring-inset ring-brand-700/10">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-950">
              <BadgeCheck className="h-4 w-4 text-brand-700" /> Mengapa kadar berbeza?
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-brand-900/60">
              Kelas kumpulan memerlukan lebih banyak persediaan dan perhatian. Pengganda 1.5× untuk dua pelajar dan
              1.8× untuk tiga pelajar atau lebih memastikan usaha anda dihargai secara adil.
            </p>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] text-brand-900/45">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Perubahan kadar hanya terpakai kepada tempahan baharu. Tempahan yang telah disahkan kekal pada kadar asal.
          </p>
        </div>
      </div>
    </div>
  );
}
