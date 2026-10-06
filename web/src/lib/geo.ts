export type PolygonGeometry = {
  type: "Polygon";
  coordinates: number[][][];
};

type GeoLike = {
  type?: string;
  coordinates?: unknown;
  geometry?: unknown;
  features?: Array<{ geometry?: unknown }>;
};

function unwrap(input: unknown): GeoLike | null {
  if (!input || typeof input !== "object") return null;
  const g = input as GeoLike;
  if (g.type === "Feature") {
    return g.geometry && typeof g.geometry === "object" ? (g.geometry as GeoLike) : null;
  }
  if (g.type === "FeatureCollection") {
    const first = g.features?.[0]?.geometry;
    return first && typeof first === "object" ? (first as GeoLike) : null;
  }
  if (!g.coordinates && g.geometry && typeof g.geometry === "object") {
    return g.geometry as GeoLike;
  }
  return g;
}

function extractRing(input: unknown): number[][] | null {
  const g = unwrap(input);
  if (!g || !Array.isArray(g.coordinates)) return null;

  const coordinates = g.coordinates;
  let raw: unknown = null;
  if (g.type === "Polygon") raw = coordinates[0];
  else if (g.type === "MultiPolygon") {
    const polygon = coordinates[0];
    raw = Array.isArray(polygon) ? polygon[0] : null;
  } else if (g.type === "LineString") raw = coordinates;
  else if (g.type === "MultiLineString") raw = coordinates[0];
  if (!Array.isArray(raw) || raw.length < 3) return null;

  const pts: number[][] = [];
  for (const c of raw) {
    if (!Array.isArray(c) || c.length < 2) return null;
    const x = Number(c[0]);
    const y = Number(c[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    if (x < -180 || x > 180 || y < -90 || y > 90) return null;
    pts.push([x, y]);
  }

  const first = pts[0];
  const last = pts[pts.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    pts.push([first[0], first[1]]);
  }
  if (pts.length < 4) return null;
  return pts;
}

export function toPolygonGeometry(input: unknown): PolygonGeometry | null {
  const ring = extractRing(input);
  if (!ring) return null;
  return { type: "Polygon", coordinates: [ring] };
}

export function ringToEwkt(ring: number[][]): string {
  const body = ring.map((c) => `${c[0]} ${c[1]}`).join(", ");
  return `SRID=4326;POLYGON((${body}))`;
}

export function pointInRing(lng: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function plotIdsInside(
  polygon: PolygonGeometry | null,
  plots: Array<{ id: string; lat: number | null; lng: number | null }>
): string[] {
  const ring = polygon?.coordinates?.[0];
  if (!ring || ring.length < 4) return [];
  return plots
    .filter((p) => p.lat != null && p.lng != null && pointInRing(p.lng, p.lat, ring))
    .map((p) => p.id);
}

/** Shoelace area of a lon/lat ring (relative units — only used for comparisons). */
export function polygonArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    sum += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(sum) / 2;
}

export interface AreaLike {
  id: string;
  parent_area_id?: string | null;
  geojson?: unknown;
}

/** Map of area id -> nesting depth (0 = top-level), walking parent_area_id chains. */
export function areaDepthMap(areas: AreaLike[]): Map<string, number> {
  const byId = new Map(areas.map((a) => [a.id, a]));
  const depths = new Map<string, number>();
  const depthOf = (id: string): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    const area = byId.get(id);
    if (!area?.parent_area_id || !byId.has(area.parent_area_id)) {
      depths.set(id, 0);
      return 0;
    }
    depths.set(id, 0); // provisional — breaks cycles before recursion
    const depth = depthOf(area.parent_area_id) + 1;
    depths.set(id, depth);
    return depth;
  };
  for (const area of areas) depthOf(area.id);
  return depths;
}

/**
 * Innermost area that fully contains the given ring (every vertex inside).
 * Deeper areas win; at equal depth the smaller polygon wins, so a shape
 * inside two siblings nests under the tighter one. Returns null when the
 * ring is not fully inside any candidate.
 */
export function findInnermostArea<T extends AreaLike>(ring: number[][], areas: T[]): T | null {
  const depths = areaDepthMap(areas);
  let best: { area: T; depth: number; size: number } | null = null;
  for (const area of areas) {
    const candidateRing = toPolygonGeometry(area.geojson)?.coordinates?.[0];
    if (!candidateRing || candidateRing.length < 4) continue;
    if (!ring.every((pt) => pointInRing(pt[0], pt[1], candidateRing))) continue;
    const depth = depths.get(area.id) ?? 0;
    const size = polygonArea(candidateRing);
    if (!best || depth > best.depth || (depth === best.depth && size < best.size)) {
      best = { area, depth, size };
    }
  }
  return best?.area ?? null;
}

/**
 * Google Maps "Maps URL" for viewing a location (external reference only —
 * no API key, no FHA data sent). Returns null for invalid coordinates so
 * callers can skip the link. See
 * https://developers.google.com/maps/documentation/urls/get-started
 */
export function googleMapsUrl(latitude: number, longitude: number): string | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90) return null;
  if (longitude < -180 || longitude > 180) return null;
  return `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
}
