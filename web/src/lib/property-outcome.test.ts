import { describe, expect, it } from "vitest";
import { PROPERTY_OUTCOMES, isPropertyOutcomeType, readPropertyOutcome } from "@/lib/property-outcome";

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
