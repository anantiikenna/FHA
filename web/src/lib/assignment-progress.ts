import type { SupabaseClient } from "@supabase/supabase-js";

// Domain service: assignment progress bar.
// Progress = assignment_areas in (INSPECTED, AWAITING_REVIEW) / total_areas.
// Shared by the manual assignment-areas route and by the inspection/plot status
// hooks, so real field work (map -> inspection -> submit -> review) fills the bar.

const AREA_RANK: Record<string, number> = {
  NOT_INSPECTED: 0,
  INSPECTION_IN_PROGRESS: 1,
  REINSPECTION_REQUIRED: 1,
  AWAITING_REVIEW: 2,
  INSPECTED: 3,
};

const COMPLETED_STATUSES = ["INSPECTED", "AWAITING_REVIEW"];

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

/** Recompute completed_areas/total_areas and close the assignment when every area is done. */
export async function recomputeAssignmentProgress(
  supabase: SupabaseClient,
  assignmentId: string
): Promise<void> {
  try {
    const { count: completedCount } = await supabase
      .from("assignment_areas")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId)
      .in("status", COMPLETED_STATUSES);

    const { count: totalCount } = await supabase
      .from("assignment_areas")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId);

    const { data: assignment } = await supabase
      .from("inspection_assignments")
      .select("status")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || assignment.status === "CANCELLED") return;

    const completed = completedCount ?? 0;
    const total = totalCount ?? 0;
    const newStatus = total > 0 && completed >= total ? "COMPLETED" : assignment.status;

    await supabase
      .from("inspection_assignments")
      .update({ completed_areas: completed, total_areas: total, status: newStatus })
      .eq("id", assignmentId);
  } catch {
    // progress sync is best-effort — never fail the caller's main action
  }
}

/**
 * Apply a plot-level status to every assignment area covering that plot.
 * Rank-guarded: statuses only move forward (never lose progress), except
 * REINSPECTION_REQUIRED which reopens already-started work on request.
 * Then recomputes each affected assignment's progress.
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

    // Mirror the manual areas route: keep the geo unit's status in step (non-fatal)
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
