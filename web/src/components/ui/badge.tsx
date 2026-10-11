type BadgeVariant = "default" | "success" | "warning" | "danger" | "muted" | "info";

const variants: Record<BadgeVariant, string> = {
  default: "bg-foreground text-white",
  success: "bg-success-light text-success-dark border border-success/20 dark:bg-success/15 dark:text-success-light dark:border-success/30",
  warning: "bg-warning-light text-warning-dark border border-warning/20 dark:bg-warning/15 dark:text-warning-light dark:border-warning/30",
  danger: "bg-danger-light text-danger-dark border border-danger/20 dark:bg-danger/15 dark:text-danger-light dark:border-danger/30",
  muted: "bg-muted text-muted-foreground border border-border",
  info: "bg-brand-100 text-brand-900 border border-brand/20 dark:bg-brand/20 dark:text-brand-100 dark:border-brand/30",
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
