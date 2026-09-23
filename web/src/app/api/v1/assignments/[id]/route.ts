import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

import type { AuthLike } from "@/lib/supabase/types";

// GET /api/v1/assignments/[id] — get assignment with areas
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { id } = await params;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "User profile not found." } }, { status: 403 });
  }

  const { data: assignment, error } = await supabase
    .from("inspection_assignments")
    .select(`
      id, assignment_number, title, description, status, priority,
      target_date, started_at, completed_at, total_areas, completed_areas,
      created_at, assigned_to,
      geo_unit:geographical_units(id, name, unit_type, code),
      assignee:profiles!inspection_assignments_assigned_to_fkey(id, display_name, email),
      creator:profiles!inspection_assignments_created_by_fkey(display_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Assignment not found." } }, { status: 404 });
  }

  // Engineers: only their own assignments (prevents IDOR on other engineers' work)
  if (profile.role === "ENGINEER" && assignment.assigned_to !== user.id) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not your assignment." } }, { status: 403 });
  }

  // Get areas with geo unit details
  const { data: areas } = await supabase
    .from("assignment_areas")
    .select(`
      id, sort_order, status, completed_at,
      geo_unit:geographical_units(id, name, code, latitude, longitude, geometry, inspection_status, approval_status)
    `)
    .eq("assignment_id", id)
    .order("sort_order");

  const safeAssignment: Partial<typeof assignment> = { ...assignment };
  delete safeAssignment.assigned_to;
  return NextResponse.json({
    success: true,
    data: { ...safeAssignment, areas: areas ?? [] },
  });
}

// DELETE /api/v1/assignments/[id] — delete assignment (ADMIN/SUPERVISOR only)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const { data: assignment } = await supabase
    .from("inspection_assignments")
    .select("id, status")
    .eq("id", id)
    .single();

  if (!assignment) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Assignment not found." } }, { status: 404 });
  }

  if (assignment.status === "COMPLETED") {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Cannot delete a completed assignment." } }, { status: 403 });
  }

  const { data: deletedRows, error } = await supabase
    .from("inspection_assignments")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete assignment." } }, { status: 500 });
  }

  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete assignment." } }, { status: 500 });
  }

  await auditLog({ action: "DELETE_ASSIGNMENT", entityType: "assignment", entityId: id, metadata: {} });

  return NextResponse.json({ success: true });
}
