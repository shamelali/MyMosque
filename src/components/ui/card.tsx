import { cn } from "@/lib/utils";
import { tone as toneOf, label } from "@/lib/labels";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3 border-b border-brand-900/5 px-5 py-4", className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-brand-950">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-brand-900/55">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label: statLabel,
  value,
  hint,
  icon: Icon,
  trend,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: LucideIcon;
  trend?: { value: string; up?: boolean };
  className?: string;
}) {
  return (
    <div className={cn("card p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-brand-900/50">{statLabel}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-brand-950">{value}</p>
          {hint && <p className="mt-1 text-xs text-brand-900/55">{hint}</p>}
        </div>
        {Icon && (
          <span className="rounded-xl bg-brand-50 p-2.5 text-brand-700 ring-1 ring-inset ring-brand-700/10">
            <Icon className="h-5 w-5" />
          </span>
        )}
      </div>
      {trend && (
        <p className={cn("mt-3 text-xs font-medium", trend.up ? "text-emerald-600" : "text-brand-900/50")}>
          {trend.value}
        </p>
      )}
    </div>
  );
}

export function CardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <h3 className={cn("text-sm font-semibold leading-none tracking-tight", className)}>{children}</h3>;
}

export function CardContent({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("p-5 pt-0", className)}>{children}</div>;
}

export function CardFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn("flex items-center space-between p-5 pt-0", className)}>{children}</div>;
}

export function StatusBadge({ value }: { value: string | null | undefined }) {
  return <Badge tone={toneOf(value)}>{label(value)}</Badge>;
}

export function Progress({ value, className, tone = "brand" }: { value: number; className?: string; tone?: "brand" | "gold" | "danger" }) {
  const bar = tone === "gold" ? "bg-gold-500" : tone === "danger" ? "bg-red-500" : "bg-brand-600";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-brand-900/10", className)}>
      <div className={cn("h-full rounded-full transition-all", bar)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}
