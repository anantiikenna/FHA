import { describe, expect, it } from "vitest";
import { parsePhotoGps } from "@/lib/photo-gps";

describe("parsePhotoGps", () => {
  it("accepts all-empty input (photo without location)", () => {
    const r = parsePhotoGps(null, undefined, "");
    expect(r).toEqual({ ok: true, value: { latitude: null, longitude: null, capturedAt: null } });
  });

  it("parses valid string coordinates (FormData values)", () => {
    const r = parsePhotoGps("6.4698", "3.5852", null);
    expect(r).toEqual({ ok: true, value: { latitude: 6.4698, longitude: 3.5852, capturedAt: null } });
  });

  it("accepts numeric coordinates too", () => {
    const r = parsePhotoGps(-33.8688197, 151.2053211, null);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.latitude).toBe(-33.8688197);
  });

  it("accepts boundary values", () => {
    expect(parsePhotoGps(90, 180, null).ok).toBe(true);
    expect(parsePhotoGps(-90, -180, null).ok).toBe(true);
  });

  it("rejects a lone latitude", () => {
    const r = parsePhotoGps("6.47", null, null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/together/);
  });

  it("rejects a lone longitude", () => {
    expect(parsePhotoGps(null, "3.58", null).ok).toBe(false);
  });

  it("rejects out-of-range latitude", () => {
    const r = parsePhotoGps("91", "0", null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/latitude/);
  });

  it("rejects out-of-range longitude", () => {
    const r = parsePhotoGps("0", "181", null);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/longitude/);
  });

  it("rejects non-numeric coordinates", () => {
    expect(parsePhotoGps("abc", "3.58", null).ok).toBe(false);
    expect(parsePhotoGps("6.47", "NaN", null).ok).toBe(false);
  });

  it("rejects an unparseable capturedAt", () => {
    const r = parsePhotoGps("6.47", "3.58", "not-a-date");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/capturedAt/);
  });

  it("keeps capturedAt when only a timestamp is provided", () => {
    const r = parsePhotoGps(null, null, "2026-10-06T09:30:00Z");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.latitude).toBeNull();
      expect(r.value.capturedAt).toBe("2026-10-06T09:30:00.000Z");
    }
  });

  it("normalizes offset timestamps to ISO UTC", () => {
    const r = parsePhotoGps(null, null, "2026-10-06T10:30:00+01:00");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.capturedAt).toBe("2026-10-06T09:30:00.000Z");
  });
});
