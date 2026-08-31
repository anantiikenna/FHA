export function Badge({ children, variant = "default" }: { children: React.ReactNode; variant?: "default" | "success" | "warning" | "danger" | "muted" }) {
  const map: Record<string, string> = {
    default: "bg-slate-900 text-white",
    success: "bg-emerald-600 text-white",
    warning: "bg-amber-500 text-white",
    danger: "bg-red-600 text-white",
    muted: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${map[variant]}`}>{children}</span>;
}
