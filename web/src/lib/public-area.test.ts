import { describe, it, expect } from "vitest";
import {
  toPublicArea,
  deriveAvailability,
  readForSale,
  type PublicAreaRow,
} from "./public-area";
import { recordPropertyOutcome } from "./property-outcome";

const NOW = "2026-10-16T12:00:00.000Z";

function row(overrides: Partial<PublicAreaRow> = {}): PublicAreaRow {
  return {
    id: "a1",
    name: "House 12",
    area_type: "PROPERTY",
    status: "AWAITING_OUTCOME",
    geojson: { type: "Polygon", coordinates: [[[3.2, 6.4], [3.3, 6.4], [3.3, 6.5], [3.2, 6.5], [3.2, 6.4]]] },
    metadata: { name: "House 12" },
    created_at: NOW,
    ...overrides,
  };
}

describe("readForSale", () => {
  it("is true only for an explicit boolean true", () => {
    expect(readForSale({ for_sale: true })).toBe(true);
    expect(readForSale({ for_sale: "yes" })).toBe(false);
    expect(readForSale({ for_sale: false })).toBe(false);
    expect(readForSale({})).toBe(false);
    expect(readForSale(null)).toBe(false);
  });
});

describe("deriveAvailability", () => {
  const base = { areaType: "PROPERTY", ownerName: null, outcome: null, forSale: false };

  it("flags an owner listing as FOR_SALE", () => {
    expect(deriveAvailability({ ...base, forSale: true })?.kind).toBe("FOR_SALE");
    expect(deriveAvailability({ ...base, forSale: true, ownerName: "John Mike" })?.kind).toBe("FOR_SALE");
  });

  it("flags an unowned area with no outcome as UNOWNED", () => {
    expect(deriveAvailability(base)?.kind).toBe("UNOWNED");
    expect(deriveAvailability({ ...base, areaType: "PLOT" })?.kind).toBe("UNOWNED");
  });

  it("is null once an owner or outcome exists (and not for sale)", () => {
    expect(deriveAvailability({ ...base, ownerName: "John Mike" })).toBeNull();
    const outcome = recordPropertyOutcome({ type: "APPROVED_PROPERTY", userId: "u", role: "ADMIN", now: NOW });
    expect(deriveAvailability({ ...base, outcome })).toBeNull();
  });

  it("never marks zones as available", () => {
    expect(deriveAvailability({ ...base, areaType: "ZONE", forSale: true })).toBeNull();
    expect(deriveAvailability({ ...base, areaType: "ZONE" })).toBeNull();
  });
});

describe("toPublicArea", () => {
  it("whitelists safe fields and drops everything sensitive", () => {
    const meta = {
      owner_name: "John Mike",
      property_outcome: recordPropertyOutcome({ type: "APPROVED_PROPERTY", userId: "u-123", role: "ENGINEER", now: NOW }),
      internal_note: "complaint pending",
    };
    const projected = toPublicArea({
      ...row({ metadata: meta }),
      // Internal columns present on the raw row must never surface:
      drawn_by: "user-internal-42",
      description: "internal field observation",
      plot_ids: ["plot-1"],
      color: "#ff0000",
      parent_area_id: "zone-1",
      updated_at: NOW,
      metadata: meta,
    } as PublicAreaRow);

    const keys = Object.keys(projected).sort();
    expect(keys).toEqual(
      [
        "area_type",
        "availability",
        "created_at",
        "for_sale",
        "geojson",
        "id",
        "name",
        "outcome",
        "owner_name",
        "photo_count",
        "status",
        "status_label",
      ].sort()
    );
    const json = JSON.stringify(projected);
    expect(json).not.toContain("user-internal-42");
    expect(json).not.toContain("internal field observation");
    expect(json).not.toContain("plot-1");
    expect(json).not.toContain("complaint pending");
    expect(json).not.toContain("uploaded_by");
    expect(json).not.toContain("storage_key");
  });

  it("projects outcome facts without the recorder's identity", () => {
    const outcome = recordPropertyOutcome({ type: "UNAPPROVED", userId: "user-abc", role: "SUPERVISOR", now: NOW });
    const projected = toPublicArea(row({ metadata: { property_outcome: outcome } }));
    expect(projected.outcome).toEqual({
      type: "UNAPPROVED",
      label: "Unapproved property",
      state: "RECORDED",
      recorded_at: NOW,
    });
    expect(JSON.stringify(projected)).not.toContain("user-abc");
  });

  it("maps known statuses to public labels", () => {
    expect(toPublicArea(row({ status: "AWAITING_OUTCOME" })).status_label).toBe("Awaiting outcome");
    expect(toPublicArea(row({ status: "APPROVED_PROPERTY" })).status_label).toBe("Approved property");
    expect(toPublicArea(row({ status: "SOME_FUTURE_STATUS" })).status_label).toBe("SOME_FUTURE_STATUS");
  });

  it("carries the photo count", () => {
    expect(toPublicArea(row(), 3).photo_count).toBe(3);
    expect(toPublicArea(row()).photo_count).toBe(0);
  });
});
