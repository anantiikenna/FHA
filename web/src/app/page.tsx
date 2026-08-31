import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 items-center justify-center bg-muted p-8">
      <div className="max-w-lg w-full rounded-xl border border-border bg-white p-8 shadow-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-brand">FHA Development Approval & Property Mapping System</h1>
          <p className="text-sm text-slate-600 mt-2">Engineer workflow — map → plot → approval → inspection. MVP v0.1 • DEMO DATA only.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/login" className="rounded-lg bg-brand px-4 py-3 text-center text-sm font-semibold text-white hover:bg-brand-accent">Login</Link>
          <Link href="/dashboard" className="rounded-lg border border-border bg-white px-4 py-3 text-center text-sm font-semibold">Dashboard</Link>
          <Link href="/map" className="rounded-lg border border-border bg-white px-4 py-3 text-center text-sm">Estate Map</Link>
          <Link href="/plots/003" className="rounded-lg border border-border bg-white px-4 py-3 text-center text-sm">Plot 003 Demo</Link>
        </div>
        <p className="text-xs text-slate-500">Primary demo: Login → Map → Search Plot 003 → View Approval FHA/DEV/2024/1056 → New Inspection → GPS/Photo → Approved vs Observed → Submit → History (WORKFLOWS.md:35)</p>
      </div>
    </div>
  );
}
