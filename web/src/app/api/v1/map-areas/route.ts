import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";
import { auditLog } from "@/lib/audit";
import { toPolygonGeometry, ringToEwkt, pointInRing, findInnermostArea } from "@/lib/geo";

// Drawn-area types (owner decision, Oct 2026): a drawn area is a ZONE
// (container), a PLOT, or a PROPERTY (leaf — carries a direct outcome).
export const DRAWN_AREA_TYPES = ["ZONE", "PLOT", "PROPERTY"] as const;

export async function GET(req: Request) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: activeProfile } = await supabase
    .from("profiles")
    .select("id, is_active")
    .eq("id", user.id)
    .single();
  if (!activeProfile || activeProfile.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const areaType = searchParams.get("area_type");
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10)));

  let query = supabase
    .from("map_areas")
    .select("id, name, description, area_type, status, geojson, color, drawn_by, parent_area_id, plot_ids, metadata, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (areaType) query = query.eq("area_type", areaType);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch map areas." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(req: Request) {
  const { user, profile } = await getProfile();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }
  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Invalid request body." } }, { status: 400 });
  }
  const { name, description, area_type, geojson, color, plot_ids, metadata } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Name is required." } }, { status: 400 });
  }
  if (name.trim().length > 200) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Name must be 200 characters or fewer." } }, { status: 400 });
  }
  if (!geojson) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Drawn shape is required." } }, { status: 400 });
  }
  const areaType = typeof area_type === "string" ? area_type.toUpperCase() : "";
  if (!(DRAWN_AREA_TYPES as readonly string[]).includes(areaType)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION", message: "area_type must be ZONE, PLOT, or PROPERTY." } },
      { status: 400 }
    );
  }

  const polygon = toPolygonGeometry(geojson);
  if (!polygon) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Could not read the drawn shape. Draw a polygon with at least 3 points." } }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const plotIds = (Array.isArray(plot_ids) ? plot_ids : [])
    .filter((v: unknown): v is string => typeof v === "string" && UUID_RE.test(v))
    .slice(0, 500);

  const supabase = await createClient();

  // Containment: a zone drawn inside another zone nests under it; a
  // property/plot links to the innermost containing zone (parent chains keep
  // the zone ↔ property relationship; standalone leaves stay top-level).
  type AreaRow = { id: string; area_type: string; geojson: unknown };
  const { data: zoneRows } = await supabase
    .from("map_areas")
    .select("id, area_type, geojson")
    .eq("area_type", "ZONE")
    .order("created_at", { ascending: false })
    .limit(200);
  const zones = (zoneRows ?? []) as AreaRow[];

  let parentId: string | null = null;
  const childRing = polygon.coordinates[0];
  const container = findInnermostArea(childRing, zones);
  if (container) {
    // Safety: containment must hold against the whole container ring.
    const containerRing = toPolygonGeometry(container.geojson)?.coordinates?.[0];
    if (containerRing && childRing.every((pt) => pointInRing(pt[0], pt[1], containerRing))) {
      parentId = container.id;
    }
  }

  const status = areaType === "ZONE" ? "ACTIVE" : "AWAITING_OUTCOME";

  const insertData: Record<string, unknown> = {
    drawn_by: user.id,
    name: name.trim(),
    description: description ?? null,
    area_type: areaType,
    status,
    geometry: ringToEwkt(polygon.coordinates[0]),
    geojson: polygon,
    color: color ?? null,
    parent_area_id: parentId,
    plot_ids: plotIds,
    metadata: {
      ...(metadata && typeof metadata === "object" ? metadata : {}),
      name: name.trim(),
      area_type: areaType,
      parent_area_id: parentId,
    },
    is_demo: false,
  };

  const { data, error } = await supabase
    .from("map_areas")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error("map_areas insert failed:", { code: error.code, message: error.message, details: error.details, hint: error.hint });
    const message = error.code === "23502" ? "Map area geometry is required." : "Failed to create map area.";
    return NextResponse.json({ success: false, error: { code: "INSERT_ERROR", message } }, { status: 500 });
  }

  await auditLog({
    action: "CREATE_MAP_AREA",
    entityType: "map_area",
    entityId: data.id,
    metadata: { name, area_type: areaType, parent_area_id: parentId },
  });

  return NextResponse.json({ success: true, data }, { status: 201 });
}
