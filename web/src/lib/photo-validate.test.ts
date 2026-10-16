import { describe, it, expect } from "vitest";
import {
  validateEvidenceFile,
  photosRemaining,
  MAX_EVIDENCE_BYTES,
  MAX_PHOTOS_PER_AREA,
  ALLOWED_IMAGE_TYPES,
} from "./photo-validate";

const base = { name: "site.jpg", type: "image/jpeg", size: 1024 };

describe("validateEvidenceFile", () => {
  it("accepts JPG and PNG", () => {
    expect(validateEvidenceFile(base)).toBeNull();
    expect(validateEvidenceFile({ ...base, type: "image/png" })).toBeNull();
    expect(validateEvidenceFile({ ...base, type: "image/jpg" })).toBeNull();
  });

  it("rejects other types with a user-facing reason", () => {
    expect(validateEvidenceFile({ ...base, type: "image/webp" })).toMatch(/JPG\/PNG/);
    expect(validateEvidenceFile({ ...base, type: "application/pdf" })).toMatch(/JPG\/PNG/);
    expect(validateEvidenceFile({ ...base, type: "" })).toMatch(/JPG\/PNG/);
  });

  it("rejects files over the size limit, accepts the boundary", () => {
    expect(
      validateEvidenceFile({ ...base, size: MAX_EVIDENCE_BYTES })
    ).toBeNull();
    expect(
      validateEvidenceFile({ ...base, size: MAX_EVIDENCE_BYTES + 1 })
    ).toMatch(/10 MB/);
  });

  it("exports the allowed types list", () => {
    expect([...ALLOWED_IMAGE_TYPES]).toEqual([
      "image/jpeg",
      "image/png",
      "image/jpg",
    ]);
  });
});

describe("photosRemaining", () => {
  it("counts down from the area limit", () => {
    expect(photosRemaining(0)).toBe(MAX_PHOTOS_PER_AREA);
    expect(photosRemaining(3)).toBe(MAX_PHOTOS_PER_AREA - 3);
  });

  it("never goes negative", () => {
    expect(photosRemaining(MAX_PHOTOS_PER_AREA)).toBe(0);
    expect(photosRemaining(MAX_PHOTOS_PER_AREA + 5)).toBe(0);
  });

  it("honours a custom limit", () => {
    expect(photosRemaining(2, 5)).toBe(3);
    expect(photosRemaining(5, 5)).toBe(0);
  });
});
