import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { recomputeAssignmentProgress } from "@/lib/assignment-progress";

const VALID_INSPECTION_STATUSES = ["NOT_INSPECTED", "INSPECTION_IN_PROGRESS", "INSPECTED", "AWAITING_REVIEW", "REINSPECTION_REQUIRED"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH /api/v1/assignments/[id]/areas — update area status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, profile } = await getProfile();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }
  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 });
  }
  const role = profile.role;

  const { id: assignmentId } = await params;
  if (!UUID_RE.test(assignmentId)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid assignment ID format." } }, { status: 400 });
  }

  const body = await req.json().catch(() => null);
  const { areaId, status, inspectionId } = body ?? {};

  if (!areaId || !status) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "areaId and status are required." } }, { status: 422 });
  }

  if (!UUID_RE.test(areaId)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid areaId format." } }, { status: 422 });
  }

  if (!VALID_INSPECTION_STATUSES.includes(status)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid status." } }, { status: 422 });
  }

  if (inspectionId && !UUID_RE.test(inspectionId)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid inspectionId format." } }, { status: 422 });
  }

  const supabase = await createClient();

  // Verify assignment exists and is active
  const { data: assignment } = await supabase
    .from("inspection_assignments")
    .select("id, status, assigned_to")
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Assignment not found." } }, { status: 404 });
  }

  if (assignment.status === "COMPLETED" || assignment.status === "CANCELLED") {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Cannot update areas on a completed or cancelled assignment." } },
      { status: 403 }
    );
  }

  // Authorization: must be SUPERVISOR/ADMIN or the assigned engineer
  const isPrivileged = ["ADMIN", "SUPERVISOR"].includes(role);
  const isAssignee = assignment.assigned_to === user.id;
  if (!isPrivileged && !isAssignee) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "You can only update your own assigned areas." } }, { status: 403 });
  }

  // Verify the area belongs to this assignment
  const { data: area } = await supabase
    .from("assignment_areas")
    .select("id, geo_unit_id")
    .eq("id", areaId)
    .eq("assignment_id", assignmentId)
    .single();

  if (!area) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Area not found in this assignment." } }, { status: 404 });
  }

  // Update the area status
  const updates: Record<string, unknown> = { status };
  if (inspectionId) {
    // Verify the inspection exists
    const { data: inspection } = await supabase
      .from("inspections")
      .select("id, status")
      .eq("id", inspectionId)
      .single();
    if (!inspection) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } }, { status: 404 });
    }
    updates.inspection_id = inspectionId;
  }
  if (status === "INSPECTED" || status === "AWAITING_REVIEW") {
    updates.completed_at = new Date().toISOString();
  }

  const { error: areaError } = await supabase
    .from("assignment_areas")
    .update(updates)
    .eq("id", areaId)
    .select("id");

  if (areaError) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update area." } }, { status: 500 });
  }

  // RLS may filter the update — detect silent no-op
  const { data: verifyArea } = await supabase
    .from("assignment_areas")
    .select("id, status")
    .eq("id", areaId)
    .single();

  if (!verifyArea || verifyArea.status !== status) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update area." } }, { status: 500 });
  }

  // Update the geo unit's inspection status too (ignore if no UPDATE RLS — non-fatal for area save)
  await supabase
    .from("geographical_units")
    .update({ inspection_status: status })
    .eq("id", area.geo_unit_id);

  // Update assignment progress (engineer assignee needs UPDATE on own assignment)
  await recomputeAssignmentProgress(supabase, assignmentId);

  // Record status history (only if geo_unit_id maps to a real plot)
  const { data: plotCheck } = await supabase
    .from("plots")
    .select("id")
    .eq("id", area.geo_unit_id)
    .maybeSingle();
  if (plotCheck) {
    await supabase.from("plot_status_history").insert({
      plot_id: area.geo_unit_id,
      changed_by: user.id,
      field: "inspection_status",
      new_value: status,
      reason: `Assignment ${assignmentId} area update`,
    });
  }

  await auditLog({ action: "UPDATE_ASSIGNMENT_AREA", entityType: "assignment_area", entityId: areaId, metadata: { status } });

  return NextResponse.json({ success: true, data: { areaId, status } });
}
