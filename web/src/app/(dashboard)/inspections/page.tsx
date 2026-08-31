import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

export default function InspectionsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Inspections</h1>
      <Card><CardContent className="text-sm text-slate-600">No inspections yet — create one from Plot 003 to demonstrate workflow (WORKFLOWS.md:35).</CardContent></Card>
      <Link href="/inspections/new?plotId=demo" className="inline-flex rounded-lg bg-brand px-4 py-2 text-sm text-white">New Inspection</Link>
      <div className="text-xs text-slate-500">
        <Badge variant="muted">Demo</Badge> Inspection history will show: FHA/INSP/2025/0210 — Plot 003 — Roof Level — POTENTIAL DISCREPANCY
      </div>
    </div>
  );
}
