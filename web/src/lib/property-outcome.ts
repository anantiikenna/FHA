// Property outcome (field observation / recommendation on a child area)
// — proposed by the assigned officer, agreed by a higher role; higher roles
// are accepted directly. "Agreed" is a recorded review decision, never an
// automated enforcement order (AGENTS.md §8). Statuses/wording provisional
// until FHA confirms them.

export const PROPERTY_OUTCOMES = {
  APPROVED_PROPERTY: { status: "APPROVED_PROPERTY", label: "Approved property" },
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

export interface BuildPropertyOutcomeParams {
  action: "propose" | "agree" | "reject";
  type: PropertyOutcomeType;
  /** The outcome currently stored on the area, or null when none exists. */
  currentOutcome: PropertyOutcomeRecord | null;
  /** True for APPROVAL_OFFICER / SUPERVISOR / ADMIN (proposals accepted directly). */
  isHigherReview: boolean;
  userId: string;
  role: string | null;
  /** ISO timestamp of the decision. */
  now: string;
}

/**
 * Compose the next property_outcome record (AGENTS §22 — single place for
 * outcome state transitions; authorization stays in the route).
 *
 * - propose  → PROPOSED (officer) or straight to ACCEPTED (higher review role).
 * - agree    → ACCEPTED on the pending record (keeps its proposed_* trail).
 * - reject   → REJECTED. When the requested type matches the recorded
 *              outcome, its proposed_* trail is preserved; otherwise the
 *              record is replaced (a higher role directly rejecting a
 *              different option, or rejecting with no record yet).
 */
export function buildPropertyOutcomeRecord(p: BuildPropertyOutcomeParams): PropertyOutcomeRecord {
  const { action, type, currentOutcome, isHigherReview, userId, role, now } = p;
  const sameType = currentOutcome !== null && currentOutcome.type === type;
  const keepProposal = sameType && currentOutcome ? currentOutcome : null;

  if (action === "reject") {
    return {
      type,
      label: PROPERTY_OUTCOMES[type].label,
      state: "REJECTED",
      // Preserve the officer's proposal only when rejecting that same type.
      proposed_by: keepProposal ? keepProposal.proposed_by : null,
      proposed_role: keepProposal ? keepProposal.proposed_role : null,
      proposed_at: keepProposal ? keepProposal.proposed_at : now,
      accepted_by: null,
      accepted_role: null,
      accepted_at: null,
      rejected_by: userId,
      rejected_role: role,
      rejected_at: now,
    };
  }

  if (action === "agree") {
    // Route validation guarantees a pending record of the same type; keep the
    // officer's proposed_* trail and stamp the review decision.
    return {
      type,
      label: PROPERTY_OUTCOMES[type].label,
      state: "ACCEPTED",
      proposed_by: currentOutcome ? currentOutcome.proposed_by : null,
      proposed_role: currentOutcome ? currentOutcome.proposed_role : null,
      proposed_at: currentOutcome ? currentOutcome.proposed_at : now,
      accepted_by: userId,
      accepted_role: role,
      accepted_at: now,
    };
  }

  // propose — a higher review role records it as accepted immediately
  const state = isHigherReview ? "ACCEPTED" : "PROPOSED";
  return {
    type,
    label: PROPERTY_OUTCOMES[type].label,
    state,
    proposed_by: userId,
    proposed_role: role,
    proposed_at: now,
    ...(state === "ACCEPTED"
      ? { accepted_by: userId, accepted_role: role, accepted_at: now }
      : {}),
  };
}
