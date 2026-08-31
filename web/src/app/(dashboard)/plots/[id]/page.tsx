import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default async function PlotDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // TODO: fetch via GET /api/v1/plots/{id} (API.md:14) with auth + audit
  return (
    <div className="space-y-4">
      <Link href="/map" className="text-sm text-brand">← Back to Map</Link>
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold">Plot {id}</h1>
        <Badge variant="success">APPROVED</Badge>
        <span className="text-sm text-slate-500">Block A • FHA Festac Estate • 650 sqm</span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card><CardHeader><h3 className="font-semibold">Property</h3></CardHeader><CardContent className="text-sm space-y-1"><p>Estate: FHA Festac Estate</p><p>Street: 3rd Avenue</p><p>Land Use: Residential</p><p>Allocation: FHA/AL/2020/1478 (2020-03-12)</p></CardContent></Card>
        <Card><CardHeader><h3 className="font-semibold">Approval</h3></CardHeader><CardContent className="text-sm space-y-1"><p>Approval: FHA/DEV/2024/1056</p><p>Date: 2025-01-10 — Valid until 2027-01-09</p><p>Development: 4 Units Townhouse — 2 floors / 4 units</p><p className="text-xs text-slate-500">Record Found — not a legal determination (AGENTS.md:7)</p></CardContent></Card>
      </div>
      <div className="flex gap-3">
        <Link href={`/map?plot=${id}`} className="rounded-lg border border-border bg-white px-4 py-2 text-sm">View on Map</Link>
        <Link href={`/approvals?plot=${id}`} className="rounded-lg border border-border bg-white px-4 py-2 text-sm">Verify Approval</Link>
        <Link href={`/inspections/new?plotId=${id}`} className="rounded-lg bg-brand px-4 py-2 text-sm text-white">New Inspection</Link>
      </div>
    </div>
  );
}
