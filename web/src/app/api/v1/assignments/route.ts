import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

import type { AuthLike } from "@/lib/supabase/types";

// GET /api/v1/assignments — list assignments (filtered by role)
export async function GET(req: Request) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const assignedTo = url.searchParams.get("assigned_to");

  let query = supabase
    .from("inspection_assignments")
    .select(`
      id, assignment_number, title, description, status, priority,
      target_date, started_at, completed_at, total_areas, completed_areas,
      created_at,
      geo_unit:geographical_units(id, name, unit_type, code),
      assignee:profiles!inspection_assignments_assigned_to_fkey(display_name, email)
    `)
    .order("created_at", { ascending: false });

  // Engineers see only their assignments — ignore any user-supplied assigned_to
  if (profile?.role === "ENGINEER") {
    query = query.eq("assigned_to", user.id);
  } else {
    // Privileged roles can filter by assigned_to
    if (assignedTo) query = query.eq("assigned_to", assignedTo);
  }

  if (status) query = query.eq("status", status);

  const { data: assignments, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch assignments." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { items: assignments } });
}

// POST /api/v1/assignments — create assignment
export async function POST(req: Request) {
  const supabase = await createClient();
  const postAuth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await postAuth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (!profile || !["SUPERVISOR", "ADMIN", "GIS_OFFICER"].includes(profile.role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Only Supervisors, Admins, or GIS Officers can create assignments." } }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const { title, description, geoUnitId, assignedTo, priority, targetDate, areaIds } = body ?? {};

  if (!title || !geoUnitId) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "title and geoUnitId are required." } }, { status: 422 });
  }

  // Generate assignment number with retry on collision
  let assignmentNumber = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const count = await supabase.from("inspection_assignments").select("id", { count: "exact", head: true });
    const num = (count.count ?? 0) + attempt + 1;
    assignmentNumber = `FHA/ASN/${new Date().getFullYear()}/${String(num).padStart(4, "0")}`;
    const { data: existing } = await supabase.from("inspection_assignments").select("id").eq("assignment_number", assignmentNumber).single();
    if (!existing) break;
  }

  // Get all plot-level descendants of the geo unit (or use selected areaIds)
  let plotIds: string[] = [];
  if (areaIds && areaIds.length > 0) {
    plotIds = areaIds;
  } else {
    // Recursively find all plots under this geo unit
    const { data: allUnits } = await supabase.rpc("get_all_descendant_plots", { p_unit_id: geoUnitId });
    if (allUnits) plotIds = allUnits.map((u: { id: string }) => u.id);
  }

  // Create assignment
  const { data: assignment, error: assignError } = await supabase
    .from("inspection_assignments")
    .insert({
      assignment_number: assignmentNumber,
      title,
      description: description || null,
      geo_unit_id: geoUnitId,
      assigned_to: assignedTo || null,
      created_by: user.id,
      status: "ACTIVE",
      priority: priority || "NORMAL",
      target_date: targetDate || null,
      total_areas: plotIds.length,
    })
    .select()
    .single();

  if (assignError) {
    return NextResponse.json({ success: false, error: { code: "CREATE_FAILED", message: "Failed to create assignment." } }, { status: 500 });
  }

  // Create assignment areas for each plot
  if (plotIds.length > 0) {
    const areas = plotIds.map((plotId, i) => ({
      assignment_id: assignment.id,
      geo_unit_id: plotId,
      sort_order: i + 1,
      status: "NOT_INSPECTED" as const,
    }));

    await supabase.from("assignment_areas").insert(areas);
  }

  await auditLog({ action: "CREATE_ASSIGNMENT", entityType: "assignment", entityId: assignment.id, metadata: { title, geoUnitId, assignedTo, plotCount: plotIds.length } });

  return NextResponse.json({ success: true, data: assignment }, { status: 201 });
}
