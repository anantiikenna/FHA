/** Site GPS captured by the inspection flow, passed down to the photo uploader. */
export interface SiteGps {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  capturedAt: string;
}

export interface PhotoGpsValue {
  latitude: number | null;
  longitude: number | null;
  /** ISO timestamp of the photo capture; null → caller uses upload time. */
  capturedAt: string | null;
}

export type PhotoGpsResult =
  | { ok: true; value: PhotoGpsValue }
  | { ok: false; error: string };

function isEmpty(v: unknown): boolean {
  return v == null || (typeof v === "string" && v.trim() === "");
}

function asNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Validates optional per-photo GPS fields from an upload FormData.
 *
 * Rules:
 * - latitude/longitude must be provided together, be numeric, and be in range
 *   (lat -90..90, lng -180..180)
 * - both may be omitted (photo without location)
 * - capturedAt must be a parseable timestamp when provided; result is
 *   normalized to ISO-8601 UTC
 */
export function parsePhotoGps(
  latitudeRaw: unknown,
  longitudeRaw: unknown,
  capturedAtRaw: unknown
): PhotoGpsResult {
  let capturedAt: string | null = null;
  if (!isEmpty(capturedAtRaw)) {
    const t = Date.parse(String(capturedAtRaw));
    if (Number.isNaN(t)) {
      return { ok: false, error: "capturedAt must be a valid timestamp." };
    }
    capturedAt = new Date(t).toISOString();
  }

  const latEmpty = isEmpty(latitudeRaw);
  const lngEmpty = isEmpty(longitudeRaw);

  if (latEmpty && lngEmpty) {
    return { ok: true, value: { latitude: null, longitude: null, capturedAt } };
  }

  if (latEmpty || lngEmpty) {
    return { ok: false, error: "latitude and longitude must be provided together." };
  }

  const lat = asNumber(latitudeRaw);
  const lng = asNumber(longitudeRaw);
  if (lat === null || lng === null) {
    return { ok: false, error: "latitude and longitude must be numbers." };
  }
  if (lat < -90 || lat > 90) {
    return { ok: false, error: "latitude must be between -90 and 90." };
  }
  if (lng < -180 || lng > 180) {
    return { ok: false, error: "longitude must be between -180 and 180." };
  }

  return { ok: true, value: { latitude: lat, longitude: lng, capturedAt } };
}
