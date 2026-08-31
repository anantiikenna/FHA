import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Badge variant="muted">FHA Festac Estate — Phase 1</Badge>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[["Total Plots", "20"], ["Approved", "8"], ["Pending", "4"], ["Inspections Due", "3"]].map(([k, v]) => (
          <Card key={k}>
            <CardContent><p className="text-sm text-slate-500">{k}</p><p className="text-2xl font-bold">{v}</p></CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><h2 className="font-semibold">Quick actions</h2></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/map" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Open Map</Link>
          <Link href="/map?search=003" className="rounded-lg border border-border bg-white px-4 py-2 text-sm">Search Plot 003</Link>
          <Link href="/inspections/new?plotId=demo" className="rounded-lg border border-border bg-white px-4 py-2 text-sm">New Inspection</Link>
        </CardContent>
      </Card>
    </div>
  );
}
