import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthLike = { getUser: () => Promise<{ data: { user: any }; error: any }> };

const VALID_INSPECTION_STATUSES = ["NOT_INSPECTED", "INSPECTION_IN_PROGRESS", "INSPECTED", "AWAITING_REVIEW", "REINSPECTION_REQUIRED"];

// PATCH /api/v1/assignments/[id]/areas — update area status
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as AuthLike).getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { id: assignmentId } = await params;
  const body = await req.json().catch(() => null);
  const { areaId, status, inspectionId } = body ?? {};

  if (!areaId || !status) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "areaId and status are required." } }, { status: 422 });
  }

  if (!VALID_INSPECTION_STATUSES.includes(status)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid status." } }, { status: 422 });
  }

  // Verify assignment exists and is active
  const { data: assignment } = await supabase
    .from("inspection_assignments")
    .select("id, status, assigned_to")
    .eq("id", assignmentId)
    .single();

  if (!assignment) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Assignment not found." } }, { status: 404 });
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
  if (inspectionId) updates.inspection_id = inspectionId;
  if (status === "INSPECTED" || status === "AWAITING_REVIEW") {
    updates.completed_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("assignment_areas")
    .update(updates)
    .eq("id", areaId);

  if (error) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update area." } }, { status: 500 });
  }

  // Update the geo unit's inspection status too
  await supabase
    .from("geographical_units")
    .update({ inspection_status: status })
    .eq("id", area.geo_unit_id);

  // Update assignment progress
  const { count: completedCount } = await supabase
    .from("assignment_areas")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId)
    .in("status", ["INSPECTED", "AWAITING_REVIEW"]);

  const { count: totalCount } = await supabase
    .from("assignment_areas")
    .select("id", { count: "exact", head: true })
    .eq("assignment_id", assignmentId);

  await supabase
    .from("inspection_assignments")
    .update({
      completed_areas: completedCount ?? 0,
      total_areas: totalCount ?? 0,
      status: (completedCount ?? 0) >= (totalCount ?? 0) && (totalCount ?? 0) > 0 ? "COMPLETED" : assignment.status,
    })
    .eq("id", assignmentId);

  // Record status history
  await supabase.from("plot_status_history").insert({
    plot_id: area.geo_unit_id,
    changed_by: user.id,
    field: "inspection_status",
    new_value: status,
    reason: `Assignment ${assignmentId} area update`,
  });

  await auditLog({ action: "UPDATE_ASSIGNMENT_AREA", entityType: "assignment_area", entityId: areaId, metadata: { status } });

  return NextResponse.json({ success: true, data: { areaId, status } });
}
