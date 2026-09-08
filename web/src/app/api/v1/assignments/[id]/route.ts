import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

  const { data: assignment, error } = await supabase
    .from("inspection_assignments")
    .select(`
      id, assignment_number, title, description, status, priority,
      target_date, started_at, completed_at, total_areas, completed_areas,
      created_at,
      geo_unit:geographical_units(id, name, unit_type, code),
      assignee:profiles!inspection_assignments_assigned_to_fkey(id, display_name, email),
      creator:profiles!inspection_assignments_created_by_fkey(display_name, email)
    `)
    .eq("id", id)
    .single();

  if (error || !assignment) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Assignment not found." } }, { status: 404 });
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

  return NextResponse.json({
    success: true,
    data: { ...assignment, areas: areas ?? [] },
  });
}
