// Zone inspection-queue helpers — the one-at-a-time walk opens the next
// field area that has NOT yet been submitted or decided.
// Statuses are demo values until FHA confirms them (AGENTS.md §23).

export const SUBMITTED_STATUSES: ReadonlySet<string> = new Set([
  "AWAITING_REVIEW",
  "APPROVED",
  "REJECTED",
  "EMPTY_UNOCCUPIED",
  "UNAPPROVED_PROPERTY",
  "SET_FOR_DEMOLITION",
  "APPROVED_PROPERTY",
]);

/** True when a child area has been submitted for review or decided — it is
 *  no longer waiting in the zone's inspection queue. */
export function isAreaSubmitted(status: string | null | undefined): boolean {
  return !!status && SUBMITTED_STATUSES.has(status);
}
