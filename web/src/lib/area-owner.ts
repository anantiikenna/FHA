// Optional property-owner name carried in map_areas.metadata.owner_name.
// Free-text, demo-grade field — never treated as an official FHA owner record
// (AGENTS §6/§7: official identifiers stay separate; this is a field note).
// Pure module — usable from client components and API routes (AGENTS §22).

export const OWNER_NAME_MAX = 120;

/** Trim, collapse whitespace, cap length. Empty/invalid input -> null. */
export function sanitizeOwnerName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const collapsed = input.replace(/\s+/g, " ").trim();
  if (!collapsed) return null;
  return collapsed.slice(0, OWNER_NAME_MAX);
}

/** Read the owner from area metadata (null when absent/invalid). */
export function readOwnerName(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  return sanitizeOwnerName((metadata as Record<string, unknown>).owner_name);
}
