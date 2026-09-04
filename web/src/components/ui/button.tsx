type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-white shadow-md shadow-brand/15 hover:bg-brand-light hover:shadow-lg hover:shadow-brand/20 active:bg-brand-900",
  secondary: "bg-surface border border-border text-foreground hover:bg-muted hover:border-border-strong active:bg-surface-sunken",
  ghost: "text-foreground hover:bg-muted active:bg-surface-sunken",
  danger: "bg-danger text-white shadow-md shadow-danger/15 hover:bg-red-700 hover:shadow-lg active:bg-red-800",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const base = "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}
