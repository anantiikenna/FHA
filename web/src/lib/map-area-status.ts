// Single source of truth for map-area status values (AGENTS §22/§23).
// Values are provisional until FHA confirms them. The database enum
// (map_area_status in supabase/Schema.sql + live_update.sql) must list the
// same values — covered by map-area-status.test.ts.

/** Every valid map_areas.status value (route validation + audit messages). */
export const MAP_AREA_STATUSES: readonly string[] = [
  "DRAFT",
  "MARKED",
  "IN_PROGRESS",
  "INSPECTED",
  "AWAITING_REVIEW",
  "APPROVED",
  "REJECTED",
  "REINSPECTION_REQUIRED",
  "NON_COMPLIANT_OBSERVED",
  "AWAITING_OWNER",
  "EMPTY_UNOCCUPIED",
  "UNAPPROVED_PROPERTY",
  "SET_FOR_DEMOLITION",
  "APPROVED_PROPERTY",
];

/** Statuses an ENGINEER may set on their own area — never APPROVED/REJECTED (no self-approval). */
export const ENGINEER_AREA_STATUSES: readonly string[] = [
  "DRAFT",
  "IN_PROGRESS",
  "AWAITING_REVIEW",
  "REINSPECTION_REQUIRED",
  "NON_COMPLIANT_OBSERVED",
  "AWAITING_OWNER",
  "EMPTY_UNOCCUPIED",
  "UNAPPROVED_PROPERTY",
  "SET_FOR_DEMOLITION",
  "APPROVED_PROPERTY",
];

/**
 * Section status -> its scoped plot rows (PATCH /map-areas/{id}).
 * Zone-level statuses and field/property outcomes never map to plot rows.
 */
export const SECTION_TO_PLOT_STATUS: Record<string, string> = {
  AWAITING_REVIEW: "AWAITING_REVIEW",
  APPROVED: "INSPECTED",
  REJECTED: "INSPECTED",
  REINSPECTION_REQUIRED: "REINSPECTION_REQUIRED",
};
