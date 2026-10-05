import { describe, expect, it } from "vitest";
import { gpsSchema, inspectionSchema } from "@/lib/validation/inspection";

const VALID_UUID = "3f1d2a4e-8c7b-4f6a-9d2e-1b0a5c4d3e2f";

describe("gpsSchema", () => {
  it("accepts valid coordinates", () => {
    const r = gpsSchema.safeParse({ latitude: 6.5, longitude: 3.3, accuracy: 12 });
    expect(r.success).toBe(true);
  });

  it("accepts boundary coordinates", () => {
    expect(gpsSchema.safeParse({ latitude: 90, longitude: 180 }).success).toBe(true);
    expect(gpsSchema.safeParse({ latitude: -90, longitude: -180 }).success).toBe(true);
  });

  it("rejects latitude = 500 (out of range)", () => {
    const r = gpsSchema.safeParse({ latitude: 500, longitude: 3.3 });
    expect(r.success).toBe(false);
  });

  it("rejects longitude out of range", () => {
    expect(gpsSchema.safeParse({ latitude: 6.5, longitude: 181 }).success).toBe(false);
  });

  it("rejects negative accuracy", () => {
    expect(gpsSchema.safeParse({ latitude: 6.5, longitude: 3.3, accuracy: -1 }).success).toBe(false);
  });

  it("rejects malformed capture timestamps", () => {
    expect(gpsSchema.safeParse({ latitude: 6.5, longitude: 3.3, capturedAt: "yesterday" }).success).toBe(false);
    expect(
      gpsSchema.safeParse({ latitude: 6.5, longitude: 3.3, capturedAt: "2026-10-02T10:00:00.000Z" }).success
    ).toBe(true);
  });

  it("requires coordinates", () => {
    expect(gpsSchema.safeParse({}).success).toBe(false);
  });
});

describe("inspectionSchema", () => {
  it("accepts a minimal valid inspection and applies defaults", () => {
    const r = inspectionSchema.safeParse({ plotId: VALID_UUID });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.status).toBe("DRAFT");
      expect(r.data.inspectionType).toBe("ROUTINE");
    }
  });

  it("accepts a full inspection", () => {
    const r = inspectionSchema.safeParse({
      plotId: VALID_UUID,
      areaId: VALID_UUID,
      inspectionType: "COMPLIANCE",
      observedFloors: 3,
      observedUnits: 6,
      observations: "Structure exceeds approved floors",
      complianceStatus: "MAJOR_NON_COMPLIANT",
      latitude: 6.5,
      longitude: 3.3,
      status: "SUBMITTED",
    });
    expect(r.success).toBe(true);
  });

  it("rejects an invalid plot id", () => {
    expect(inspectionSchema.safeParse({ plotId: "not-a-uuid" }).success).toBe(false);
    expect(inspectionSchema.safeParse({ plotId: "1 OR 1=1 --" }).success).toBe(false);
  });

  it("rejects an invalid area id", () => {
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, areaId: "nope" }).success).toBe(false);
  });

  it("rejects unsupported status and inspection type values", () => {
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, status: "COMPLETED" }).success).toBe(false);
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, inspectionType: "EMERGENCY" }).success).toBe(false);
  });

  it("rejects out-of-range observed floors and units", () => {
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, observedFloors: 101 }).success).toBe(false);
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, observedFloors: -1 }).success).toBe(false);
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, observedUnits: 1001 }).success).toBe(false);
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, observedFloors: 2.5 }).success).toBe(false);
  });

  it("rejects observations over 5000 characters", () => {
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, observations: "x".repeat(5001) }).success).toBe(false);
    expect(inspectionSchema.safeParse({ plotId: VALID_UUID, observations: "x".repeat(5000) }).success).toBe(true);
  });

  it("rejects an invalid compliance status", () => {
    expect(
      inspectionSchema.safeParse({ plotId: VALID_UUID, complianceStatus: "ILLEGAL" }).success
    ).toBe(false);
  });
});
