import { describe, expect, it } from "vitest";

import { deriveAreaActivity, splitOutcomeValue, type AreaHistoryRow } from "./area-activity";

function row(partial: Partial<AreaHistoryRow>): AreaHistoryRow {
  return {
    id: `h-${Math.random().toString(36).slice(2)}`,
    area_id: "area-1",
    field: "status",
    old_value: null,
    new_value: "IN_PROGRESS",
    created_at: "2026-10-01T10:00:00.000Z",
    changed_by: { display_name: "Ada Obi" },
    ...partial,
  };
}

describe("splitOutcomeValue", () => {
  it("splits state and label on the middle dot", () => {
    expect(splitOutcomeValue("ACCEPTED · Unoccupied property")).toEqual({
      state: "ACCEPTED",
      label: "Unoccupied property",
    });
  });

  it("returns null when the separator is missing", () => {
    expect(splitOutcomeValue("just a value")).toBeNull();
  });
});

describe("deriveAreaActivity", () => {
  it("returns empty facts for no rows", () => {
    const activity = deriveAreaActivity([]);
    expect(activity.submittedBy).toBeNull();
    expect(activity.reviewedAction).toBeNull();
    expect(activity.reinspectionBy).toBeNull();
    expect(activity.latestOutcome).toBeNull();
    expect(activity.events).toEqual([]);
  });

  it("captures submitted / reviewed / re-inspection from status rows", () => {
    const activity = deriveAreaActivity([
      row({ new_value: "IN_PROGRESS", created_at: "2026-10-01T09:00:00.000Z" }),
      row({ new_value: "AWAITING_REVIEW", created_at: "2026-10-02T09:00:00.000Z", changed_by: { display_name: "Engineer One" } }),
      row({ new_value: "APPROVED", created_at: "2026-10-03T09:00:00.000Z", changed_by: { display_name: "Review Officer" } }),
      row({ new_value: "REINSPECTION_REQUIRED", created_at: "2026-10-04T09:00:00.000Z", changed_by: { display_name: "Admin Two" } }),
    ]);

    expect(activity.submittedBy).toBe("Engineer One");
    expect(activity.reviewedBy).toBe("Review Officer");
    expect(activity.reviewedAction).toBe("APPROVED");
    expect(activity.reinspectionBy).toBe("Admin Two");
  });

  it("keeps only the first (newest) occurrence per category regardless of order", () => {
    const activity = deriveAreaActivity([
      row({ new_value: "AWAITING_REVIEW", created_at: "2026-10-05T09:00:00.000Z", changed_by: { display_name: "Later" } }),
      row({ new_value: "AWAITING_REVIEW", created_at: "2026-10-02T09:00:00.000Z", changed_by: { display_name: "First" } }),
      row({ new_value: "REJECTED", created_at: "2026-10-06T09:00:00.000Z", changed_by: { display_name: "Rejector" } }),
    ]);

    expect(activity.submittedBy).toBe("Later");
    expect(activity.reviewedAction).toBe("REJECTED");
    expect(activity.reviewedBy).toBe("Rejector");
  });

  it("reads the latest property outcome with its actor", () => {
    const activity = deriveAreaActivity([
      row({ field: "property_outcome", new_value: "PROPOSED · Unoccupied property", created_at: "2026-10-02T09:00:00.000Z", changed_by: { display_name: "Officer A" } }),
      row({ field: "property_outcome", new_value: "ACCEPTED · Unoccupied property", created_at: "2026-10-03T09:00:00.000Z", changed_by: { display_name: "Supervisor B" } }),
      row({ field: "property_outcome", new_value: "REJECTED · Approved property", created_at: "2026-10-04T09:00:00.000Z", changed_by: { display_name: "Officer A" } }),
    ]);

    expect(activity.latestOutcome).toEqual({
      label: "Approved property",
      state: "REJECTED",
      actor: "Officer A",
      at: "2026-10-04T09:00:00.000Z",
    });
  });

  it("falls back to 'Unknown user' when display_name is missing", () => {
    const activity = deriveAreaActivity([
      row({ new_value: "AWAITING_REVIEW", changed_by: null }),
    ]);
    expect(activity.submittedBy).toBe("Unknown user");
  });

  it("maps labels and caps the events list", () => {
    const rows = [
      row({ new_value: "AWAITING_REVIEW", created_at: "2026-10-02T09:00:00.000Z" }),
      row({ field: "property_outcome", new_value: "ACCEPTED · Approved property", created_at: "2026-10-03T09:00:00.000Z" }),
      row({ new_value: "SOME_FUTURE_STATUS", created_at: "2026-10-04T09:00:00.000Z" }),
      row({ new_value: "APPROVED", created_at: "2026-10-05T09:00:00.000Z" }),
    ];

    const activity = deriveAreaActivity(rows, 2);
    expect(activity.events).toHaveLength(2);
    expect(activity.events[0]).toEqual({
      field: "status",
      label: "Approved",
      actor: "Ada Obi",
      at: "2026-10-05T09:00:00.000Z",
    });

    const all = deriveAreaActivity(rows, 10);
    const labels = all.events.map((e) => e.label);
    expect(labels).toContain("Submitted for approval");
    expect(labels).toContain("Approved property — accepted");
    expect(labels).toContain("Status set to SOME_FUTURE_STATUS");
  });
});
