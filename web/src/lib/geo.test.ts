import { describe, expect, it } from "vitest";
import {
  areaDepthMap,
  findInnermostArea,
  googleMapsUrl,
  plotIdsInside,
  pointInRing,
  polygonArea,
  toPolygonGeometry,
  type AreaLike,
} from "@/lib/geo";

/** Closed axis-aligned square ring at (x,y) with the given size. */
function sq(x: number, y: number, size: number): number[][] {
  return [
    [x, y],
    [x + size, y],
    [x + size, y + size],
    [x, y + size],
    [x, y],
  ];
}

function polyArea(id: string, ring: number[][], parent: string | null = null): AreaLike {
  return { id, parent_area_id: parent, geojson: { type: "Polygon", coordinates: [ring] } };
}

describe("polygonArea", () => {
  it("computes shoelace area of a square", () => {
    expect(polygonArea(sq(0, 0, 1))).toBeCloseTo(1, 10);
    expect(polygonArea(sq(0, 0, 10))).toBeCloseTo(100, 10);
  });

  it("is orientation-independent (absolute value)", () => {
    expect(polygonArea([...sq(0, 0, 1)].reverse())).toBeCloseTo(1, 10);
  });

  it("returns 0 for a degenerate collinear ring", () => {
    expect(polygonArea([[0, 0], [1, 0], [2, 0], [0, 0]])).toBeCloseTo(0, 10);
  });
});

describe("pointInRing", () => {
  const ring = sq(0, 0, 10);

  it("detects points inside and outside", () => {
    expect(pointInRing(5, 5, ring)).toBe(true);
    expect(pointInRing(20, 5, ring)).toBe(false);
    expect(pointInRing(-1, -1, ring)).toBe(false);
  });
});

describe("plotIdsInside", () => {
  const poly = toPolygonGeometry({ type: "Polygon", coordinates: [sq(0, 0, 10)] });
  const plots = [
    { id: "in", lat: 5, lng: 5 },
    { id: "out", lat: 50, lng: 50 },
    { id: "no-coords", lat: null, lng: null },
  ];

  it("returns only plots whose point is inside the polygon", () => {
    expect(plotIdsInside(poly, plots)).toEqual(["in"]);
  });

  it("returns [] for a null polygon", () => {
    expect(plotIdsInside(null, plots)).toEqual([]);
  });
});

describe("toPolygonGeometry", () => {
  it("closes an open ring", () => {
    const g = toPolygonGeometry({
      type: "Polygon",
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1]]],
    });
    expect(g?.coordinates[0]).toHaveLength(5);
    expect(g?.coordinates[0][0]).toEqual(g?.coordinates[0][4]);
  });

  it("rejects out-of-range coordinates", () => {
    expect(
      toPolygonGeometry({ type: "Polygon", coordinates: [[[0, 0], [500, 0], [500, 500], [0, 0]]] })
    ).toBeNull();
  });

  it("rejects non-polygon garbage", () => {
    expect(toPolygonGeometry(null)).toBeNull();
    expect(toPolygonGeometry("poly")).toBeNull();
    expect(toPolygonGeometry({ type: "Polygon", coordinates: [[1, 2]] })).toBeNull();
  });
});

describe("areaDepthMap", () => {
  it("assigns depth 0 to roots, +1 per nesting level", () => {
    const depths = areaDepthMap([
      polyArea("zone", sq(0, 0, 100)),
      polyArea("child", sq(10, 10, 10), "zone"),
      polyArea("grandchild", sq(12, 12, 4), "child"),
    ]);
    expect(depths.get("zone")).toBe(0);
    expect(depths.get("child")).toBe(1);
    expect(depths.get("grandchild")).toBe(2);
  });

  it("treats a dangling parent reference as depth 0", () => {
    const depths = areaDepthMap([polyArea("orphan", sq(0, 0, 10), "missing")]);
    expect(depths.get("orphan")).toBe(0);
  });

  it("terminates on parent cycles instead of recursing forever", () => {
    const depths = areaDepthMap([
      polyArea("a", sq(0, 0, 10), "b"),
      polyArea("b", sq(0, 0, 5), "a"),
    ]);
    expect(depths.has("a")).toBe(true);
    expect(depths.has("b")).toBe(true);
  });
});

describe("findInnermostArea", () => {
  // Square sizes must stay inside lat/lon bounds (|y| <= 90) — toPolygonGeometry
  // rejects out-of-range candidate geometry, as it should.
  const zone = polyArea("zone", sq(0, 0, 80));
  const child = polyArea("child", sq(10, 10, 40), "zone");
  const grandchild = polyArea("grandchild", sq(20, 20, 10), "child");

  it("nests under the innermost containing area at any depth", () => {
    expect(findInnermostArea(sq(22, 22, 5), [zone, child, grandchild])?.id).toBe("grandchild");
    expect(findInnermostArea(sq(12, 12, 5), [zone, child, grandchild])?.id).toBe("child");
    expect(findInnermostArea(sq(60, 60, 5), [zone, child, grandchild])?.id).toBe("zone");
  });

  it("returns null when the ring is not fully inside any area", () => {
    expect(findInnermostArea(sq(200, 200, 5), [zone, child, grandchild])).toBeNull();
  });

  it("falls back to the outer area when one vertex escapes an inner area", () => {
    // 3 corners inside child, 4th outside child but inside zone
    const ring = [
      [15, 15],
      [45, 15],
      [45, 45],
      [15, 70],
      [15, 15],
    ];
    expect(findInnermostArea(ring, [zone, child])?.id).toBe("zone");
  });

  it("breaks equal-depth ties toward the smaller area", () => {
    const big = polyArea("big", sq(10, 10, 60), "zone");
    const small = polyArea("small", sq(20, 20, 40), "zone");
    expect(findInnermostArea(sq(25, 25, 10), [zone, big, small])?.id).toBe("small");
  });

  it("ignores areas with unusable geometry", () => {
    const broken: AreaLike = { id: "broken", parent_area_id: "zone", geojson: { type: "Polygon", coordinates: [[[0, 0]]] } };
    expect(findInnermostArea(sq(1, 1, 2), [zone, broken])?.id).toBe("zone");
  });
  it("works with an empty candidate list", () => {
    expect(findInnermostArea(sq(0, 0, 1), [])).toBeNull();
  });
});

describe("googleMapsUrl", () => {
  it("builds a Maps URL for valid coordinates", () => {
    expect(googleMapsUrl(6.4698, 3.5852)).toBe(
      "https://www.google.com/maps/search/?api=1&query=6.4698,3.5852"
    );
  });

  it("keeps full coordinate precision", () => {
    expect(googleMapsUrl(-33.8688197, 151.2053211)).toBe(
      "https://www.google.com/maps/search/?api=1&query=-33.8688197,151.2053211"
    );
  });

  it("accepts boundary values", () => {
    expect(googleMapsUrl(90, 180)).not.toBeNull();
    expect(googleMapsUrl(-90, -180)).not.toBeNull();
  });

  it("rejects out-of-range coordinates", () => {
    expect(googleMapsUrl(91, 0)).toBeNull();
    expect(googleMapsUrl(0, 181)).toBeNull();
    expect(googleMapsUrl(-90.1, -180.1)).toBeNull();
  });

  it("rejects non-finite coordinates", () => {
    expect(googleMapsUrl(NaN, 0)).toBeNull();
    expect(googleMapsUrl(0, Infinity)).toBeNull();
  });
});
