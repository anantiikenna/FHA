import { describe, expect, it } from "vitest";
import { PROPERTY_OUTCOMES, isPropertyOutcomeType, outcomeRecordedAt, readPropertyOutcome, recordPropertyOutcome } from "@/lib/property-outcome";

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

  it("returns a valid RECORDED record (direct one-step flow)", () => {
    const out = readPropertyOutcome({
      property_outcome: {
        type: "UNOCCUPIED",
        label: "Unoccupied property",
        state: "RECORDED",
        recorded_by: "user-1",
        recorded_role: "ENGINEER",
        recorded_at: "2026-10-08T10:00:00.000Z",
      },
    });
    expect(out).not.toBeNull();
    expect(out?.state).toBe("RECORDED");
    expect(out?.recorded_by).toBe("user-1");
    expect(out?.recorded_at).toBe("2026-10-08T10:00:00.000Z");
  });

  it("still returns legacy PROPOSED / ACCEPTED / REJECTED rows", () => {
    expect(readPropertyOutcome({ property_outcome: valid })?.state).toBe("PROPOSED");

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

describe("outcomeRecordedAt", () => {
  it("prefers recorded_at, then falls back to legacy stamps", () => {
    expect(
      outcomeRecordedAt({
        type: "UNOCCUPIED", label: "Unoccupied property", state: "RECORDED",
        recorded_at: "2026-10-08T00:00:00.000Z", proposed_at: "2026-10-01T00:00:00.000Z",
      })
    ).toBe("2026-10-08T00:00:00.000Z");

    expect(
      outcomeRecordedAt({
        type: "UNOCCUPIED", label: "Unoccupied property", state: "ACCEPTED",
        accepted_at: "2026-10-03T00:00:00.000Z", proposed_at: "2026-10-01T00:00:00.000Z",
      })
    ).toBe("2026-10-03T00:00:00.000Z");

    expect(
      outcomeRecordedAt({ type: "UNOCCUPIED", label: "Unoccupied property", state: "PROPOSED" })
    ).toBeNull();
  });
});

describe("recordPropertyOutcome", () => {
  const NOW = "2026-10-08T10:00:00.000Z";

  it("creates a direct RECORDED record with who/when", () => {
    const rec = recordPropertyOutcome({ type: "UNOCCUPIED", userId: "user-eng", role: "ENGINEER", now: NOW });
    expect(rec).toMatchObject({
      type: "UNOCCUPIED",
      label: "Unoccupied property",
      state: "RECORDED",
      recorded_by: "user-eng",
      recorded_role: "ENGINEER",
      recorded_at: NOW,
    });
  });

  it("labels always come from PROPERTY_OUTCOMES for the requested type", () => {
    for (const key of Object.keys(PROPERTY_OUTCOMES) as (keyof typeof PROPERTY_OUTCOMES)[]) {
      const rec = recordPropertyOutcome({ type: key, userId: "u", role: "ADMIN", now: NOW });
      expect(rec.label).toBe(PROPERTY_OUTCOMES[key].label);
      expect(rec.type).toBe(key);
      expect(rec.state).toBe("RECORDED");
    }
  });

  it("re-recording simply replaces the previous record (no review states)", () => {
    const first = recordPropertyOutcome({ type: "UNAPPROVED", userId: "u1", role: "ENGINEER", now: NOW });
    const second = recordPropertyOutcome({ type: "APPROVED_PROPERTY", userId: "u2", role: "SUPERVISOR", now: NOW });
    expect(second.type).toBe("APPROVED_PROPERTY");
    expect(second.recorded_by).toBe("u2");
    expect(second.recorded_at).toBe(NOW);
    expect(first.state).toBe("RECORDED");
  });
});
