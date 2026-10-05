import { describe, expect, it } from "vitest";
import { compareFloors, compareInspection, compareUnits } from "@/lib/comparison";

describe("compareFloors", () => {
  it("reports MATCH when approved equals observed", () => {
    expect(compareFloors(2, 2).result).toBe("MATCH");
  });

  it("reports POTENTIAL_DISCREPANCY when they differ", () => {
    const item = compareFloors(2, 3);
    expect(item.result).toBe("POTENTIAL_DISCREPANCY");
    expect(item.approved).toBe(2);
    expect(item.observed).toBe(3);
  });

  it("reports REVIEW_REQUIRED when either side is missing", () => {
    expect(compareFloors(null, 3).result).toBe("REVIEW_REQUIRED");
    expect(compareFloors(2, null).result).toBe("REVIEW_REQUIRED");
    expect(compareFloors(null, null).result).toBe("REVIEW_REQUIRED");
  });
});

describe("compareUnits", () => {
  it("follows the same match/difference/missing rules", () => {
    expect(compareUnits(4, 4).result).toBe("MATCH");
    expect(compareUnits(4, 6).result).toBe("POTENTIAL_DISCREPANCY");
    expect(compareUnits(null, 6).result).toBe("REVIEW_REQUIRED");
  });
});

describe("compareInspection", () => {
  it("test 1 — match: no floor difference", () => {
    const r = compareInspection({ floors: 2, units: 4 }, { floors: 2, units: 4 });
    expect(r.result).toBe("MATCH");
    expect(r.hasDiscrepancy).toBe(false);
    expect(r.needsReview).toBe(false);
    expect(r.summary).toBe("No difference detected");
  });

  it("test 2 — floor difference is flagged as a potential discrepancy", () => {
    const r = compareInspection({ floors: 2, units: 4 }, { floors: 3, units: 4 });
    expect(r.result).toBe("POTENTIAL_DISCREPANCY");
    expect(r.hasDiscrepancy).toBe(true);
    expect(r.items.find((i) => i.field === "floors")?.result).toBe("POTENTIAL_DISCREPANCY");
    expect(r.summary).toBe("POTENTIAL DISCREPANCY — Flag for FHA review");
  });

  it("test 3 — multiple differences (floors 2/4 vs observed 3/6)", () => {
    const r = compareInspection({ floors: 2, units: 4 }, { floors: 3, units: 6 });
    expect(r.items).toHaveLength(2);
    expect(r.items.every((i) => i.result === "POTENTIAL_DISCREPANCY")).toBe(true);
    expect(r.hasDiscrepancy).toBe(true);
  });

  it("reports REVIEW_REQUIRED when data is missing and nothing differs", () => {
    const r = compareInspection({ floors: null, units: 4 }, { floors: 3, units: 4 });
    expect(r.result).toBe("REVIEW_REQUIRED");
    expect(r.hasDiscrepancy).toBe(false);
    expect(r.needsReview).toBe(true);
  });

  it("a real discrepancy takes precedence over missing data", () => {
    const r = compareInspection({ floors: 2, units: null }, { floors: 3, units: 6 });
    expect(r.result).toBe("POTENTIAL_DISCREPANCY");
    expect(r.needsReview).toBe(false);
  });

  it("test 4 — never mutates the approved record (approved data is immutable)", () => {
    const approved = { floors: 2, units: 4 };
    const snapshot = { ...approved };
    compareInspection(approved, { floors: 3, units: 6 });
    expect(approved).toEqual(snapshot);
  });

  it("only ever emits fixed, non-legal summary wording", () => {
    const allowed = new Set([
      "POTENTIAL DISCREPANCY — Flag for FHA review",
      "REVIEW REQUIRED — Missing approved or observed data",
      "No difference detected",
    ]);
    const cases = [
      compareInspection({ floors: 2, units: 4 }, { floors: 2, units: 4 }),
      compareInspection({ floors: 2, units: 4 }, { floors: 3, units: 6 }),
      compareInspection({ floors: null, units: null }, { floors: 1, units: 1 }),
    ];
    for (const r of cases) expect(allowed.has(r.summary)).toBe(true);
  });
});
