import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import StatusActions from "@/components/plot/StatusActions";
import StatusHistory from "@/components/plot/StatusHistory";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthLike = { getUser: () => Promise<{ data: { user: any }; error: any }> };

const approvalVariant: Record<string, "success" | "warning" | "danger" | "muted"> = {
  APPROVED: "success",
  APPROVED_WITH_CONDITIONS: "success",
  PENDING: "warning",
  REJECTED: "danger",
  NOT_REVIEWED: "muted",
};

const inspectionVariant: Record<string, "info" | "warning" | "muted" | "danger"> = {
  INSPECTION_IN_PROGRESS: "info",
  INSPECTED: "warning",
  AWAITING_REVIEW: "warning",
  REINSPECTION_REQUIRED: "danger",
  NOT_INSPECTED: "muted",
};

function label(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function PlotDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // Get user role
  const { data: { user } } = await (supabase.auth as AuthLike).getUser();
  let userRole = "ENGINEER";
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
    userRole = profile?.role ?? "ENGINEER";
  }

  const { data: plot } = await supabase
    .from("plots")
    .select(`
      id, plot_number, plot_reference, plot_size, plot_size_unit,
      street, land_use, latitude, longitude, status, is_demo,
      inspection_status, approval_status,
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
        <Card><CardContent className="text-sm text-muted-foreground">Plot not found.</CardContent></Card>
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

  const inspStatus = plot.inspection_status ?? "NOT_INSPECTED";
  const apprStatus = plot.approval_status ?? "NOT_REVIEWED";

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/map" className="text-sm text-brand hover:underline">← Back to Map</Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Plot {plot.plot_number}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Block {block?.block_number ?? "—"} • {estate?.name ?? "—"} • {plot.plot_size} {plot.plot_size_unit}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={inspectionVariant[inspStatus] ?? "muted"}>
            <span className="mr-1.5 inline-block w-2 h-2 rounded-full" style={{
              background: inspStatus === "INSPECTED" ? "#f97316" :
                          inspStatus === "AWAITING_REVIEW" ? "#fbbf24" :
                          inspStatus === "INSPECTION_IN_PROGRESS" ? "#60a5fa" :
                          inspStatus === "REINSPECTION_REQUIRED" ? "#a855f7" : "#d1d5db"
            }} />
            {label(inspStatus)}
          </Badge>
          <Badge variant={approvalVariant[apprStatus] ?? "muted"}>
            <span className="mr-1.5 inline-block w-2 h-2 rounded-full" style={{
              background: apprStatus === "APPROVED" ? "#10b981" :
                          apprStatus === "APPROVED_WITH_CONDITIONS" ? "#34d399" :
                          apprStatus === "PENDING" ? "#facc15" :
                          apprStatus === "REJECTED" ? "#ef4444" : "#94a3b8"
            }} />
            {label(apprStatus)}
          </Badge>
        </div>
      </div>

      {/* Role-based actions */}
      <StatusActions
        plotId={id}
        inspectionStatus={inspStatus}
        approvalStatus={apprStatus}
        userRole={userRole}
      />

      {/* Property + Approval info */}
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader><h3 className="font-semibold text-foreground">Property</h3></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            <p><span className="text-muted-foreground">Estate:</span> {estate?.name ?? "—"}</p>
            <p><span className="text-muted-foreground">Street:</span> {plot.street ?? "—"}</p>
            <p><span className="text-muted-foreground">Land Use:</span> {plot.land_use ?? "—"}</p>
            <p><span className="text-muted-foreground">Reference:</span> {plot.plot_reference ?? "—"}</p>
            {interests[0] && (
              <p><span className="text-muted-foreground">Allottee:</span> {interests[0].name} ({interests[0].allocation_number})</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><h3 className="font-semibold text-foreground">Approval Record</h3></CardHeader>
          <CardContent className="text-sm space-y-1.5">
            {activeApproval ? (
              <>
                <p><span className="text-muted-foreground">Number:</span> {activeApproval.approval_number}</p>
                <p><span className="text-muted-foreground">Date:</span> {activeApproval.approval_date} — Valid until {activeApproval.valid_until}</p>
                <p><span className="text-muted-foreground">Development:</span> {activeApproval.development_type} — {activeApproval.approved_floors} floors / {activeApproval.approved_units} units</p>
                {activeApproval.conditions && <p className="text-xs text-muted-foreground mt-1">{activeApproval.conditions}</p>}
                <p className="text-xs text-muted-foreground/60 mt-2">Record Found — not a legal determination</p>
              </>
            ) : (
              <p className="text-muted-foreground">No approval on record</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Status history */}
      <StatusHistory plotId={id} />

      {/* Quick links */}
      <div className="flex gap-3 flex-wrap">
        <Link href={`/map?plot=${id}`} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">View on Map</Link>
        <Link href={`/approvals?plotId=${id}`} className="rounded-xl border border-border bg-surface px-4 py-2 text-sm font-medium hover:bg-muted transition-colors">Verify Approval</Link>
        <Link href={`/inspections/new?plotId=${id}`} className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-md shadow-brand/15 hover:bg-brand-light transition-all">New Inspection</Link>
      </div>
    </div>
  );
}
