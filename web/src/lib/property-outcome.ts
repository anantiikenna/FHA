// Property outcome (field observation / recommendation on a child area)
// — proposed by the assigned officer, agreed by a higher role; higher roles
// are accepted directly. "Agreed" is a recorded review decision, never an
// automated enforcement order (AGENTS.md §8). Statuses/wording provisional
// until FHA confirms them.

export const PROPERTY_OUTCOMES = {
  UNOCCUPIED: { status: "EMPTY_UNOCCUPIED", label: "Unoccupied property" },
  UNAPPROVED: { status: "UNAPPROVED_PROPERTY", label: "Unapproved property" },
  SET_FOR_DEMOLITION: { status: "SET_FOR_DEMOLITION", label: "Property set for demolition" },
} as const;

export type PropertyOutcomeType = keyof typeof PROPERTY_OUTCOMES;
export type PropertyOutcomeState = "PROPOSED" | "ACCEPTED" | "REJECTED";

export interface PropertyOutcomeRecord {
  type: PropertyOutcomeType;
  label: string;
  state: PropertyOutcomeState;
  proposed_by: string | null;
  proposed_role: string | null;
  proposed_at: string;
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

/** Read the outcome record out of a map_areas.metadata object (or null). */
export function readPropertyOutcome(metadata: unknown): PropertyOutcomeRecord | null {
  if (!metadata || typeof metadata !== "object") return null;
  const record = (metadata as Record<string, unknown>).property_outcome;
  if (!record || typeof record !== "object") return null;
  const r = record as Record<string, unknown>;
  if (!isPropertyOutcomeType(r.type)) return null;
  if (r.state !== "PROPOSED" && r.state !== "ACCEPTED" && r.state !== "REJECTED") return null;
  return r as unknown as PropertyOutcomeRecord;
}
