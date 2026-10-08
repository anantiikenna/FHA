// Derive a readable "who did what, when" activity summary from
// map_area_status_history rows (AGENTS §14 auditability). Pure function —
// the API fetches rows, this turns them into UI facts (AGENTS §22).

export interface AreaHistoryRow {
  id: string;
  area_id: string;
  field: string;
  old_value: string | null;
  new_value: string;
  created_at: string;
  changed_by?: { display_name?: string | null } | null;
}

export interface AreaActivityEvent {
  field: "status" | "property_outcome";
  label: string;
  actor: string;
  at: string;
}

export interface AreaActivity {
  submittedBy: string | null;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedAction: "APPROVED" | "REJECTED" | null;
  reviewedAt: string | null;
  reinspectionBy: string | null;
  reinspectionAt: string | null;
  latestOutcome: { label: string; state: string; actor: string; at: string } | null;
  events: AreaActivityEvent[];
}

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Zone activated",
  AWAITING_OUTCOME: "Awaiting outcome",
  APPROVED_PROPERTY: "Approved property recorded",
  EMPTY_UNOCCUPIED: "Unoccupied property recorded",
  UNAPPROVED_PROPERTY: "Unapproved property recorded",
  SET_FOR_DEMOLITION: "Demolition outcome recorded",
  // Legacy rows (pre-Oct 2026 workflow):
  DRAFT: "Saved as draft",
  IN_PROGRESS: "Marked in progress",
  AWAITING_REVIEW: "Submitted for approval",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REINSPECTION_REQUIRED: "Re-inspection requested",
};

function actorOf(row: AreaHistoryRow): string {
  return row.changed_by?.display_name || "Unknown user";
}

/** "ACCEPTED · Unoccupied property" -> { state, label } (or null). */
export function splitOutcomeValue(value: string): { state: string; label: string } | null {
  const idx = value.indexOf(" · ");
  if (idx === -1) return null;
  const state = value.slice(0, idx).trim();
  const label = value.slice(idx + 3).trim();
  return state && label ? { state, label } : null;
}

/**
 * Build the activity facts for one area from its history rows (any order —
 * sorted newest-first internally). First occurrence wins for each category.
 */
export function deriveAreaActivity(rows: AreaHistoryRow[], eventLimit = 6): AreaActivity {
  const sorted = [...rows].sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0));

  const activity: AreaActivity = {
    submittedBy: null,
    submittedAt: null,
    reviewedBy: null,
    reviewedAction: null,
    reviewedAt: null,
    reinspectionBy: null,
    reinspectionAt: null,
    latestOutcome: null,
    events: [],
  };

  for (const row of sorted) {
    const actor = actorOf(row);
    if (row.field === "status") {
      if (row.new_value === "AWAITING_REVIEW" && activity.submittedBy === null) {
        activity.submittedBy = actor;
        activity.submittedAt = row.created_at;
      }
      if (
        (row.new_value === "APPROVED" || row.new_value === "REJECTED") &&
        activity.reviewedAction === null
      ) {
        activity.reviewedBy = actor;
        activity.reviewedAction = row.new_value;
        activity.reviewedAt = row.created_at;
      }
      if (row.new_value === "REINSPECTION_REQUIRED" && activity.reinspectionBy === null) {
        activity.reinspectionBy = actor;
        activity.reinspectionAt = row.created_at;
      }
    } else if (row.field === "property_outcome" && activity.latestOutcome === null) {
      const parsed = splitOutcomeValue(row.new_value);
      if (parsed) {
        activity.latestOutcome = { label: parsed.label, state: parsed.state, actor, at: row.created_at };
      }
    }
  }

  activity.events = sorted.slice(0, eventLimit).map((row) => {
    if (row.field === "property_outcome") {
      const parsed = splitOutcomeValue(row.new_value);
      return {
        field: "property_outcome" as const,
        label: parsed ? `${parsed.label} — ${parsed.state.toLowerCase()}` : row.new_value,
        actor: actorOf(row),
        at: row.created_at,
      };
    }
    return {
      field: "status" as const,
      label: STATUS_LABELS[row.new_value] ?? `Status set to ${row.new_value}`,
      actor: actorOf(row),
      at: row.created_at,
    };
  });

  return activity;
}
