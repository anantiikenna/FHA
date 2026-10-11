import { describe, it, expect } from "vitest";
import { sanitizeOwnerName, readOwnerName, OWNER_NAME_MAX } from "./area-owner";

describe("sanitizeOwnerName", () => {
  it("returns null for non-string input", () => {
    expect(sanitizeOwnerName(null)).toBeNull();
    expect(sanitizeOwnerName(undefined)).toBeNull();
    expect(sanitizeOwnerName(42)).toBeNull();
    expect(sanitizeOwnerName({ name: "x" })).toBeNull();
  });

  it("returns null for empty or whitespace-only input", () => {
    expect(sanitizeOwnerName("")).toBeNull();
    expect(sanitizeOwnerName("   ")).toBeNull();
    expect(sanitizeOwnerName("\n\t ")).toBeNull();
  });

  it("trims and collapses internal whitespace", () => {
    expect(sanitizeOwnerName("  A.   Okafor  ")).toBe("A. Okafor");
    expect(sanitizeOwnerName("Chidi\nOkonkwo")).toBe("Chidi Okonkwo");
  });

  it("keeps a normal name unchanged", () => {
    expect(sanitizeOwnerName("Mrs. A. Okafor")).toBe("Mrs. A. Okafor");
  });

  it("caps length at OWNER_NAME_MAX", () => {
    const long = "x".repeat(OWNER_NAME_MAX + 50);
    expect(sanitizeOwnerName(long)).toHaveLength(OWNER_NAME_MAX);
  });
});

describe("readOwnerName", () => {
  it("reads owner_name from metadata", () => {
    expect(readOwnerName({ owner_name: "A. Okafor", drawn_by_role: "ENGINEER" })).toBe("A. Okafor");
  });

  it("sanitizes on read", () => {
    expect(readOwnerName({ owner_name: "  B.  Bello " })).toBe("B. Bello");
    expect(readOwnerName({ owner_name: "   " })).toBeNull();
  });

  it("returns null when metadata is missing, null, or malformed", () => {
    expect(readOwnerName(null)).toBeNull();
    expect(readOwnerName(undefined)).toBeNull();
    expect(readOwnerName("not-an-object")).toBeNull();
    expect(readOwnerName({})).toBeNull();
  });
});
