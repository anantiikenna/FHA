import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { syncAssignmentAreaFromPlot } from "@/lib/assignment-progress";
import { PROPERTY_OUTCOMES, isPropertyOutcomeType, readPropertyOutcome, type PropertyOutcomeType } from "@/lib/property-outcome";

const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"];
// Higher roles that can agree to / reject an officer's proposed property
// outcome — and record one straight to ACCEPTED.
const HIGHER_REVIEW_ROLES = ["APPROVAL_OFFICER", "SUPERVISOR", "ADMIN"];

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

// Walk parent_area_id up to the root zone; true when that zone is assigned
// to the given officer (zone.assignment_id or shared metadata.geo_unit_id).
async function isAssignedToRootZone(
  supabase: Awaited<ReturnType<typeof createClient>>,
  startParentId: string | null,
  userId: string
): Promise<boolean> {
  let parentId = startParentId;
  const seen = new Set<string>();
  for (let depth = 0; parentId && depth <= 20 && !seen.has(parentId); depth += 1) {
    seen.add(parentId);
    const { data } = await supabase
      .from("map_areas")
      .select("id, parent_area_id, area_type, assignment_id, metadata")
      .eq("id", parentId)
      .maybeSingle();
    const node = data as { id: string; parent_area_id: string | null; area_type: string; assignment_id: string | null; metadata: unknown } | null;
    if (!node) return false;
    if (node.area_type !== "INSPECTION_ZONE") {
      parentId = node.parent_area_id;
      continue;
    }
    const { data: myAssignments } = await supabase
      .from("inspection_assignments")
      .select("id, geo_unit_id")
      .eq("assigned_to", userId);
    const meta = node.metadata && typeof node.metadata === "object" ? (node.metadata as Record<string, unknown>) : null;
    const metaUnit = meta ? meta.geo_unit_id : undefined;
    return (myAssignments ?? []).some(
      (a: { id: string; geo_unit_id: string | null }) =>
        a.id === node.assignment_id || (typeof metaUnit === "string" && a.geo_unit_id === metaUnit)
    );
  }
  return false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("map_areas")
    .select("id, name, description, area_type, status, geojson, color, drawn_by, assignment_id, parent_area_id, plot_ids, metadata, created_at, updated_at")
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

  const VALID_STATUSES = ["DRAFT", "MARKED", "IN_PROGRESS", "INSPECTED", "AWAITING_REVIEW", "APPROVED", "REJECTED", "REINSPECTION_REQUIRED", "NON_COMPLIANT_OBSERVED", "AWAITING_OWNER", "EMPTY_UNOCCUPIED", "UNAPPROVED_PROPERTY", "SET_FOR_DEMOLITION"];
  // Engineers/approval officers may send status and/or property_outcome only.
  const isStatusOnly = Object.keys(body).every((k) => k === "status" || k === "property_outcome");
  const isApprovalOfficer = auth.role === "APPROVAL_OFFICER";
  const isEngineer = auth.role === "ENGINEER";
  const isHigherReview = !!auth.role && HIGHER_REVIEW_ROLES.includes(auth.role);
  // Engineers may only move their own areas through the submit/rework cycle,
  // including the field-outcome statuses (observations, not legal decisions)
  const ENGINEER_STATUSES = ["DRAFT", "IN_PROGRESS", "AWAITING_REVIEW", "REINSPECTION_REQUIRED", "NON_COMPLIANT_OBSERVED", "AWAITING_OWNER", "EMPTY_UNOCCUPIED", "UNAPPROVED_PROPERTY", "SET_FOR_DEMOLITION"];

  // Property outcome input (propose / agree / reject) — validated up front;
  // permission rules are applied after the role branches below.
  const propertyOutcomeInput =
    body.property_outcome && typeof body.property_outcome === "object"
      ? (body.property_outcome as Record<string, unknown>)
      : null;
  if (propertyOutcomeInput) {
    if (!isPropertyOutcomeType(propertyOutcomeInput.type)) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "property_outcome.type must be one of: UNOCCUPIED, UNAPPROVED, SET_FOR_DEMOLITION." } },
        { status: 422 }
      );
    }
    const action = propertyOutcomeInput.action;
    if (action !== "propose" && action !== "agree" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: "property_outcome.action must be propose, agree or reject." } },
        { status: 422 }
      );
    }
  }

  let allowed: string[];
  if (isApprovalOfficer) {
    // APPROVAL_OFFICER may only change status / review an outcome; full field
    // edits require ADMIN/SUPERVISOR/GIS_OFFICER
    if (!isStatusOnly) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Approval officers may only update status or review a property outcome." } },
        { status: 403 }
      );
    }
    allowed = ["status"];
  } else if (isEngineer) {
    if (!isStatusOnly) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Engineers may only update the status or property outcome of areas they drew." } },
        { status: 403 }
      );
    }
    if ("status" in body && (!body.status || !ENGINEER_STATUSES.includes(body.status))) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: `Engineers may set status to: ${ENGINEER_STATUSES.join(", ")}` } },
        { status: 422 }
      );
    }
    const { data: area } = await supabase
      .from("map_areas")
      .select("drawn_by, parent_area_id")
      .eq("id", id)
      .maybeSingle();
    if (!area) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
    }
    if (area.drawn_by !== auth.user.id) {
      // Exception: an officer assigned to the area's root zone may propose a
      // property outcome (with its paired status) on that zone's child areas.
      // Root-zone assignment itself is verified in the property_outcome block.
      const pairedStatuses = Object.values(PROPERTY_OUTCOMES).map((o) => o.status);
      const outcomePropose = !!propertyOutcomeInput && propertyOutcomeInput.action === "propose";
      const statusOk = !("status" in body) || pairedStatuses.includes(body.status);
      if (!outcomePropose || !statusOk) {
        return NextResponse.json(
          { success: false, error: { code: "FORBIDDEN", message: "You can only update areas you drew." } },
          { status: 403 }
        );
      }
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

  // Property outcome: officers propose (state PROPOSED), higher review roles
  // agree/reject — and a higher role recording an outcome is accepted
  // directly ("straight to ACCEPTED"). A field observation/recommendation
  // requiring human review, never an automated enforcement decision (AGENTS §8).
  if (propertyOutcomeInput) {
    const type = propertyOutcomeInput.type as PropertyOutcomeType;
    const action = propertyOutcomeInput.action as "propose" | "agree" | "reject";

    const { data: areaRow } = await supabase
      .from("map_areas")
      .select("drawn_by, status, metadata, parent_area_id")
      .eq("id", id)
      .maybeSingle();
    if (!areaRow) {
      return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
    }
    const currentOutcome = readPropertyOutcome(areaRow.metadata);

    if (action === "agree" || action === "reject") {
      if (!isHigherReview) {
        return NextResponse.json(
          { success: false, error: { code: "FORBIDDEN", message: "Only a review officer (approval officer, supervisor or admin) can agree to or reject a property outcome." } },
          { status: 403 }
        );
      }
      if (!currentOutcome || currentOutcome.state === "REJECTED") {
        return NextResponse.json(
          { success: false, error: { code: "NO_OUTCOME", message: "There is no property outcome awaiting review on this area." } },
          { status: 422 }
        );
      }
      if (action === "agree" && currentOutcome.state !== "PROPOSED") {
        return NextResponse.json(
          { success: false, error: { code: "OUTCOME_NOT_PENDING", message: "This property outcome has already been reviewed." } },
          { status: 422 }
        );
      }
    } else {
      // propose
      if (!isHigherReview) {
        if (currentOutcome?.state === "ACCEPTED") {
          return NextResponse.json(
            { success: false, error: { code: "OUTCOME_ACCEPTED", message: "This property outcome was already accepted by a review officer - ask them to change it." } },
            { status: 422 }
          );
        }
        if (areaRow.status === "AWAITING_REVIEW" || areaRow.status === "APPROVED") {
          return NextResponse.json(
            { success: false, error: { code: "OUTCOME_LOCKED", message: "This area is already with a review officer — only a review officer can record an outcome now." } },
            { status: 403 }
          );
        }
        if (areaRow.drawn_by !== auth.user.id) {
          const assignedToRoot = await isAssignedToRootZone(supabase, areaRow.parent_area_id, auth.user.id);
          if (!assignedToRoot) {
            return NextResponse.json(
              { success: false, error: { code: "FORBIDDEN", message: "You can only record a property outcome on your own area or inside a zone assigned to you." } },
              { status: 403 }
            );
          }
        }
      }
    }

    const now = new Date().toISOString();
    let outcomeRecord;
    if (action === "reject" && currentOutcome) {
      outcomeRecord = {
        ...currentOutcome,
        state: "REJECTED",
        rejected_by: auth.user.id,
        rejected_role: auth.role,
        rejected_at: now,
      };
    } else if (action === "agree" && currentOutcome) {
      outcomeRecord = {
        ...currentOutcome,
        state: "ACCEPTED",
        accepted_by: auth.user.id,
        accepted_role: auth.role,
        accepted_at: now,
      };
    } else {
      // propose — a higher review role records it as accepted immediately
      const state = isHigherReview ? "ACCEPTED" : "PROPOSED";
      outcomeRecord = {
        type,
        label: PROPERTY_OUTCOMES[type].label,
        state,
        proposed_by: auth.user.id,
        proposed_role: auth.role,
        proposed_at: now,
        ...(state === "ACCEPTED"
          ? { accepted_by: auth.user.id, accepted_role: auth.role, accepted_at: now }
          : {}),
      };
    }

    const baseMeta =
      updates.metadata && typeof updates.metadata === "object"
        ? (updates.metadata as Record<string, unknown>)
        : areaRow.metadata && typeof areaRow.metadata === "object"
          ? (areaRow.metadata as Record<string, unknown>)
          : {};
    updates.metadata = { ...baseMeta, property_outcome: outcomeRecord };
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
