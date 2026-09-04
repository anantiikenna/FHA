import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();

  const [plotsResult, approvalsResult, inspectionsResult] = await Promise.all([
    supabase.from("plots").select("id, status", { count: "exact" }),
    supabase.from("approvals").select("id, status", { count: "exact" }).eq("status", "APPROVED"),
    supabase.from("inspections").select("id, status", { count: "exact" }),
  ]);

  const totalPlots = plotsResult.count ?? 0;
  const approvedPlots = (plotsResult.data ?? []).filter((p) => p.status === "APPROVED").length;
  const pendingPlots = (plotsResult.data ?? []).filter((p) => p.status === "PENDING").length;
  const totalInspections = inspectionsResult.count ?? 0;
  const draftInspections = (inspectionsResult.data ?? []).filter((i) => i.status === "DRAFT").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Badge variant="muted">FHA Festac Estate — Phase 1</Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Total Plots</p>
            <p className="text-2xl font-bold">{totalPlots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Approved</p>
            <p className="text-2xl font-bold text-emerald-600">{approvedPlots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Pending</p>
            <p className="text-2xl font-bold text-amber-600">{pendingPlots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-sm text-slate-500">Inspections</p>
            <p className="text-2xl font-bold">{totalInspections}</p>
            {draftInspections > 0 && <p className="text-xs text-amber-600">{draftInspections} draft</p>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><h2 className="font-semibold">Quick actions</h2></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/map" className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white">Open Map</Link>
          <Link href="/plots" className="rounded-lg border border-border bg-white px-4 py-2 text-sm">All Properties</Link>
          <Link href="/approvals" className="rounded-lg border border-border bg-white px-4 py-2 text-sm">Verify Approval</Link>
          <Link href="/inspections" className="rounded-lg border border-border bg-white px-4 py-2 text-sm">Inspections</Link>
        </CardContent>
      </Card>
    </div>
  );
}
