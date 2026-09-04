import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusVariant: Record<string, "success" | "warning" | "muted" | "danger"> = {
  APPROVED: "success",
  PENDING: "warning",
  UNDER_CONSTRUCTION: "muted",
  COMPLETED: "success",
  INSPECTION_REQUIRED: "warning",
  REVIEW_REQUIRED: "danger",
};

export default async function PlotDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: plot } = await supabase
    .from("plots")
    .select(`
      id, plot_number, plot_reference, plot_size, plot_size_unit,
      street, land_use, latitude, longitude, status, is_demo,
      block:blocks(id, block_number),
      estate:estates(id, name, phase, state),
      property_interests(id, name, organization_name, interest_type, allocation_number, allocation_date, is_current),
      approvals(id, approval_number, approval_date, valid_until, status, development_type,
                approved_floors, approved_units, front_setback, side_setback, rear_setback, conditions)
    `)
    .eq("id", id)
    .single();

  if (!plot) {
    return (
      <div className="space-y-4">
        <Link href="/map" className="text-sm text-brand">← Back to Map</Link>
        <Card><CardContent className="text-sm text-slate-500">Plot not found.</CardContent></Card>
      </div>
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const block = (plot.block as any) as { id: string; block_number: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const estate = (plot.estate as any) as { name: string; phase: string; state: string } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interests = ((plot.property_interests as any) ?? []) as { name: string; allocation_number: string; allocation_date: string; interest_type: string }[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const approvals = ((plot.approvals as any) ?? []) as { id: string; approval_number: string; approval_date: string; valid_until: string; status: string; development_type: string; approved_floors: number; approved_units: number; conditions: string }[];
  const activeApproval = approvals.find((a) => a.status === "APPROVED") ?? approvals[0];

  return (
    <div className="space-y-4">
      <Link href="/map" className="text-sm text-brand">← Back to Map</Link>
      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-2xl font-bold">Plot {plot.plot_number}</h1>
        <Badge variant={statusVariant[plot.status] ?? "muted"}>{plot.status}</Badge>
        <span className="text-sm text-slate-500">
          Block {block?.block_number ?? "—"} • {estate?.name ?? "—"} • {plot.plot_size} {plot.plot_size_unit}
        </span>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h3 className="font-semibold">Property</h3></CardHeader>
          <CardContent className="text-sm space-y-1">
            <p>Estate: {estate?.name ?? "—"}</p>
            <p>Street: {plot.street ?? "—"}</p>
            <p>Land Use: {plot.land_use ?? "—"}</p>
            <p>Reference: {plot.plot_reference ?? "—"}</p>
            {interests[0] && (
              <p>Allocation: {interests[0].allocation_number} ({interests[0].allocation_date})</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold">Approval</h3></CardHeader>
          <CardContent className="text-sm space-y-1">
            {activeApproval ? (
              <>
                <p>Approval: {activeApproval.approval_number}</p>
                <p>Date: {activeApproval.approval_date} — Valid until {activeApproval.valid_until}</p>
                <p>Development: {activeApproval.development_type} — {activeApproval.approved_floors} floors / {activeApproval.approved_units} units</p>
                {activeApproval.conditions && <p className="text-xs text-slate-500 mt-1">{activeApproval.conditions}</p>}
                <p className="text-xs text-slate-500">Record Found — not a legal determination</p>
              </>
            ) : (
              <p className="text-slate-500">No approval on record</p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Link href={`/map?plot=${id}`} className="rounded-lg border border-border bg-white px-4 py-2 text-sm">View on Map</Link>
        <Link href={`/approvals?plotId=${id}`} className="rounded-lg border border-border bg-white px-4 py-2 text-sm">Verify Approval</Link>
        <Link href={`/inspections/new?plotId=${id}`} className="rounded-lg bg-brand px-4 py-2 text-sm text-white">New Inspection</Link>
      </div>
    </div>
  );
}
