import type { SupabaseClient } from "@supabase/supabase-js";

// Domain service: assignment progress bar.
//
// Zone-backed assignments (created from a marked map zone) complete on
// SHARED ZONE COVERAGE: progress = zone plots covered by any officer's marked
// child areas / zone plots, scaled to ZONE_COVERAGE_TARGET. At >= target the
// assignment auto-COMPLETES (reopens to ACTIVE if coverage later drops).
// Drawing a child area counts immediately, regardless of its status.
//
// Legacy (non-zone) assignments keep the status-based count
// (assignment_areas in INSPECTED / AWAITING_REVIEW).
//
// All syncs are best-effort — they never fail the caller's main action.

/** Completion target (share of zone plots that must be covered). Provisional — for FHA confirmation. */
export const ZONE_COVERAGE_TARGET = 0.7;

/** Pure helper shared by the pages: coverage scaled to the target (70% coverage = 100%). */
export function zoneCoverageProgress(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round(((completed / total) / ZONE_COVERAGE_TARGET) * 100));
}

const AREA_RANK: Record<string, number> = {
  NOT_INSPECTED: 0,
  INSPECTION_IN_PROGRESS: 1,
  REINSPECTION_REQUIRED: 1,
  AWAITING_REVIEW: 2,
  INSPECTED: 3,
};

const COMPLETED_STATUSES = ["INSPECTED", "AWAITING_REVIEW"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function uuidList(value: unknown): string[] {
  return (Array.isArray(value) ? value : []).filter(
    (v): v is string => typeof v === "string" && UUID_RE.test(v)
  );
}

/** Inspection workflow status -> assignment-area status (null = no mapping). */
export function areaStatusForInspection(inspectionStatus: string): string | null {
  switch (inspectionStatus) {
    case "DRAFT":
      return "INSPECTION_IN_PROGRESS";
    case "SUBMITTED":
      return "AWAITING_REVIEW";
    case "UNDER_REVIEW":
    case "COMPLETED":
      return "INSPECTED";
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Zone coverage (shared across every officer assigned to the zone)
// ---------------------------------------------------------------------------

async function computeZoneCoverage(
  supabase: SupabaseClient,
  zoneId: string
): Promise<{ completed: number; total: number; geoUnitId: string | null } | null> {
  const { data: zone } = await supabase
    .from("map_areas")
    .select("plot_ids, metadata")
    .eq("id", zoneId)
    .maybeSingle();
  if (!zone) return null;

  const zonePlots = [...new Set(uuidList(zone.plot_ids))];
  const zoneSet = new Set(zonePlots);

  const { data: children } = await supabase
    .from("map_areas")
    .select("plot_ids")
    .eq("parent_area_id", zoneId);

  const covered = new Set<string>();
  for (const child of children ?? []) {
    for (const plotId of uuidList(child.plot_ids)) {
      if (zoneSet.has(plotId)) covered.add(plotId);
    }
  }

  const meta = zone.metadata && typeof zone.metadata === "object" ? (zone.metadata as Record<string, unknown>) : null;
  const geoUnitId = meta && typeof meta.geo_unit_id === "string" && UUID_RE.test(meta.geo_unit_id) ? meta.geo_unit_id : null;

  return { completed: zonePlots.length > 0 ? covered.size : 0, total: zonePlots.length, geoUnitId };
}

async function applyCoverageToAssignments(
  supabase: SupabaseClient,
  geoUnitId: string,
  completed: number,
  total: number
): Promise<void> {
  const coverage = total > 0 ? completed / total : 0;
  const target = coverage >= ZONE_COVERAGE_TARGET;

  const { data: assignments } = await supabase
    .from("inspection_assignments")
    .select("id, status")
    .eq("geo_unit_id", geoUnitId)
    .neq("status", "CANCELLED");

  for (const assignment of assignments ?? []) {
    const update: Record<string, unknown> = {
      completed_areas: completed,
      total_areas: total,
      status: target ? "COMPLETED" : assignment.status === "COMPLETED" ? "ACTIVE" : assignment.status,
    };
    if (target && assignment.status !== "COMPLETED") update.completed_at = new Date().toISOString();
    if (!target && assignment.status === "COMPLETED") update.completed_at = null;

    await supabase.from("inspection_assignments").update(update).eq("id", assignment.id);
  }
}

/** Recompute shared coverage for one zone and push it to every assignment on that zone. */
export async function recomputeZoneCoverageForZone(
  supabase: SupabaseClient,
  zoneId: string
): Promise<void> {
  try {
    const coverage = await computeZoneCoverage(supabase, zoneId);
    if (!coverage) return;
    if (!coverage.geoUnitId) return;
    await applyCoverageToAssignments(supabase, coverage.geoUnitId, coverage.completed, coverage.total);
  } catch {
    // best-effort — never fail the caller's main action
  }
}

/** Zone deleted: its covered work is gone — zero the bars and reopen any completed assignment. */
export async function resetCoverageForDeletedZone(
  supabase: SupabaseClient,
  geoUnitId: string
): Promise<void> {
  try {
    const { data: assignments } = await supabase
      .from("inspection_assignments")
      .select("id, status")
      .eq("geo_unit_id", geoUnitId)
      .neq("status", "CANCELLED");

    for (const assignment of assignments ?? []) {
      const update: Record<string, unknown> = { completed_areas: 0 };
      if (assignment.status === "COMPLETED") {
        update.status = "ACTIVE";
        update.completed_at = null;
      }
      await supabase.from("inspection_assignments").update(update).eq("id", assignment.id);
    }
  } catch {
    // best-effort
  }
}

// ---------------------------------------------------------------------------
// Per-assignment recompute (zone-aware; legacy fallback keeps status counting)
// ---------------------------------------------------------------------------

export async function recomputeAssignmentProgress(
  supabase: SupabaseClient,
  assignmentId: string
): Promise<void> {
  try {
    const { data: assignment } = await supabase
      .from("inspection_assignments")
      .select("id, status, geo_unit_id")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || assignment.status === "CANCELLED") return;

    // Zone-backed assignment → shared zone coverage drives the bar
    if (assignment.geo_unit_id) {
      const { data: zone } = await supabase
        .from("map_areas")
        .select("id")
        .eq("area_type", "INSPECTION_ZONE")
        .contains("metadata", { geo_unit_id: assignment.geo_unit_id })
        .limit(1)
        .maybeSingle();

      if (zone) {
        const coverage = await computeZoneCoverage(supabase, zone.id);
        if (coverage) {
          await applyCoverageToAssignments(supabase, assignment.geo_unit_id, coverage.completed, coverage.total);
        }
        return;
      }
    }

    // Legacy (non-zone) assignment → status-based count
    const { count: completedCount } = await supabase
      .from("assignment_areas")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId)
      .in("status", COMPLETED_STATUSES);

    const { count: totalCount } = await supabase
      .from("assignment_areas")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId);

    const completed = completedCount ?? 0;
    const total = totalCount ?? 0;
    const newStatus = total > 0 && completed >= total ? "COMPLETED" : assignment.status;

    await supabase
      .from("inspection_assignments")
      .update({ completed_areas: completed, total_areas: total, status: newStatus })
      .eq("id", assignmentId);
  } catch {
    // best-effort — never fail the caller's main action
  }
}

// ---------------------------------------------------------------------------
// Inspection status -> assignment area detail (does not drive the bar)
// ---------------------------------------------------------------------------

/**
 * Apply a plot-level status to every assignment area covering that plot
 * (per-plot inspection detail + geo-unit status; the bar itself only moves
 * when marked child areas change). Rank-guarded: statuses only move forward,
 * except REINSPECTION_REQUIRED which reopens already-started work.
 */
export async function syncAssignmentAreaFromPlot(
  supabase: SupabaseClient,
  opts: { plotId: string; areaStatus: string; inspectionId?: string }
): Promise<void> {
  try {
    const { plotId, areaStatus, inspectionId } = opts;
    const targetRank = AREA_RANK[areaStatus] ?? -1;
    if (targetRank < 0) return;

    const { data: rows } = await supabase
      .from("assignment_areas")
      .select("id, status, assignment_id")
      .eq("geo_unit_id", plotId);
    if (!rows || rows.length === 0) return;

    const affected = new Set<string>();

    for (const row of rows) {
      const currentRank = AREA_RANK[row.status] ?? 0;
      if (areaStatus === "REINSPECTION_REQUIRED") {
        if (currentRank < 1) continue;
      } else if (targetRank <= currentRank) {
        continue;
      }

      const update: Record<string, unknown> = { status: areaStatus };
      if (inspectionId) update.inspection_id = inspectionId;
      if (areaStatus === "INSPECTED" || areaStatus === "AWAITING_REVIEW") {
        update.completed_at = new Date().toISOString();
      }

      const { data: updated } = await supabase
        .from("assignment_areas")
        .update(update)
        .eq("id", row.id)
        .select("id");
      if (updated && updated.length > 0) affected.add(row.assignment_id);
    }

    if (affected.size === 0) return;

    // Keep the geo unit's status in step (non-fatal)
    await supabase
      .from("geographical_units")
      .update({ inspection_status: areaStatus })
      .eq("id", plotId);

    for (const assignmentId of affected) {
      await recomputeAssignmentProgress(supabase, assignmentId);
    }
  } catch {
    // best-effort — never fail the caller's main action
  }
}

/** After an inspection is deleted, reopen the assignment areas that referenced it. */
export async function revertAssignmentAreaForInspection(
  supabase: SupabaseClient,
  inspectionId: string
): Promise<void> {
  try {
    const { data: rows } = await supabase
      .from("assignment_areas")
      .select("id, assignment_id")
      .eq("inspection_id", inspectionId);
    if (!rows || rows.length === 0) return;

    const affected = new Set<string>();
    for (const row of rows) {
      const { data: updated } = await supabase
        .from("assignment_areas")
        .update({ status: "NOT_INSPECTED", completed_at: null, inspection_id: null })
        .eq("id", row.id)
        .select("id");
      if (updated && updated.length > 0) affected.add(row.assignment_id);
    }

    for (const assignmentId of affected) {
      await recomputeAssignmentProgress(supabase, assignmentId);
    }
  } catch {
    // best-effort — never fail the caller's main action
  }
}
