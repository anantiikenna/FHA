import { describe, it, expect } from "vitest";
import { isAreaSubmitted, SUBMITTED_STATUSES } from "./area-queue";

describe("isAreaSubmitted", () => {
  it("treats statuses waiting for field work as NOT submitted", () => {
    for (const status of ["DRAFT", "MARKED", "IN_PROGRESS", "INSPECTED", "REINSPECTION_REQUIRED", "NON_COMPLIANT_OBSERVED", "AWAITING_OWNER"]) {
      expect(isAreaSubmitted(status), status).toBe(false);
    }
  });

  it("treats submitted / decided statuses as submitted", () => {
    for (const status of ["AWAITING_REVIEW", "APPROVED", "REJECTED", "EMPTY_UNOCCUPIED", "UNAPPROVED_PROPERTY", "SET_FOR_DEMOLITION", "APPROVED_PROPERTY"]) {
      expect(isAreaSubmitted(status), status).toBe(true);
    }
  });

  it("handles null / undefined / unknown statuses safely", () => {
    expect(isAreaSubmitted(null)).toBe(false);
    expect(isAreaSubmitted(undefined)).toBe(false);
    expect(isAreaSubmitted("SOME_FUTURE_STATUS")).toBe(false);
  });

  it("covers all four property-outcome statuses", () => {
    for (const status of ["EMPTY_UNOCCUPIED", "UNAPPROVED_PROPERTY", "SET_FOR_DEMOLITION", "APPROVED_PROPERTY"]) {
      expect(SUBMITTED_STATUSES.has(status)).toBe(true);
    }
  });
});
