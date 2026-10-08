// Property/plot outcome — a direct one-step field record (owner decision,
// Oct 2026): tap an outcome → add photo (property) → saved immediately with
// who/when. It is a recorded field observation/recommendation, never an
// automated enforcement order (AGENTS.md §8). Statuses/wording provisional
// until FHA confirms them.

export const PROPERTY_OUTCOMES = {
  APPROVED_PROPERTY: { status: "APPROVED_PROPERTY", label: "Approved property" },
  UNOCCUPIED: { status: "EMPTY_UNOCCUPIED", label: "Unoccupied property" },
  UNAPPROVED: { status: "UNAPPROVED_PROPERTY", label: "Unapproved property" },
  SET_FOR_DEMOLITION: { status: "SET_FOR_DEMOLITION", label: "Property set for demolition" },
} as const;

export type PropertyOutcomeType = keyof typeof PROPERTY_OUTCOMES;

/**
 * RECORDED — the current direct one-step record.
 * PROPOSED / ACCEPTED / REJECTED — legacy review-flow rows written before
 * Oct 2026; still readable so existing areas render their history correctly.
 */
export type PropertyOutcomeState = "RECORDED" | "PROPOSED" | "ACCEPTED" | "REJECTED";

export interface PropertyOutcomeRecord {
  type: PropertyOutcomeType;
  label: string;
  state: PropertyOutcomeState;
  /** Direct record (current flow). */
  recorded_by?: string | null;
  recorded_role?: string | null;
  recorded_at?: string | null;
  /** Legacy review flow (pre-Oct 2026 rows). */
  proposed_by?: string | null;
  proposed_role?: string | null;
  proposed_at?: string | null;
  accepted_by?: string | null;
  accepted_role?: string | null;
  accepted_at?: string | null;
  rejected_by?: string | null;
  rejected_role?: string | null;
  rejected_at?: string | null;
}

export function isPropertyOutcomeType(v: unknown): v is PropertyOutcomeType {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PROPERTY_OUTCOMES, v);
}

function isOutcomeState(v: unknown): v is PropertyOutcomeState {
  return v === "RECORDED" || v === "PROPOSED" || v === "ACCEPTED" || v === "REJECTED";
}

/** Read the outcome record out of a map_areas.metadata object (or null). */
export function readPropertyOutcome(metadata: unknown): PropertyOutcomeRecord | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = (metadata as Record<string, unknown>).property_outcome;
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  if (!isPropertyOutcomeType(r.type)) return null;
  if (!isOutcomeState(r.state)) return null;
  return r as unknown as PropertyOutcomeRecord;
}

/** Best available "when" for an outcome (direct or legacy rows). */
export function outcomeRecordedAt(o: PropertyOutcomeRecord): string | null {
  return o.recorded_at ?? o.accepted_at ?? o.proposed_at ?? o.rejected_at ?? null;
}

export interface RecordPropertyOutcomeParams {
  type: PropertyOutcomeType;
  userId: string;
  role: string | null;
  /** ISO timestamp of the record. */
  now: string;
}

/**
 * Compose a direct outcome record (AGENTS §22 — single place for outcome
 * construction; authorization and photo gating stay in the route).
 * Re-recording simply replaces the previous record — one step, no review.
 */
export function recordPropertyOutcome(p: RecordPropertyOutcomeParams): PropertyOutcomeRecord {
  return {
    type: p.type,
    label: PROPERTY_OUTCOMES[p.type].label,
    state: "RECORDED",
    recorded_by: p.userId,
    recorded_role: p.role,
    recorded_at: p.now,
  };
}
