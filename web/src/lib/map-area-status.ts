// Single source of truth for map-area status values (AGENTS §22/§23).
// Values are provisional until FHA confirms them. The database enum
// (map_area_status in supabase/Schema.sql + live_update.sql) must list the
// same values — covered by map-area-status.test.ts.
//
// Simplified model (owner decision, Oct 2026):
//   ZONE           → ACTIVE (always an active container, no outcome)
//   PLOT/PROPERTY  → AWAITING_OUTCOME until a direct outcome is recorded,
//                    then one of the four PROPERTY_OUTCOMES statuses.
// Legacy workflow statuses stay listed because the DB enum still carries
// them for rows written before the simplification.

/** Every valid map_areas.status value (DB enum mirror + audit messages). */
export const MAP_AREA_STATUSES: readonly string[] = [
  "ACTIVE",
  "AWAITING_OUTCOME",
  "APPROVED_PROPERTY",
  "EMPTY_UNOCCUPIED",
  "UNAPPROVED_PROPERTY",
  "SET_FOR_DEMOLITION",
  // Legacy values (pre-Oct 2026 rows) — no longer written by the app:
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
];

/** Statuses the app still writes for each drawn area type. */
export const ZONE_STATUSES: readonly string[] = ["ACTIVE"];
export const LEAF_STATUSES: readonly string[] = ["AWAITING_OUTCOME"];
