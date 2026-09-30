import type { SupabaseClient } from "@supabase/supabase-js";

// Domain service: assignment progress bar (WORKFLOWS v0.2 §6).
//
// Progress is PARTITIONED per assignment: each bar counts only that
// assignment's own rows — total = its scope (the plots assigned to that
// officer), completed = its submitted work. Other officers' work never
// moves this bar, and in-progress (draft) work never counts.
//
// Counted toward 100%: AWAITING_REVIEW, INSPECTED, REINSPECTION_REQUIRED
// (submitted-and-beyond statuses — provisional, for FHA confirmation).
//
// At 100% the assignment becomes READY_FOR_COMPLETION. It NEVER
// auto-completes: an authorized user (ADMIN/SUPERVISOR) marks it COMPLETED
// explicitly via PATCH /api/v1/assignments/[id] { action: "complete" }.
// CANCELLED and COMPLETED assignments are never reopened automatically.
//
// All syncs are best-effort — they never fail the caller's main action.

/** Work that counts toward progress: submitted-and-beyond per-plot statuses. */
const SUBMITTED_STATUSES = ["AWAITING_REVIEW", "INSPECTED", "REINSPECTION_REQUIRED"];

/** Forward-only ranking for plot/area status syncs (REINSPECTION reopens). */
const AREA_RANK: Record<string, number> = {
  NOT_INSPECTED: 0,
  INSPECTION_IN_PROGRESS: 1,
  REINSPECTION_REQUIRED: 1,
  AWAITING_REVIEW: 2,
  INSPECTED: 3,
};

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
// Per-assignment recompute (partitioned: counts only this assignment's rows)
// ---------------------------------------------------------------------------

export async function recomputeAssignmentProgress(
  supabase: SupabaseClient,
  assignmentId: string
): Promise<void> {
  try {
    const { data: assignment } = await supabase
      .from("inspection_assignments")
      .select("id, status")
      .eq("id", assignmentId)
      .maybeSingle();

    if (!assignment || assignment.status === "CANCELLED") return;

    const { count: completedCount } = await supabase
      .from("assignment_areas")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId)
      .in("status", SUBMITTED_STATUSES);

    const { count: totalCount } = await supabase
      .from("assignment_areas")
      .select("id", { count: "exact", head: true })
      .eq("assignment_id", assignmentId);

    const completed = completedCount ?? 0;
    const total = totalCount ?? 0;

    const update: Record<string, unknown> = {
      completed_areas: completed,
      total_areas: total,
    };

    // Manual-completion gate: 100% only ever moves ACTIVE -> READY_FOR_COMPLETION
    // (never to COMPLETED), and dropping below 100% reopens a pending gate.
    if (assignment.status !== "COMPLETED") {
      if (total > 0 && completed >= total) {
        if (assignment.status !== "READY_FOR_COMPLETION") update.status = "READY_FOR_COMPLETION";
      } else if (assignment.status === "READY_FOR_COMPLETION") {
        update.status = "ACTIVE";
      }
    }

    await supabase
      .from("inspection_assignments")
      .update(update)
      .eq("id", assignmentId);
  } catch {
    // best-effort — never fail the caller's main action
  }
}

// ---------------------------------------------------------------------------
// Inspection status -> assignment area detail (drives the bar via recompute)
// ---------------------------------------------------------------------------

/**
 * Apply a plot-level status to every assignment area covering that plot
 * (per-plot inspection detail + geo-unit status). Rank-guarded: statuses only
 * move forward, except REINSPECTION_REQUIRED which reopens already-started
 * work, and stale work that no longer counts can move back.
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
      if (SUBMITTED_STATUSES.includes(areaStatus)) {
        update.completed_at = new Date().toISOString();
      } else {
        update.completed_at = null;
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
