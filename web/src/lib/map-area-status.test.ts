import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROPERTY_OUTCOMES } from "@/lib/property-outcome";
import { ENGINEER_AREA_STATUSES, MAP_AREA_STATUSES, SECTION_TO_PLOT_STATUS } from "@/lib/map-area-status";

describe("MAP_AREA_STATUSES", () => {
  it("lists every map-area status exactly once", () => {
    expect(new Set(MAP_AREA_STATUSES).size).toBe(MAP_AREA_STATUSES.length);
    expect(MAP_AREA_STATUSES).toHaveLength(14);
  });

  it("includes the newest field/property outcome statuses", () => {
    expect(MAP_AREA_STATUSES).toContain("EMPTY_UNOCCUPIED");
    expect(MAP_AREA_STATUSES).toContain("UNAPPROVED_PROPERTY");
    expect(MAP_AREA_STATUSES).toContain("SET_FOR_DEMOLITION");
    expect(MAP_AREA_STATUSES).toContain("APPROVED_PROPERTY");
  });
});

describe("ENGINEER_AREA_STATUSES", () => {
  it("is a subset of the valid statuses", () => {
    for (const s of ENGINEER_AREA_STATUSES) expect(MAP_AREA_STATUSES).toContain(s);
  });

  it("never lets an engineer set APPROVED or REJECTED (no self-approval)", () => {
    expect(ENGINEER_AREA_STATUSES).not.toContain("APPROVED");
    expect(ENGINEER_AREA_STATUSES).not.toContain("REJECTED");
  });

  it("excludes reviewer-driven states (MARKED/INSPECTED flow)", () => {
    expect(ENGINEER_AREA_STATUSES).not.toContain("MARKED");
    expect(ENGINEER_AREA_STATUSES).not.toContain("INSPECTED");
  });

  it("includes every property-outcome paired status (officers can propose)", () => {
    for (const o of Object.values(PROPERTY_OUTCOMES)) {
      expect(ENGINEER_AREA_STATUSES).toContain(o.status);
    }
  });
});

describe("SECTION_TO_PLOT_STATUS", () => {
  it("maps exactly the review-cycle statuses onto plot rows", () => {
    expect(Object.keys(SECTION_TO_PLOT_STATUS).sort()).toEqual(
      ["APPROVED", "AWAITING_REVIEW", "REJECTED", "REINSPECTION_REQUIRED"].sort()
    );
    expect(SECTION_TO_PLOT_STATUS.AWAITING_REVIEW).toBe("AWAITING_REVIEW");
    expect(SECTION_TO_PLOT_STATUS.APPROVED).toBe("INSPECTED");
    expect(SECTION_TO_PLOT_STATUS.REJECTED).toBe("INSPECTED");
    expect(SECTION_TO_PLOT_STATUS.REINSPECTION_REQUIRED).toBe("REINSPECTION_REQUIRED");
  });

  it("source statuses are valid map-area statuses", () => {
    for (const key of Object.keys(SECTION_TO_PLOT_STATUS)) expect(MAP_AREA_STATUSES).toContain(key);
  });

  it("field/property outcomes and draft states never map to plot rows", () => {
    const neverMaps = [
      "DRAFT",
      "MARKED",
      "IN_PROGRESS",
      "INSPECTED",
      "NON_COMPLIANT_OBSERVED",
      "AWAITING_OWNER",
      "EMPTY_UNOCCUPIED",
      "UNAPPROVED_PROPERTY",
      "SET_FOR_DEMOLITION",
      "APPROVED_PROPERTY",
    ];
    for (const s of neverMaps) expect(SECTION_TO_PLOT_STATUS).not.toHaveProperty(s);
  });
});

describe("SQL schema sync (AGENTS §35 — Schema.sql + live_update.sql)", () => {
  const schemaSql = readFileSync(fileURLToPath(new URL("../../../supabase/Schema.sql", import.meta.url)), "utf8");
  const liveUpdateSql = readFileSync(fileURLToPath(new URL("../../../supabase/live_update.sql", import.meta.url)), "utf8");

  it("Schema.sql map_area_status enum lists every code status", () => {
    const match = schemaSql.match(/create type public\.map_area_status as enum \(([^)]*)\)/);
    expect(match).not.toBeNull();
    const enumValues = (match?.[1] ?? "").match(/'([^']+)'/g)?.map((v) => v.slice(1, -1)) ?? [];
    expect(enumValues.sort()).toEqual([...MAP_AREA_STATUSES].sort());
  });

  it("live_update.sql adds the newest statuses with IF NOT EXISTS", () => {
    expect(liveUpdateSql).toMatch(/ADD VALUE IF NOT EXISTS 'UNAPPROVED_PROPERTY'/);
    expect(liveUpdateSql).toMatch(/ADD VALUE IF NOT EXISTS 'SET_FOR_DEMOLITION'/);
    expect(liveUpdateSql).toMatch(/ADD VALUE IF NOT EXISTS 'APPROVED_PROPERTY'/);
  });
});
