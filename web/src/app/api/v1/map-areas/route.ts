import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthLike = { getUser: () => Promise<{ data: { user: any }; error: any }> };

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as AuthLike).getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const areaType = searchParams.get("area_type");
  const assignmentId = searchParams.get("assignment_id");
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10)));

  let query = supabase
    .from("map_areas")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status) query = query.eq("status", status);
  if (areaType) query = query.eq("area_type", areaType);
  if (assignmentId) query = query.eq("assignment_id", assignmentId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch map areas." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: data ?? [] });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as AuthLike).getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const body = await req.json();
  const { name, description, area_type, geometry, geojson, color, assignment_id, parent_area_id, plot_ids, metadata } = body;

  if (!name || !geojson) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Name and geojson are required." } }, { status: 400 });
  }

  // Build geometry from GeoJSON if not provided
  let geomWKT: string | undefined = geometry;
  if (!geomWKT && geojson?.coordinates) {
    // Convert GeoJSON polygon to WKT for PostGIS
    const coords = geojson.coordinates[0];
    if (coords && coords.length >= 4) {
      const wktCoords = coords.map((c: number[]) => `${c[0]} ${c[1]}`).join(", ");
      geomWKT = `SRID=4326;POLYGON((${wktCoords}))`;
    }
  }

  const insertData: Record<string, unknown> = {
    drawn_by: user.id,
    name,
    description: description ?? null,
    area_type: area_type ?? "INSPECTION_ZONE",
    status: "MARKED",
    geojson,
    color: color ?? null,
    assignment_id: assignment_id ?? null,
    parent_area_id: parent_area_id ?? null,
    plot_ids: plot_ids ?? [],
    metadata: metadata ?? {},
    is_demo: false,
  };

  if (geomWKT) {
    insertData.geometry = geomWKT;
  }

  const { data, error } = await supabase
    .from("map_areas")
    .insert(insertData)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: { code: "INSERT_ERROR", message: "Failed to create map area." } }, { status: 500 });
  }

  await auditLog({ action: "CREATE_MAP_AREA", entityType: "map_area", entityId: data.id, metadata: { name, area_type: area_type ?? "INSPECTION_ZONE" } });

  return NextResponse.json({ success: true, data }, { status: 201 });
}
