import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { areaStatusForInspection, recomputeAssignmentProgress, syncAssignmentAreaFromPlot } from "@/lib/assignment-progress";

// ---------------------------------------------------------------------------
// Minimal in-memory Supabase stub covering exactly the query shapes used by
// assignment-progress.ts (select/count/update chains). Records every call so
// tests can assert what was written.
// ---------------------------------------------------------------------------

interface AreaRow {
  id: string;
  status: string;
  assignment_id: string;
  geo_unit_id?: string;
  inspection_id?: string | null;
}

interface Recorded {
  table: string;
  op: "select" | "update";
  payload?: Record<string, unknown>;
  filters: Record<string, unknown>;
  countMode: boolean;
}

function createMockSupabase(opts: {
  assignment?: { id: string; status: string } | null;
  submittedCount?: number;
  totalCount?: number;
  areaRows?: AreaRow[];
}) {
  const recorded: Recorded[] = [];

  const client = {
    from(table: string) {
      const rec: Recorded = { table, op: "select", filters: {}, countMode: false };
      recorded.push(rec);
      let wantsSingle = false;
      let wantsRowsAfterUpdate = false;

      const run = () => {
        if (rec.op === "update") {
          if (table === "assignment_areas") {
            const id = rec.filters.id as string;
            return { data: wantsRowsAfterUpdate ? [{ id }] : null, error: null };
          }
          return { data: null, error: null };
        }
        if (table === "inspection_assignments") {
          if (wantsSingle) return { data: opts.assignment ?? null, error: null };
          return { data: [], error: null };
        }
        if (table === "assignment_areas") {
          if (rec.countMode) {
            const submitted = rec.filters.status !== undefined;
            return { count: submitted ? opts.submittedCount ?? 0 : opts.totalCount ?? 0, error: null };
          }
          let rows = opts.areaRows ?? [];
          if (rec.filters.geo_unit_id !== undefined) {
            rows = rows.filter((r) => r.geo_unit_id === rec.filters.geo_unit_id);
          }
          if (rec.filters.inspection_id !== undefined) {
            rows = rows.filter((r) => r.inspection_id === rec.filters.inspection_id);
          }
          return { data: rows, error: null };
        }
        return { data: null, error: null };
      };

      const builder = {
        select(_cols: unknown, options?: { count?: string; head?: boolean }) {
          if (options?.head && options.count) rec.countMode = true;
          if (rec.op === "update") wantsRowsAfterUpdate = true;
          return builder;
        },
        eq(col: string, val: unknown) {
          rec.filters[col] = val;
          return builder;
        },
        in(col: string, val: unknown) {
          rec.filters[col] = val;
          return builder;
        },
        update(payload: Record<string, unknown>) {
          rec.op = "update";
          rec.payload = payload;
          return builder;
        },
        maybeSingle() {
          wantsSingle = true;
          return Promise.resolve(run());
        },
        then(onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) {
          return Promise.resolve().then(run).then(onFulfilled, onRejected);
        },
      };
      return builder;
    },
  };

  return { client: client as unknown as SupabaseClient, recorded };
}

const updatesOn = (recorded: Recorded[], table: string) =>
  recorded.filter((r) => r.table === table && r.op === "update");

// ---------------------------------------------------------------------------

describe("areaStatusForInspection", () => {
  it("maps inspection workflow statuses onto assignment-area statuses", () => {
    expect(areaStatusForInspection("DRAFT")).toBe("INSPECTION_IN_PROGRESS");
    expect(areaStatusForInspection("SUBMITTED")).toBe("AWAITING_REVIEW");
    expect(areaStatusForInspection("UNDER_REVIEW")).toBe("INSPECTED");
    expect(areaStatusForInspection("COMPLETED")).toBe("INSPECTED");
  });

  it("returns null for unknown statuses (no mapping = no change)", () => {
    expect(areaStatusForInspection("BOGUS")).toBeNull();
    expect(areaStatusForInspection("")).toBeNull();
  });
});

describe("recomputeAssignmentProgress", () => {
  it("100% moves ACTIVE -> READY_FOR_COMPLETION (never auto-COMPLETED)", async () => {
    const { client, recorded } = createMockSupabase({
      assignment: { id: "a1", status: "ACTIVE" },
      submittedCount: 3,
      totalCount: 3,
    });
    await recomputeAssignmentProgress(client, "a1");
    const updates = updatesOn(recorded, "inspection_assignments");
    expect(updates).toHaveLength(1);
    expect(updates[0].payload).toEqual({
      completed_areas: 3,
      total_areas: 3,
      status: "READY_FOR_COMPLETION",
    });
    expect(updates[0].payload?.status).not.toBe("COMPLETED");
  });

  it("dropping below 100% reopens READY_FOR_COMPLETION -> ACTIVE", async () => {
    const { client, recorded } = createMockSupabase({
      assignment: { id: "a1", status: "READY_FOR_COMPLETION" },
      submittedCount: 2,
      totalCount: 3,
    });
    await recomputeAssignmentProgress(client, "a1");
    const updates = updatesOn(recorded, "inspection_assignments");
    expect(updates[0].payload).toEqual({
      completed_areas: 2,
      total_areas: 3,
      status: "ACTIVE",
    });
  });

  it("a COMPLETED assignment is never reopened — counts only", async () => {
    const { client, recorded } = createMockSupabase({
      assignment: { id: "a1", status: "COMPLETED" },
      submittedCount: 1,
      totalCount: 3,
    });
    await recomputeAssignmentProgress(client, "a1");
    const updates = updatesOn(recorded, "inspection_assignments");
    expect(updates[0].payload).toEqual({ completed_areas: 1, total_areas: 3 });
    expect(updates[0].payload).not.toHaveProperty("status");
  });

  it("a CANCELLED assignment is skipped entirely", async () => {
    const { client, recorded } = createMockSupabase({
      assignment: { id: "a1", status: "CANCELLED" },
      submittedCount: 0,
      totalCount: 3,
    });
    await recomputeAssignmentProgress(client, "a1");
    expect(updatesOn(recorded, "inspection_assignments")).toHaveLength(0);
  });

  it("a missing assignment is a no-op", async () => {
    const { client, recorded } = createMockSupabase({ assignment: null });
    await recomputeAssignmentProgress(client, "a1");
    expect(updatesOn(recorded, "inspection_assignments")).toHaveLength(0);
  });

  it("an empty scope (0 rows) never reaches 100%", async () => {
    const { client, recorded } = createMockSupabase({
      assignment: { id: "a1", status: "ACTIVE" },
      submittedCount: 0,
      totalCount: 0,
    });
    await recomputeAssignmentProgress(client, "a1");
    const updates = updatesOn(recorded, "inspection_assignments");
    expect(updates[0].payload).toEqual({ completed_areas: 0, total_areas: 0 });
    expect(updates[0].payload).not.toHaveProperty("status");
  });
});

describe("syncAssignmentAreaFromPlot", () => {
  const base: AreaRow[] = [
    { id: "r-inspected", status: "INSPECTED", assignment_id: "as1", geo_unit_id: "p1" },
    { id: "r-awaiting", status: "AWAITING_REVIEW", assignment_id: "as1", geo_unit_id: "p1" },
    { id: "r-fresh", status: "NOT_INSPECTED", assignment_id: "as2", geo_unit_id: "p1" },
  ];

  it("only moves statuses forward (rank guard)", async () => {
    const { client, recorded } = createMockSupabase({ areaRows: base });
    await syncAssignmentAreaFromPlot(client, { plotId: "p1", areaStatus: "INSPECTED" });
    const ids = updatesOn(recorded, "assignment_areas").map((u) => u.filters.id);
    expect(ids).not.toContain("r-inspected"); // rank 3 -> 3 blocked
    expect(ids).toContain("r-awaiting"); // 2 -> 3 allowed
    expect(ids).toContain("r-fresh"); // 0 -> 3 allowed
  });

  it("marks submitted statuses with completed_at", async () => {
    const { client, recorded } = createMockSupabase({ areaRows: base });
    await syncAssignmentAreaFromPlot(client, { plotId: "p1", areaStatus: "INSPECTED" });
    const update = updatesOn(recorded, "assignment_areas").find((u) => u.filters.id === "r-awaiting");
    expect(update?.payload?.status).toBe("INSPECTED");
    expect(typeof update?.payload?.completed_at).toBe("string");
  });

  it("REINSPECTION_REQUIRED reopens started work but not untouched work", async () => {
    const { client, recorded } = createMockSupabase({ areaRows: base });
    await syncAssignmentAreaFromPlot(client, { plotId: "p1", areaStatus: "REINSPECTION_REQUIRED" });
    const ids = updatesOn(recorded, "assignment_areas").map((u) => u.filters.id);
    expect(ids).toContain("r-inspected");
    expect(ids).toContain("r-awaiting");
    expect(ids).not.toContain("r-fresh"); // rank 0 never started
  });

  it("keeps completed_at set for REINSPECTION_REQUIRED (still counted work)", async () => {
    const { client, recorded } = createMockSupabase({ areaRows: base });
    await syncAssignmentAreaFromPlot(client, { plotId: "p1", areaStatus: "REINSPECTION_REQUIRED" });
    const update = updatesOn(recorded, "assignment_areas").find((u) => u.filters.id === "r-awaiting");
    expect(update?.payload?.status).toBe("REINSPECTION_REQUIRED");
    expect(typeof update?.payload?.completed_at).toBe("string");
  });

  it("clears completed_at on forward moves that never count as submitted", async () => {
    const { client, recorded } = createMockSupabase({ areaRows: base });
    // NOT_INSPECTED (0) -> INSPECTION_IN_PROGRESS (1) is forward but not submitted
    await syncAssignmentAreaFromPlot(client, { plotId: "p1", areaStatus: "INSPECTION_IN_PROGRESS" });
    const update = updatesOn(recorded, "assignment_areas").find((u) => u.filters.id === "r-fresh");
    expect(update?.payload?.status).toBe("INSPECTION_IN_PROGRESS");
    expect(update?.payload?.completed_at).toBeNull();
  });

  it("ignores unknown target statuses before touching the database", async () => {
    const { client, recorded } = createMockSupabase({ areaRows: base });
    await syncAssignmentAreaFromPlot(client, { plotId: "p1", areaStatus: "NOT_A_STATUS" });
    expect(recorded).toHaveLength(0);
  });

  it("does nothing when no assignment areas cover the plot", async () => {
    const { client, recorded } = createMockSupabase({ areaRows: base });
    await syncAssignmentAreaFromPlot(client, { plotId: "other-plot", areaStatus: "INSPECTED" });
    expect(updatesOn(recorded, "assignment_areas")).toHaveLength(0);
  });
});
