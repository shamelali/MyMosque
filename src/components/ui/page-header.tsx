import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6">
      {back && (
        <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900">
          <ChevronRight className="h-3.5 w-3.5 rotate-180" />
          {back.label}
        </Link>
      )}
      {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-gold-600">{eyebrow}</p>}
      <div className="mt-1 flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight text-brand-950 sm:text-2xl">{title}</h1>
          {description && <p className="mt-1 text-sm text-brand-900/60">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </div>
  );
}
