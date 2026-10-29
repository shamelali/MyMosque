import type { Metadata } from "next";
import {
  Banknote,
  Building2,
  CalendarDays,
  CheckCircle2,
  HardHat,
  Plus,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardHeader, Progress, StatusBadge } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty";
import { currentMosque, requirePageUser } from "@/components/channel-shell";
import { prisma } from "@/lib/db";
import { percent, rm, tarikh } from "@/lib/utils";
import { addProjectExpense, approveProject, createProject, rejectProject } from "./actions";

export const metadata: Metadata = { title: "Projek Renovasi" };

export default async function ProjekPage({
  searchParams,
}: {
  searchParams: Promise<{ ralat?: string }>;
}) {
  const user = await requirePageUser();
  const mosque = await currentMosque();
  const { ralat } = await searchParams;

  const projects = await prisma.project.findMany({
    where: { mosqueId: mosque.id },
    include: { expenses: { orderBy: { date: "desc" } } },
    orderBy: { createdAt: "desc" },
  });

  const isKetua = user.role === "KETUA";
  const canCreate = isKetua || user.role === "SETIAUSAHA";
  const canManageExpense = canCreate || user.role === "BENDAHARI";
  const today = new Date();
  const todayValue = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  return (
    <div>
      <PageHeader
        eyebrow="Operasi"
        title="Projek Renovasi"
        description="Cadang, lulus dan pantau projek naik taraf serta pembaikan besar masjid."
      />

      {ralat && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 ring-1 ring-inset ring-red-600/15">
          {ralat}
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="self-start">
          <CardHeader title="Cadangan projek baharu" description="Projek baharu bermula dengan status dicadang." />
          {canCreate ? (
            <form action={createProject} className="space-y-3 p-5">
              <div>
                <label className="label" htmlFor="projectTitle">Tajuk projek</label>
                <input id="projectTitle" name="title" required placeholder="Contoh: Naik taraf ruang solat wanita" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="projectDescription">Keterangan</label>
                <textarea id="projectDescription" name="description" rows={3} placeholder="Skop dan tujuan projek…" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="projectBudget">Anggaran kos (RM)</label>
                <input id="projectBudget" name="budget" type="number" step="0.01" min="0.01" required placeholder="0.00" className="input" />
              </div>
              <div>
                <label className="label" htmlFor="projectContractor">Kontraktor</label>
                <input id="projectContractor" name="contractor" placeholder="Nama syarikat" className="input" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label" htmlFor="projectStart">Tarikh mula</label>
                  <input id="projectStart" name="startDate" type="date" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="projectEnd">Tarikh siap</label>
                  <input id="projectEnd" name="endDate" type="date" className="input" />
                </div>
              </div>
              <button type="submit" className="btn-primary w-full">
                <Plus className="h-4 w-4" /> Hantar cadangan
              </button>
              <p className="text-[11px] leading-relaxed text-brand-900/45">
                Cadangan akan menunggu kelulusan Pengerusi sebelum kerja boleh dimulakan.
              </p>
            </form>
          ) : (
            <EmptyState
              icon={HardHat}
              title="Akses terhad"
              description="Hanya Pengerusi dan Setiausaha boleh mencadangkan projek baharu."
            />
          )}
        </Card>

        <div>
          {projects.length === 0 ? (
            <Card>
              <EmptyState
                icon={HardHat}
                title="Belum ada projek"
                description="Cadangkan projek naik taraf atau pembaikan menggunakan borang di sebelah."
              />
            </Card>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {projects.map((project) => {
                const used = percent(project.spentSen, project.budgetSen);
                const overBudget = project.spentSen > project.budgetSen;
                return (
                  <Card key={project.id} className="flex flex-col p-5">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-brand-950">{project.title}</p>
                        <p className="mt-1 text-[11px] text-brand-900/50">
                          Dicadang {tarikh(project.createdAt)}
                        </p>
                      </div>
                      <StatusBadge value={project.status} />
                    </div>

                    {project.description && (
                      <p className="mt-2 text-xs leading-relaxed text-brand-900/65">{project.description}</p>
                    )}

                    <div className="mt-4">
                      <div className="flex items-end justify-between text-xs">
                        <span className="text-brand-900/55">
                          Digunakan <span className="font-semibold text-brand-950">{rm(project.spentSen)}</span>
                        </span>
                        <span className="text-brand-900/55">
                          Anggaran <span className="font-semibold text-brand-950">{rm(project.budgetSen)}</span>
                        </span>
                      </div>
                      <Progress value={used} tone={overBudget ? "danger" : used >= 100 ? "gold" : "brand"} className="mt-2" />
                      <p className={`mt-1.5 text-[11px] ${overBudget ? "font-semibold text-red-600" : "text-brand-900/45"}`}>
                        {used}% digunakan
                        {overBudget && ` · melebihi anggaran ${rm(project.spentSen - project.budgetSen)}`}
                      </p>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-brand-900/55">
                      {project.contractor && (
                        <span className="inline-flex items-center gap-1">
                          <Building2 className="h-3.5 w-3.5" /> {project.contractor}
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {tarikh(project.startDate)} – {tarikh(project.endDate)}
                      </span>
                    </div>

                    {project.approvedBy && (
                      <p className="mt-1 text-[11px] text-brand-900/45">Diluluskan oleh {project.approvedBy}</p>
                    )}

                    {project.expenses.length > 0 && (
                      <div className="mt-4 rounded-lg bg-sand px-3 py-2.5">
                        <p className="text-[10px] font-semibold uppercase tracking-wide text-brand-900/45">
                          Perbelanjaan ({project.expenses.length})
                        </p>
                        <ul className="mt-1.5 space-y-1">
                          {project.expenses.slice(0, 3).map((expense) => (
                            <li key={expense.id} className="flex items-center justify-between gap-2 text-[11px]">
                              <span className="min-w-0 truncate text-brand-900/70">{expense.description}</span>
                              <span className="whitespace-nowrap font-medium text-brand-950">{rm(expense.amountSen)}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    <div className="mt-4 flex flex-1 flex-col justify-end gap-2 border-t border-brand-900/5 pt-3">
                      {project.status === "DICADANG" && isKetua && (
                        <div className="flex flex-wrap items-center gap-2">
                          <form action={approveProject}>
                            <input type="hidden" name="id" value={project.id} />
                            <button type="submit" className="btn-secondary !px-2.5 !py-1.5 text-xs">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Lulus
                            </button>
                          </form>
                          <form action={rejectProject}>
                            <input type="hidden" name="id" value={project.id} />
                            <button type="submit" className="btn-ghost !px-2.5 !py-1.5 text-xs text-red-600 hover:bg-red-50">
                              <XCircle className="h-3.5 w-3.5" /> Tolak
                            </button>
                          </form>
                        </div>
                      )}

                      {canManageExpense && project.status !== "DITOLAK" && (
                        <details className="group">
                          <summary className="cursor-pointer list-none text-[11px] font-semibold text-brand-700 hover:text-brand-900">
                            <span className="inline-flex items-center gap-1">
                              <Banknote className="h-3.5 w-3.5" /> Tambah perbelanjaan
                            </span>
                          </summary>
                          <form action={addProjectExpense} className="mt-2 space-y-2">
                            <input type="hidden" name="id" value={project.id} />
                            <input
                              name="description"
                              required
                              placeholder="Keterangan perbelanjaan"
                              className="input !py-1.5 text-xs"
                            />
                            <div className="flex gap-2">
                              <input
                                name="date"
                                type="date"
                                required
                                defaultValue={todayValue}
                                className="input !py-1.5 text-xs"
                              />
                              <input
                                name="amount"
                                type="number"
                                step="0.01"
                                min="0.01"
                                required
                                placeholder="RM"
                                className="input !w-28 !py-1.5 text-xs"
                              />
                              <button type="submit" className="btn-secondary whitespace-nowrap !px-2.5 !py-1.5 text-xs">
                                Simpan
                              </button>
                            </div>
                          </form>
                        </details>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
