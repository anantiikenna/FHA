import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { PROPERTY_OUTCOMES } from "@/lib/property-outcome";
import { LEAF_STATUSES, MAP_AREA_STATUSES, ZONE_STATUSES } from "@/lib/map-area-status";

describe("MAP_AREA_STATUSES", () => {
  it("lists every map-area status exactly once", () => {
    expect(new Set(MAP_AREA_STATUSES).size).toBe(MAP_AREA_STATUSES.length);
    expect(MAP_AREA_STATUSES).toHaveLength(16);
  });

  it("includes the simplified-model statuses", () => {
    expect(MAP_AREA_STATUSES).toContain("ACTIVE");
    expect(MAP_AREA_STATUSES).toContain("AWAITING_OUTCOME");
  });

  it("includes the four property/plot outcome statuses", () => {
    expect(MAP_AREA_STATUSES).toContain("EMPTY_UNOCCUPIED");
    expect(MAP_AREA_STATUSES).toContain("UNAPPROVED_PROPERTY");
    expect(MAP_AREA_STATUSES).toContain("SET_FOR_DEMOLITION");
    expect(MAP_AREA_STATUSES).toContain("APPROVED_PROPERTY");
    for (const o of Object.values(PROPERTY_OUTCOMES)) {
      expect(MAP_AREA_STATUSES).toContain(o.status);
    }
  });

  it("keeps legacy workflow statuses for rows written before the simplification", () => {
    for (const s of ["DRAFT", "MARKED", "IN_PROGRESS", "AWAITING_REVIEW", "REINSPECTION_REQUIRED"]) {
      expect(MAP_AREA_STATUSES).toContain(s);
    }
  });
});

describe("ZONE_STATUSES / LEAF_STATUSES", () => {
  it("are subsets of the valid statuses", () => {
    for (const s of ZONE_STATUSES) expect(MAP_AREA_STATUSES).toContain(s);
    for (const s of LEAF_STATUSES) expect(MAP_AREA_STATUSES).toContain(s);
  });

  it("zones are always ACTIVE; plots/properties wait for a direct outcome", () => {
    expect(ZONE_STATUSES).toEqual(["ACTIVE"]);
    expect(LEAF_STATUSES).toEqual(["AWAITING_OUTCOME"]);
  });

  it("outcome statuses are leaf statuses' next states, never zone statuses", () => {
    for (const o of Object.values(PROPERTY_OUTCOMES)) {
      expect(MAP_AREA_STATUSES).toContain(o.status);
      expect(LEAF_STATUSES).not.toContain(o.status);
      expect(ZONE_STATUSES).not.toContain(o.status);
    }
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

  it("live_update.sql adds the simplified-model statuses with IF NOT EXISTS", () => {
    expect(liveUpdateSql).toMatch(/ADD VALUE IF NOT EXISTS 'ACTIVE'/);
    expect(liveUpdateSql).toMatch(/ADD VALUE IF NOT EXISTS 'AWAITING_OUTCOME'/);
    expect(liveUpdateSql).toMatch(/ADD VALUE IF NOT EXISTS 'UNAPPROVED_PROPERTY'/);
    expect(liveUpdateSql).toMatch(/ADD VALUE IF NOT EXISTS 'SET_FOR_DEMOLITION'/);
    expect(liveUpdateSql).toMatch(/ADD VALUE IF NOT EXISTS 'APPROVED_PROPERTY'/);
  });

  it("map_area_status_history table exists in Schema.sql and live_update.sql", () => {
    // Per-area "who changed what, when" records (AGENTS §14).
    expect(schemaSql).toMatch(/create table public\.map_area_status_history \(/);
    expect(liveUpdateSql).toMatch(/CREATE TABLE IF NOT EXISTS public\.map_area_status_history \(/);
    expect(schemaSql).toMatch(/alter table public\.map_area_status_history enable row level security/);
    expect(liveUpdateSql).toMatch(/ALTER TABLE public\.map_area_status_history ENABLE ROW LEVEL SECURITY/);
    expect(schemaSql).toMatch(/"map_area_history_insert_auth"/);
    expect(liveUpdateSql).toMatch(/"map_area_history_insert_auth"/);
  });
});
