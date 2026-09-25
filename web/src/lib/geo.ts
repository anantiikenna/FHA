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
