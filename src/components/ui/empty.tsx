import { cn } from "@/lib/utils";
import Link from "next/link";

export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-14 text-center", className)}>
      {Icon && <Icon className="mb-3 h-8 w-8 text-brand-900/25" />}
      <p className="text-sm font-semibold text-brand-900">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs text-brand-900/55">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Tabs({
  items,
  active,
  className,
}: {
  items: { href: string; label: string; count?: number }[];
  active: string;
  className?: string;
}) {
  return (
    <div className={cn("scrollbar-none mb-4 flex gap-1 overflow-x-auto border-b border-brand-900/10", className)}>
      {items.map((item) => {
        const isActive = item.href === active;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "-mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition",
              isActive
                ? "border-brand-700 text-brand-900"
                : "border-transparent text-brand-900/50 hover:border-brand-900/20 hover:text-brand-900/80",
            )}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className="ml-1.5 rounded-full bg-brand-900/5 px-1.5 py-0.5 text-[10px] font-semibold text-brand-900/60">
                {item.count}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-900/50">{children}</h2>
      {action}
    </div>
  );
}
