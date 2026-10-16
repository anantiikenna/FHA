/** Shared evidence-photo validation rules (client + server import these). */

export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/jpg"] as const;

export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Maximum evidence photos per saved area/property. Demo default —
 * confirm with FHA and make configurable before production.
 */
export const MAX_PHOTOS_PER_AREA = 5;

/** Returns a user-facing reason the file is rejected, or null when valid. */
export function validateEvidenceFile(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return "Only JPG/PNG files are allowed.";
  }
  if (file.size > MAX_EVIDENCE_BYTES) {
    return "File too large (max 10 MB).";
  }
  return null;
}

/** How many more photos an area can accept (never negative). */
export function photosRemaining(count: number, limit = MAX_PHOTOS_PER_AREA): number {
  return Math.max(0, limit - count);
}
