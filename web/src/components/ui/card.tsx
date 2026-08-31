export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-white shadow-sm ${className}`}>{children}</div>;
}
export function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 border-b border-border ${className}`}>{children}</div>;
}
export function CardContent({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`p-4 ${className}`}>{children}</div>;
}
