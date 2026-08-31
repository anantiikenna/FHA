import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1">
      <aside className="w-60 border-r border-border bg-white hidden md:block">
        <nav className="p-4 space-y-1 text-sm">
          <Link href="/dashboard" className="block rounded-lg px-3 py-2 hover:bg-muted font-medium">Dashboard</Link>
          <Link href="/map" className="block rounded-lg px-3 py-2 hover:bg-muted font-medium">Estate Map</Link>
          <Link href="/plots" className="block rounded-lg px-3 py-2 hover:bg-muted">Properties</Link>
          <Link href="/approvals" className="block rounded-lg px-3 py-2 hover:bg-muted">Approvals</Link>
          <Link href="/inspections" className="block rounded-lg px-3 py-2 hover:bg-muted">Inspections</Link>
          <Link href="/documents" className="block rounded-lg px-3 py-2 hover:bg-muted">Documents</Link>
        </nav>
      </aside>
      <main className="flex-1 bg-muted/30 p-4 md:p-6">{children}</main>
    </div>
  );
}
