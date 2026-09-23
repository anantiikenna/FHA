import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { AuthLike } from "@/lib/supabase/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "User profile not found." } }, { status: 403 });
  }

  const { data: inspection, error } = await supabase
    .from("inspections")
    .select(`
      id, inspection_number, inspection_type, inspection_date,
      status, compliance_status, construction_stage,
      observed_floors, observed_units, observations, recommendations,
      latitude, longitude, gps_accuracy, inspector_id,
      plot:plots(id, plot_number, street),
      approval:approvals(approved_floors, approved_units)
    `)
    .eq("id", id)
    .single();

  if (error || !inspection) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } }, { status: 404 });
  }

  // Engineers: only their own inspections (GPS/PII scoping)
  const isPrivileged = ["ADMIN", "SUPERVISOR", "APPROVAL_OFFICER"].includes(profile.role);
  if (!isPrivileged && inspection.inspector_id !== user.id) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not your inspection." } }, { status: 403 });
  }

  const safeInspection: Partial<typeof inspection> = { ...inspection };
  delete safeInspection.inspector_id;
  return NextResponse.json({ success: true, data: safeInspection });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  // Fetch profile role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  const body = await req.json().catch(() => null);
  const status = body?.status;

  if (!status || !["SUBMITTED", "UNDER_REVIEW", "COMPLETED"].includes(status)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid status." } }, { status: 422 });
  }

  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, inspector_id, status")
    .eq("id", id)
    .single();

  if (!inspection) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } }, { status: 404 });
  }

  // Authorization: role-based status transitions
  const canTransition = (() => {
    if (status === "SUBMITTED" && inspection.inspector_id === user.id) return true;
    if (status === "UNDER_REVIEW" && (role === "SUPERVISOR" || role === "ADMIN")) return true;
    if (status === "COMPLETED" && (role === "SUPERVISOR" || role === "ADMIN" || role === "APPROVAL_OFFICER")) return true;
    return false;
  })();

  if (!canTransition) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized to perform this status change." } }, { status: 403 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "SUBMITTED") updates.submitted_at = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("inspections")
    .update(updates)
    .eq("id", id);

  if (updateError) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update inspection." } }, { status: 500 });
  }

  // Sync plot inspection_status based on inspection status transition
  const plotStatusMap: Record<string, string> = {
    SUBMITTED: "AWAITING_REVIEW",
    UNDER_REVIEW: "INSPECTED",
    COMPLETED: "INSPECTED",
  };
  const mappedPlotStatus = plotStatusMap[status];
  if (mappedPlotStatus) {
    const { data: insp } = await supabase
      .from("inspections")
      .select("plot_id")
      .eq("id", id)
      .single();
    if (insp?.plot_id) {
      await supabase
        .from("plots")
        .update({ inspection_status: mappedPlotStatus })
        .eq("id", insp.plot_id);
    }
  }

  await auditLog({ action: "UPDATE_INSPECTION_STATUS", entityType: "inspection", entityId: id, metadata: { new_status: status } });

  return NextResponse.json({ success: true, data: { id, status } });
}

// DELETE /api/v1/inspections/[id] — delete draft inspection (ADMIN/SUPERVISOR only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["ADMIN", "SUPERVISOR"].includes(profile.role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, status, plot_id")
    .eq("id", id)
    .single();

  if (!inspection) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } }, { status: 404 });
  }

  if (!["DRAFT", "SUBMITTED"].includes(inspection.status)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Can only delete draft or submitted inspections." } }, { status: 403 });
  }

  const plotId = inspection.plot_id;

  const { data: deletedRows, error } = await supabase
    .from("inspections")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete inspection." } }, { status: 500 });
  }

  // RLS can silently filter deletes — verify a row was actually removed
  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete inspection." } }, { status: 500 });
  }

  if (plotId) {
    const { count } = await supabase
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("plot_id", plotId);
    if ((count ?? 0) === 0) {
      await supabase
        .from("plots")
        .update({ inspection_status: "NOT_INSPECTED" })
        .eq("id", plotId);
    }
  }

  await auditLog({ action: "DELETE_INSPECTION", entityType: "inspection", entityId: id, metadata: {} });

  return NextResponse.json({ success: true });
}
