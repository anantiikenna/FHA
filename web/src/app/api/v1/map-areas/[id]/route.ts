import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { PROPERTY_OUTCOMES, isPropertyOutcomeType, readPropertyOutcome, recordPropertyOutcome, type PropertyOutcomeType } from "@/lib/property-outcome";

const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"];
const DRAWN_AREA_TYPES = ["ZONE", "PLOT", "PROPERTY"];

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
    .select("id, name, description, area_type, status, geojson, color, drawn_by, parent_area_id, plot_ids, metadata, created_at, updated_at")
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

  const isAdminRole = !!auth.role && ADMIN_ROLES.includes(auth.role);

  // Status is derived (zone → ACTIVE, leaf → outcome status) — clients cannot
  // set it directly any more (simplified workflow, owner decision Oct 2026).
  if ("status" in body) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION", message: "Status cannot be set directly — record a property outcome instead." } },
      { status: 422 }
    );
  }

  const propertyOutcomeInput =
    body.property_outcome && typeof body.property_outcome === "object"
      ? (body.property_outcome as Record<string, unknown>)
      : null;

  let allowed: string[];
  if (isAdminRole) {
    allowed = ["name", "description", "color", "area_type", "plot_ids", "metadata"];
  } else if (propertyOutcomeInput) {
    allowed = [];
  } else {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  if ("area_type" in updates && !DRAWN_AREA_TYPES.includes(String(updates.area_type))) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "area_type must be ZONE, PLOT, or PROPERTY." } },
      { status: 422 }
    );
  }

  if ("plot_ids" in updates) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    updates.plot_ids = (Array.isArray(updates.plot_ids) ? updates.plot_ids : [])
      .filter((v: unknown): v is string => typeof v === "string" && UUID_RE.test(v))
      .slice(0, 500);
  }

  // Property/plot outcome: direct one-step record (photo required for
  // PROPERTY, optional for PLOT) — a recorded field observation, never an
  // automated enforcement decision (AGENTS §8).
  if (propertyOutcomeInput) {
    if (!isPropertyOutcomeType(propertyOutcomeInput.type)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: `property_outcome.type must be one of: ${Object.keys(PROPERTY_OUTCOMES).join(", ")}.` } },
        { status: 422 }
      );
    }
    const type = propertyOutcomeInput.type as PropertyOutcomeType;

    const { data: areaRow } = await supabase
      .from("map_areas")
      .select("drawn_by, status, metadata, area_type")
      .eq("id", id)
      .maybeSingle();
    if (!areaRow) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
    }
    if (areaRow.area_type === "ZONE") {
      return NextResponse.json(
        { success: false, error: { code: "NO_OUTCOME_ON_ZONE", message: "Zones do not take property outcomes — record an outcome on a property or plot inside the zone." } },
        { status: 422 }
      );
    }
    // Authorization: admins/supervisors/GIS officers on any area; everyone
    // else only on areas they drew (matches map_areas_update_own RLS).
    if (!isAdminRole && areaRow.drawn_by !== auth.user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You can record a property outcome only on an area you drew." } },
        { status: 403 }
      );
    }

    // MANDATORY PHOTO for properties (owner decision): a property outcome
    // cannot be recorded without at least one evidence photo. Plots: optional.
    if (areaRow.area_type === "PROPERTY") {
      const { count: photoCount, error: photoCountError } = await supabase
        .from("map_area_photos")
        .select("id", { count: "exact", head: true })
        .eq("area_id", id);
      if (photoCountError) {
        return NextResponse.json(
          { success: false, error: { code: "QUERY_ERROR", message: "Could not verify area photos. Please try again." } },
          { status: 500 }
        );
      }
      if (!photoCount) {
        return NextResponse.json(
          { success: false, error: { code: "PHOTO_REQUIRED", message: "Add at least one photo of this property before recording a property outcome." } },
          { status: 422 }
        );
      }
    }

    const outcomeRecord = recordPropertyOutcome({
      type,
      userId: auth.user.id,
      role: auth.role,
      now: new Date().toISOString(),
    });

    const baseMeta =
      updates.metadata && typeof updates.metadata === "object"
        ? (updates.metadata as Record<string, unknown>)
        : areaRow.metadata && typeof areaRow.metadata === "object"
          ? (areaRow.metadata as Record<string, unknown>)
          : {};
    updates.metadata = { ...baseMeta, property_outcome: outcomeRecord };
    // Outcome IS the status for properties/plots (simplified model).
    updates.status = PROPERTY_OUTCOMES[type].status;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "No valid fields to update." } }, { status: 400 });
  }

  // Snapshot the pre-update values so the history records old → new.
  const { data: prevRow } = await supabase
    .from("map_areas")
    .select("status, metadata")
    .eq("id", id)
    .maybeSingle();

  const { data, error } = await supabase
    .from("map_areas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    // Technical detail stays server-side (AGENTS §17) — e.g. enum value not
    // yet added by live_update.sql shows here as 22P02.
    console.error("map_areas UPDATE failed:", error.code, error.message);
    return NextResponse.json({ success: false, error: { code: "UPDATE_ERROR", message: "Failed to update map area." } }, { status: 500 });
  }

  await auditLog({ action: "UPDATE_MAP_AREA", entityType: "map_area", entityId: id, metadata: updates });

  // Per-area history: every status and outcome change (AGENTS §14). Failure
  // is logged but does not fail the update.
  const historyRows: { field: string; old_value: string | null; new_value: string }[] = [];
  const newStatus = typeof updates.status === "string" ? updates.status : null;
  if (newStatus && prevRow && prevRow.status !== newStatus) {
    historyRows.push({ field: "status", old_value: prevRow.status, new_value: newStatus });
  }
  if (propertyOutcomeInput) {
    const prevOutcome = readPropertyOutcome(prevRow?.metadata);
    const savedOutcome = readPropertyOutcome(data.metadata);
    if (
      savedOutcome &&
      (!prevOutcome || prevOutcome.state !== savedOutcome.state || prevOutcome.type !== savedOutcome.type)
    ) {
      historyRows.push({
        field: "property_outcome",
        old_value: prevOutcome ? `${prevOutcome.state} · ${prevOutcome.label}` : null,
        new_value: `${savedOutcome.state} · ${savedOutcome.label}`,
      });
    }
  }
  for (const row of historyRows) {
    const { error: hErr } = await supabase.from("map_area_status_history").insert({
      area_id: id,
      changed_by: auth.user.id,
      ...row,
    });
    if (hErr) console.error("map_area_status_history insert failed:", hErr.code, hErr.message);
  }

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
  // Owners may still remove an area that has no recorded outcome yet.
  const isOwnDeletable = area.drawn_by === auth.user.id && area.status === "AWAITING_OUTCOME";
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
        { success: false, error: { code: "QUERY_ERROR", message: "Could not check the areas inside this area." } },
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
        { success: false, error: { code: "DELETE_ERROR", message: "Could not delete the areas inside this area." } },
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
            message: `Some areas inside could not be deleted (${removedDescendants} removed, ${remainingCount} remain). This area was not deleted.`,
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
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete area." } }, { status: 500 });
  }

  // RLS can silently filter deletes — verify a row was actually removed
  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete area." } }, { status: 500 });
  }

  await auditLog({ action: "DELETE_MAP_AREA", entityType: "map_area", entityId: id, metadata: { removedDescendants } });

  return NextResponse.json({ success: true, data: { id, removedDescendants } });
}
