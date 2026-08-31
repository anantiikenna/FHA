export function Button({ children, variant = "primary", ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const base = "inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-50";
  const variants: Record<string, string> = {
    primary: "bg-brand text-white hover:bg-brand-accent",
    secondary: "bg-white border border-border hover:bg-muted",
    ghost: "hover:bg-muted",
  };
  return <button className={`${base} ${variants[variant]}`} {...props}>{children}</button>;
}
