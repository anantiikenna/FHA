import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { toPolygonGeometry, ringToEwkt, pointInRing } from "@/lib/geo";

import type { AuthLike } from "@/lib/supabase/types";

const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"];

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
  const assignmentId = searchParams.get("assignment_id");
  const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") ?? "200", 10)));

  let query = supabase
    .from("map_areas")
    .select("id, name, description, area_type, status, geojson, color, drawn_by, assignment_id, parent_area_id, plot_ids, created_at, updated_at")
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
  const { user, profile } = await getProfile();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }
  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 });
  }
  const role = profile.role;
  const isZoneAdmin = ADMIN_ROLES.includes(role);
  const isEngineer = role === "ENGINEER";

  if (!isZoneAdmin && !isEngineer) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Invalid request body." } }, { status: 400 });
  }
  const { name, description, area_type, geojson, color, assignment_id, parent_area_id, plot_ids, metadata } = body;

  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Name is required." } }, { status: 400 });
  }
  if (name.trim().length > 200) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Name must be 200 characters or fewer." } }, { status: 400 });
  }
  if (!geojson) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Drawn shape is required." } }, { status: 400 });
  }

  const polygon = toPolygonGeometry(geojson);
  if (!polygon) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Could not read the drawn shape. Draw a polygon with at least 3 points." } }, { status: 400 });
  }

  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const safePlotIds = (Array.isArray(plot_ids) ? plot_ids : [])
    .filter((v: unknown): v is string => typeof v === "string" && UUID_RE.test(v))
    .slice(0, 500);

  const supabase = await createClient();

  let areaType: string = area_type ?? "INSPECTION_ZONE";
  let status: string = "MARKED";
  let parentId: string | null = parent_area_id ?? null;
  let assignmentId: string | null = assignment_id ?? null;
  let plotIds: string[] = safePlotIds;
  let assignedZoneId: string | null = null;

  if (isEngineer) {
    // Engineers may only draw field areas (INSPECTED_AREA) inside a zone assigned to them.
    const { data: myAssignments } = await supabase
      .from("inspection_assignments")
      .select("id, geo_unit_id")
      .eq("assigned_to", user.id);

    const myAssignmentIds = new Set((myAssignments ?? []).map((a: { id: string }) => a.id));
    const myGeoUnitIds = new Set((myAssignments ?? []).map((a: { geo_unit_id: string }) => a.geo_unit_id));

    const { data: zoneRows } = await supabase
      .from("map_areas")
      .select("id, name, assignment_id, plot_ids, geojson, metadata")
      .eq("area_type", "INSPECTION_ZONE")
      .limit(200);

    const assignedZones = (zoneRows ?? []).filter((z: { assignment_id?: string | null; metadata?: unknown }) => {
      const meta = z.metadata && typeof z.metadata === "object" ? (z.metadata as Record<string, unknown>) : null;
      const metaUnit = meta ? meta.geo_unit_id : undefined;
      return (
        (z.assignment_id && myAssignmentIds.has(z.assignment_id)) ||
        (typeof metaUnit === "string" && myGeoUnitIds.has(metaUnit))
      );
    });

    if (assignedZones.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "NO_ASSIGNED_ZONE", message: "No zone has been assigned to you yet. Ask your supervisor to assign you a zone before drawing." } },
        { status: 403 }
      );
    }

    const childRing = polygon.coordinates[0];
    let zone: (typeof assignedZones)[number] | null = null;
    for (const z of assignedZones) {
      const zoneRing = toPolygonGeometry(z.geojson)?.coordinates?.[0];
      if (!zoneRing) continue;
      if (childRing.every((pt) => pointInRing(pt[0], pt[1], zoneRing))) {
        zone = z;
        break;
      }
    }
    if (!zone) {
      return NextResponse.json(
        { success: false, error: { code: "OUTSIDE_ASSIGNED_ZONE", message: "The area you drew must lie completely inside a zone assigned to you." } },
        { status: 422 }
      );
    }

    const zonePlotIds = (Array.isArray(zone.plot_ids) ? zone.plot_ids : [])
      .filter((v: unknown): v is string => typeof v === "string" && UUID_RE.test(v));
    const zonePlotSet = new Set(zonePlotIds);
    const plotsInside = safePlotIds.filter((p) => zonePlotSet.has(p));

    // Resolve MY assignment for this zone (a zone can have several officers;
    // zone.assignment_id only holds the most recent one, so fall back to the
    // zone's geo unit which every assignment on the zone shares).
    const zoneMeta = zone.metadata && typeof zone.metadata === "object" ? (zone.metadata as Record<string, unknown>) : null;
    const zoneUnitId = typeof zoneMeta?.geo_unit_id === "string" ? zoneMeta.geo_unit_id : null;
    const myAssignment =
      (myAssignments ?? []).find(
        (a: { id: string; geo_unit_id: string | null }) =>
          a.id === zone.assignment_id || (zoneUnitId !== null && a.geo_unit_id === zoneUnitId)
      ) ?? null;

    if (!myAssignment) {
      return NextResponse.json(
        { success: false, error: { code: "NO_ASSIGNED_ZONE", message: "No zone has been assigned to you yet. Ask your supervisor to assign you a zone before drawing." } },
        { status: 403 }
      );
    }

    // Sections may only cover plots inside my own assignment scope
    // (partitioned progress — see WORKFLOWS v0.2 §6).
    const { data: scopeRows } = await supabase
      .from("assignment_areas")
      .select("geo_unit_id")
      .eq("assignment_id", myAssignment.id);
    const scopeSet = new Set((scopeRows ?? []).map((r: { geo_unit_id: string }) => r.geo_unit_id));
    if (scopeSet.size > 0 && plotsInside.some((p) => !scopeSet.has(p))) {
      return NextResponse.json(
        { success: false, error: { code: "OUTSIDE_ASSIGNED_SCOPE", message: "The area you drew covers plots outside your assignment. Only plots in your assigned scope can be part of a field area." } },
        { status: 422 }
      );
    }

    areaType = "INSPECTED_AREA";
    status = "DRAFT";
    parentId = zone.id;
    assignedZoneId = zone.id;
    assignmentId = myAssignment.id;
    // Only plots actually inside the drawn shape count as covered — an area
    // with no plots inside covers nothing (never inherit the whole zone list).
    plotIds = plotsInside;
  }

  const insertData: Record<string, unknown> = {
    drawn_by: user.id,
    name: name.trim(),
    description: description ?? null,
    area_type: areaType,
    status,
    geometry: ringToEwkt(polygon.coordinates[0]),
    geojson: polygon,
    color: color ?? null,
    assignment_id: assignmentId,
    parent_area_id: parentId,
    plot_ids: plotIds,
    metadata: metadata && typeof metadata === "object" ? metadata : {},
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

  // NOTE: creating a section never moves the progress bar — only submitted
  // work counts, and only via this assignment's own plot rows
  // (recomputeAssignmentProgress — WORKFLOWS v0.2 §6).

  await auditLog({
    action: "CREATE_MAP_AREA",
    entityType: "map_area",
    entityId: data.id,
    metadata: { name, area_type: areaType, parent_area_id: assignedZoneId ?? parentId },
  });

  return NextResponse.json({ success: true, data }, { status: 201 });
}
