import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: {
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  className?: string;
} & React.ComponentPropsWithoutRef<"button">) {
  const base = "btn rounded-lg text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none";
  const variants: Record<string, string> = {
    default: "bg-brand-700 text-white hover:bg-brand-800",
    destructive: "bg-red-600 text-white hover:bg-red-700",
    outline: "border border-brand-900/20 bg-transparent text-brand-900 hover:bg-brand-50",
    secondary: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-700/15 hover:bg-brand-100",
    ghost: "text-brand-800 hover:bg-brand-50",
  };
  const sizes: Record<string, string> = {
    default: "px-3.5 py-2",
    sm: "px-3 py-1.5",
  };
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props} />
  );
}
