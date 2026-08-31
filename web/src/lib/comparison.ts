// AGENTS.md:22 — Business logic reusable, not scattered in UI
// ARCHITECTURE.md:23, WORKFLOWS.md:15
export type ComparisonResult = "MATCH" | "POTENTIAL_DISCREPANCY" | "REVIEW_REQUIRED";

export interface ComparisonItem {
  field: string;
  approved: number | string | null;
  observed: number | string | null;
  result: ComparisonResult;
}

export function compareFloors(approved: number | null, observed: number | null): ComparisonItem {
  if (approved == null || observed == null) {
    return { field: "floors", approved, observed, result: "REVIEW_REQUIRED" };
  }
  return {
    field: "floors",
    approved,
    observed,
    result: approved === observed ? "MATCH" : "POTENTIAL_DISCREPANCY",
  };
}

export function compareUnits(approved: number | null, observed: number | null): ComparisonItem {
  if (approved == null || observed == null) {
    return { field: "units", approved, observed, result: "REVIEW_REQUIRED" };
  }
  return {
    field: "units",
    approved,
    observed,
    result: approved === observed ? "MATCH" : "POTENTIAL_DISCREPANCY",
  };
}

export function compareInspection(approved: { floors: number | null; units: number | null }, observed: { floors: number | null; units: number | null }) {
  const floors = compareFloors(approved.floors, observed.floors);
  const units = compareUnits(approved.units, observed.units);
  const hasDiscrepancy = [floors, units].some((i) => i.result === "POTENTIAL_DISCREPANCY");
  return {
    items: [floors, units],
    hasDiscrepancy,
    summary: hasDiscrepancy ? "POTENTIAL DISCREPANCY — Flag for FHA review" : "No difference detected",
  };
}
