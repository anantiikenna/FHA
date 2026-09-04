type BadgeVariant = "default" | "success" | "warning" | "danger" | "muted" | "info";

const variants: Record<BadgeVariant, string> = {
  default: "bg-foreground text-white",
  success: "bg-success-light text-success-dark border border-success/20",
  warning: "bg-warning-light text-warning-dark border border-warning/20",
  danger: "bg-danger-light text-danger-dark border border-danger/20",
  muted: "bg-muted text-muted-foreground border border-border",
  info: "bg-brand-100 text-brand-900 border border-brand/20",
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-xs font-semibold ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}
