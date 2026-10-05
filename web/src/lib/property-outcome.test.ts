import { describe, expect, it } from "vitest";
import { PROPERTY_OUTCOMES, buildPropertyOutcomeRecord, isPropertyOutcomeType, readPropertyOutcome } from "@/lib/property-outcome";

describe("PROPERTY_OUTCOMES", () => {
  it("maps each outcome type to its paired status and label", () => {
    expect(PROPERTY_OUTCOMES.APPROVED_PROPERTY.status).toBe("APPROVED_PROPERTY");
    expect(PROPERTY_OUTCOMES.APPROVED_PROPERTY.label).toBe("Approved property");
    expect(PROPERTY_OUTCOMES.UNOCCUPIED.status).toBe("EMPTY_UNOCCUPIED");
    expect(PROPERTY_OUTCOMES.UNAPPROVED.status).toBe("UNAPPROVED_PROPERTY");
    expect(PROPERTY_OUTCOMES.SET_FOR_DEMOLITION.status).toBe("SET_FOR_DEMOLITION");
    expect(PROPERTY_OUTCOMES.UNOCCUPIED.label).toBe("Unoccupied property");
    expect(PROPERTY_OUTCOMES.UNAPPROVED.label).toBe("Unapproved property");
    expect(PROPERTY_OUTCOMES.SET_FOR_DEMOLITION.label).toBe("Property set for demolition");
  });

  it("has exactly four outcome types", () => {
    expect(Object.keys(PROPERTY_OUTCOMES)).toHaveLength(4);
  });
});

describe("isPropertyOutcomeType", () => {
  it("accepts the four known types", () => {
    expect(isPropertyOutcomeType("APPROVED_PROPERTY")).toBe(true);
    expect(isPropertyOutcomeType("UNOCCUPIED")).toBe(true);
    expect(isPropertyOutcomeType("UNAPPROVED")).toBe(true);
    expect(isPropertyOutcomeType("SET_FOR_DEMOLITION")).toBe(true);
  });

  it("rejects unknown strings, wrong case and prototype keys", () => {
    expect(isPropertyOutcomeType("unoccupied")).toBe(false);
    expect(isPropertyOutcomeType("ALIEN_PROPERTY")).toBe(false);
    expect(isPropertyOutcomeType("")).toBe(false);
    // hasOwnProperty guard — must not pass inherited Object members
    expect(isPropertyOutcomeType("toString")).toBe(false);
    expect(isPropertyOutcomeType("constructor")).toBe(false);
    expect(isPropertyOutcomeType("__proto__")).toBe(false);
  });

  it("rejects non-strings", () => {
    expect(isPropertyOutcomeType(null)).toBe(false);
    expect(isPropertyOutcomeType(undefined)).toBe(false);
    expect(isPropertyOutcomeType(42)).toBe(false);
    expect(isPropertyOutcomeType({ type: "UNOCCUPIED" })).toBe(false);
  });
});

describe("readPropertyOutcome", () => {
  const valid = {
    type: "UNOCCUPIED",
    label: "Unoccupied property",
    state: "PROPOSED",
    proposed_by: "user-1",
    proposed_role: "ENGINEER",
    proposed_at: "2026-10-02T10:00:00.000Z",
  };

  it("returns a valid PROPOSED record with all fields", () => {
    const out = readPropertyOutcome({ property_outcome: valid });
    expect(out).not.toBeNull();
    expect(out?.type).toBe("UNOCCUPIED");
    expect(out?.state).toBe("PROPOSED");
    expect(out?.proposed_by).toBe("user-1");
    expect(out?.proposed_at).toBe("2026-10-02T10:00:00.000Z");
  });

  it("returns ACCEPTED and REJECTED records (review outcome trail)", () => {
    const accepted = readPropertyOutcome({
      property_outcome: { ...valid, state: "ACCEPTED", accepted_by: "user-2", accepted_role: "SUPERVISOR" },
    });
    expect(accepted?.state).toBe("ACCEPTED");
    expect(accepted?.accepted_role).toBe("SUPERVISOR");

    const rejected = readPropertyOutcome({
      property_outcome: { ...valid, state: "REJECTED", rejected_by: "user-3", rejected_role: "APPROVAL_OFFICER" },
    });
    expect(rejected?.state).toBe("REJECTED");
    expect(rejected?.rejected_by).toBe("user-3");
  });

  it("returns null for missing or malformed metadata", () => {
    expect(readPropertyOutcome(null)).toBeNull();
    expect(readPropertyOutcome(undefined)).toBeNull();
    expect(readPropertyOutcome("nope")).toBeNull();
    expect(readPropertyOutcome(42)).toBeNull();
    expect(readPropertyOutcome({})).toBeNull();
    expect(readPropertyOutcome({ property_outcome: null })).toBeNull();
    expect(readPropertyOutcome({ property_outcome: "UNOCCUPIED" })).toBeNull();
  });

  it("returns null when the type is unknown", () => {
    expect(readPropertyOutcome({ property_outcome: { ...valid, type: "ALIEN" } })).toBeNull();
  });

  it("returns null when the state is invalid", () => {
    expect(readPropertyOutcome({ property_outcome: { ...valid, state: "PENDING" } })).toBeNull();
    expect(readPropertyOutcome({ property_outcome: { ...valid, state: "APPROVED" } })).toBeNull();
    expect(readPropertyOutcome({ property_outcome: { ...valid, state: undefined } })).toBeNull();
  });
});

describe("buildPropertyOutcomeRecord", () => {
  const NOW = "2026-10-05T10:00:00.000Z";
  const base = {
    type: "UNOCCUPIED" as const,
    currentOutcome: null,
    userId: "user-eng",
    role: "ENGINEER",
    now: NOW,
  };

  it("propose by an officer creates a PROPOSED record", () => {
    const rec = buildPropertyOutcomeRecord({ ...base, action: "propose", isHigherReview: false });
    expect(rec).toMatchObject({
      type: "UNOCCUPIED",
      label: "Unoccupied property",
      state: "PROPOSED",
      proposed_by: "user-eng",
      proposed_role: "ENGINEER",
      proposed_at: NOW,
    });
    expect(rec.accepted_by).toBeUndefined();
    expect(rec.rejected_by).toBeUndefined();
  });

  it("propose by a higher review role goes straight to ACCEPTED with decision stamps", () => {
    const rec = buildPropertyOutcomeRecord({
      ...base,
      action: "propose",
      isHigherReview: true,
      userId: "user-admin",
      role: "ADMIN",
    });
    expect(rec.state).toBe("ACCEPTED");
    expect(rec.proposed_by).toBe("user-admin");
    expect(rec.accepted_by).toBe("user-admin");
    expect(rec.accepted_role).toBe("ADMIN");
    expect(rec.accepted_at).toBe(NOW);
  });

  it("agree keeps the officer's proposed_* trail and stamps the review decision", () => {
    const current = buildPropertyOutcomeRecord({ ...base, action: "propose", isHigherReview: false });
    const rec = buildPropertyOutcomeRecord({
      ...base,
      action: "agree",
      isHigherReview: true,
      currentOutcome: current,
      userId: "user-officer",
      role: "APPROVAL_OFFICER",
    });
    expect(rec.state).toBe("ACCEPTED");
    expect(rec.proposed_by).toBe("user-eng");
    expect(rec.proposed_role).toBe("ENGINEER");
    expect(rec.accepted_by).toBe("user-officer");
    expect(rec.accepted_role).toBe("APPROVAL_OFFICER");
  });

  it("direct reject with no prior record creates a fresh REJECTED record (bypass flow)", () => {
    const rec = buildPropertyOutcomeRecord({
      ...base,
      action: "reject",
      isHigherReview: true,
      type: "SET_FOR_DEMOLITION",
      userId: "user-admin",
      role: "ADMIN",
    });
    expect(rec).toMatchObject({
      type: "SET_FOR_DEMOLITION",
      label: "Property set for demolition",
      state: "REJECTED",
      rejected_by: "user-admin",
      rejected_role: "ADMIN",
      rejected_at: NOW,
    });
    expect(rec.proposed_by).toBeNull();
    expect(rec.proposed_role).toBeNull();
    expect(rec.accepted_by).toBeNull();
  });

  it("reject of the same pending type preserves the officer's proposed_* trail", () => {
    const current = buildPropertyOutcomeRecord({ ...base, action: "propose", isHigherReview: false });
    const rec = buildPropertyOutcomeRecord({
      ...base,
      action: "reject",
      isHigherReview: true,
      currentOutcome: current,
      userId: "user-officer",
      role: "APPROVAL_OFFICER",
    });
    expect(rec.state).toBe("REJECTED");
    expect(rec.proposed_by).toBe("user-eng");
    expect(rec.proposed_at).toBe(NOW);
    expect(rec.rejected_by).toBe("user-officer");
    expect(rec.accepted_by).toBeNull();
  });

  it("rejecting a previously accepted outcome clears the acceptance stamps", () => {
    const accepted = buildPropertyOutcomeRecord({
      ...base,
      action: "propose",
      isHigherReview: true,
      userId: "user-admin",
      role: "ADMIN",
    });
    expect(accepted.accepted_by).toBe("user-admin");
    const rec = buildPropertyOutcomeRecord({
      ...base,
      action: "reject",
      isHigherReview: true,
      currentOutcome: accepted,
      userId: "user-officer",
      role: "APPROVAL_OFFICER",
    });
    expect(rec.state).toBe("REJECTED");
    expect(rec.accepted_by).toBeNull();
    expect(rec.accepted_at).toBeNull();
    expect(rec.rejected_by).toBe("user-officer");
  });

  it("direct reject of a different type replaces the record instead of mislabeling it", () => {
    const current = buildPropertyOutcomeRecord({ ...base, action: "propose", isHigherReview: false });
    const rec = buildPropertyOutcomeRecord({
      ...base,
      action: "reject",
      isHigherReview: true,
      currentOutcome: current,
      type: "UNAPPROVED",
      userId: "user-admin",
      role: "ADMIN",
    });
    expect(rec.type).toBe("UNAPPROVED");
    expect(rec.label).toBe("Unapproved property");
    expect(rec.state).toBe("REJECTED");
    expect(rec.proposed_by).toBeNull();
    expect(rec.rejected_by).toBe("user-admin");
  });

  it("reject after a prior rejection re-stamps the record for the requested type", () => {
    const rejected = buildPropertyOutcomeRecord({
      ...base,
      action: "reject",
      isHigherReview: true,
      userId: "user-officer",
      role: "APPROVAL_OFFICER",
    });
    const rec = buildPropertyOutcomeRecord({
      ...base,
      action: "reject",
      isHigherReview: true,
      currentOutcome: rejected,
      type: "APPROVED_PROPERTY",
      userId: "user-admin",
      role: "ADMIN",
    });
    expect(rec.type).toBe("APPROVED_PROPERTY");
    expect(rec.state).toBe("REJECTED");
    expect(rec.rejected_by).toBe("user-admin");
    expect(rec.proposed_by).toBeNull();
  });

  it("labels always come from PROPERTY_OUTCOMES for the requested type", () => {
    for (const key of Object.keys(PROPERTY_OUTCOMES) as (keyof typeof PROPERTY_OUTCOMES)[]) {
      const rec = buildPropertyOutcomeRecord({ ...base, action: "propose", type: key, isHigherReview: false });
      expect(rec.label).toBe(PROPERTY_OUTCOMES[key].label);
      expect(rec.type).toBe(key);
    }
  });
});
