import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { syncAssignmentAreaFromPlot } from "@/lib/assignment-progress";

const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"];

async function requireAuth() {
  const { user, profile } = await getProfile();
  if (!user) {
    return { error: NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 }) };
  }
  if (!profile) {
    return { error: NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 }) };
  }
  return { user, role: profile.role };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("map_areas")
    .select("id, name, description, area_type, status, geojson, color, drawn_by, assignment_id, plot_ids, metadata, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Invalid request body." } }, { status: 400 });
  }

  const VALID_STATUSES = ["DRAFT", "MARKED", "IN_PROGRESS", "INSPECTED", "AWAITING_REVIEW", "APPROVED", "REJECTED", "REINSPECTION_REQUIRED", "NON_COMPLIANT_OBSERVED", "AWAITING_OWNER", "EMPTY_UNOCCUPIED"];
  const isStatusOnly = Object.keys(body).length === 1 && "status" in body;
  const isApprovalOfficer = auth.role === "APPROVAL_OFFICER";
  const isEngineer = auth.role === "ENGINEER";
  // Engineers may only move their own areas through the submit/rework cycle,
  // including the field-outcome statuses (observations, not legal decisions)
  const ENGINEER_STATUSES = ["DRAFT", "IN_PROGRESS", "AWAITING_REVIEW", "REINSPECTION_REQUIRED", "NON_COMPLIANT_OBSERVED", "AWAITING_OWNER", "EMPTY_UNOCCUPIED"];

  let allowed: string[];
  if (isApprovalOfficer) {
    // APPROVAL_OFFICER may only change status; full field edits require ADMIN/SUPERVISOR/GIS_OFFICER
    if (!isStatusOnly) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Approval officers may only update status." } },
        { status: 403 }
      );
    }
    allowed = ["status"];
  } else if (isEngineer) {
    if (!isStatusOnly) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Engineers may only update the status of areas they drew." } },
        { status: 403 }
      );
    }
    if (!body.status || !ENGINEER_STATUSES.includes(body.status)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: `Engineers may set status to: ${ENGINEER_STATUSES.join(", ")}` } },
        { status: 422 }
      );
    }
    const { data: area } = await supabase
      .from("map_areas")
      .select("drawn_by")
      .eq("id", id)
      .maybeSingle();
    if (!area) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
    }
    if (area.drawn_by !== auth.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You can only update areas you drew." } },
        { status: 403 }
      );
    }
    allowed = ["status"];
  } else if (auth.role && ADMIN_ROLES.includes(auth.role)) {
    allowed = ["name", "description", "status", "color", "area_type", "assignment_id", "plot_ids", "metadata"];
  } else {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Validate status against enum
  if (updates.status && !VALID_STATUSES.includes(updates.status as string)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` } }, { status: 422 });
  }

  if ("plot_ids" in updates) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    updates.plot_ids = (Array.isArray(updates.plot_ids) ? updates.plot_ids : [])
      .filter((v: unknown): v is string => typeof v === "string" && UUID_RE.test(v))
      .slice(0, 500);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "No valid fields to update." } }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("map_areas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_ERROR", message: "Failed to update map area." } }, { status: 500 });
  }

  // Section status -> its scoped plot rows: submitted work is what counts
  // toward the assignment's own progress bar (WORKFLOWS v0.2 §6). Zone-level
  // statuses are their own workflow and never map to plot rows; field
  // outcomes are observations and never change a plot's status.
  const SECTION_TO_PLOT_STATUS: Record<string, string> = {
    AWAITING_REVIEW: "AWAITING_REVIEW",
    APPROVED: "INSPECTED",
    REJECTED: "INSPECTED",
    REINSPECTION_REQUIRED: "REINSPECTION_REQUIRED",
  };
  const plotStatus =
    typeof updates.status === "string" ? SECTION_TO_PLOT_STATUS[updates.status] : undefined;
  if (plotStatus && Array.isArray(data.plot_ids)) {
    for (const plotId of data.plot_ids) {
      if (typeof plotId !== "string") continue;
      // Rank-guarded; also recomputes every affected assignment's progress
      await syncAssignmentAreaFromPlot(supabase, { plotId, areaStatus: plotStatus });
    }
  }

  await auditLog({ action: "UPDATE_MAP_AREA", entityType: "map_area", entityId: id, metadata: updates });

  return NextResponse.json({ success: true, data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createClient();

  const { data: area } = await supabase
    .from("map_areas")
    .select("drawn_by, status, area_type, parent_area_id, metadata")
    .eq("id", id)
    .maybeSingle();
  if (!area) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
  }

  const isAdminRole = !!auth.role && ADMIN_ROLES.includes(auth.role);
  const isOwnDeletable =
    area.drawn_by === auth.user.id &&
    (area.status === "DRAFT" || area.status === "REINSPECTION_REQUIRED");
  if (!isAdminRole && !isOwnDeletable) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  // Collect every descendant (children, grandchildren, ...) level by level
  const descendantIds: string[] = [];
  const seen = new Set<string>([id]);
  let frontier = [id];
  while (frontier.length > 0) {
    const { data: kids, error: kidError } = await supabase
      .from("map_areas")
      .select("id")
      .in("parent_area_id", frontier);
    if (kidError) {
      return NextResponse.json(
        { success: false, error: { code: "QUERY_ERROR", message: "Could not check the field areas inside this area." } },
        { status: 500 }
      );
    }
    const next: string[] = [];
    for (const k of kids ?? []) {
      if (!seen.has(k.id)) {
        seen.add(k.id);
        next.push(k.id);
        descendantIds.push(k.id);
      }
    }
    frontier = next;
  }

  // Delete deepest first so RLS is checked on every row; the root is deleted last
  let removedDescendants = 0;
  const deepestFirst = [...descendantIds].reverse();
  for (let i = 0; i < deepestFirst.length; i += 50) {
    const batch = deepestFirst.slice(i, i + 50);
    const { data: delRows, error: delError } = await supabase
      .from("map_areas")
      .delete()
      .in("id", batch)
      .select("id");
    if (delError) {
      return NextResponse.json(
        { success: false, error: { code: "DELETE_ERROR", message: "Could not delete the field areas inside this area." } },
        { status: 500 }
      );
    }
    removedDescendants += delRows?.length ?? 0;
  }

  // RLS can silently filter deletes — verify all descendants are actually gone
  if (descendantIds.length > 0) {
    const { data: remaining } = await supabase
      .from("map_areas")
      .select("id")
      .in("id", descendantIds);
    const remainingCount = remaining?.length ?? 0;
    if (remainingCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "CHILDREN_BLOCKED",
            message: `Some field areas inside could not be deleted (${removedDescendants} removed, ${remainingCount} remain). This area was not deleted.`,
          },
        },
        { status: 409 }
      );
    }
  }

  const { data: deletedRows, error } = await supabase
    .from("map_areas")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete map area." } }, { status: 500 });
  }

  // RLS can silently filter deletes — verify a row was actually removed
  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete map area." } }, { status: 500 });
  }

  await auditLog({ action: "DELETE_MAP_AREA", entityType: "map_area", entityId: id, metadata: { removedDescendants } });

  return NextResponse.json({ success: true, data: { id, removedDescendants } });
}
