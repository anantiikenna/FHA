import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function fetchOfficerNames(ids: string[]): Promise<Map<string, { display_name: string; role: string }>> {
  const names = new Map<string, { display_name: string; role: string }>();
  if (ids.length === 0) return names;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    try {
      const res = await fetch(`${url}/rest/v1/profiles?id=in.("${ids.join('","')}")&select=id,display_name,role`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (res.ok) {
        const rows = (await res.json()) as Array<{ id: string; display_name: string; role: string }>;
        for (const row of rows) names.set(row.id, { display_name: row.display_name, role: row.role });
        return names;
      }
    } catch {
      // fall through to user-scoped client
    }
  }

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name, role").in("id", ids);
  for (const row of data ?? []) names.set(row.id, { display_name: row.display_name, role: row.role });
  return names;
}

// geographical_units has no authenticated INSERT grant — zone geo-units are
// created with the service role (same pattern as admin/user writes).
async function createZoneGeoUnit(name: string, zoneId: string): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  try {
    const res = await fetch(`${url}/rest/v1/geographical_units`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        unit_type: "ZONE",
        name: name.slice(0, 200),
        description: `Created from map inspection zone ${zoneId}`,
        is_demo: false,
      }),
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{ id: string }>;
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function requireActive() {
  const { user, profile } = await getProfile();
  if (!user) return { error: NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 }) };
  if (!profile) return { error: NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 }) };
  return { user, role: profile.role };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createClient();

  const { data: zone } = await supabase
    .from("map_areas")
    .select("id, area_type, metadata")
    .eq("id", id)
    .maybeSingle();
  if (!zone || zone.area_type !== "INSPECTION_ZONE") {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection zone not found." } }, { status: 404 });
  }

  const meta = zone.metadata && typeof zone.metadata === "object" ? (zone.metadata as Record<string, unknown>) : null;
  const geoUnitId = meta && typeof meta.geo_unit_id === "string" && UUID_RE.test(meta.geo_unit_id) ? meta.geo_unit_id : null;
  if (!geoUnitId) {
    return NextResponse.json({ success: true, data: [] });
  }

  const { data: assignments } = await supabase
    .from("inspection_assignments")
    .select("id, assignment_number, status, assigned_to, created_at")
    .eq("geo_unit_id", geoUnitId)
    .order("created_at", { ascending: false });

  const officerIds = [...new Set((assignments ?? []).map((a) => a.assigned_to).filter((v): v is string => typeof v === "string"))];
  const officers = await fetchOfficerNames(officerIds);

  const items = (assignments ?? [])
    .filter((a) => typeof a.assigned_to === "string")
    .map((a) => ({
      assignment_id: a.id,
      assignment_number: a.assignment_number,
      status: a.status,
      assigned_to: a.assigned_to,
      officer_name: officers.get(a.assigned_to as string)?.display_name ?? null,
      created_at: a.created_at,
    }));

  return NextResponse.json({ success: true, data: items });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;
  if (!ADMIN_ROLES.includes(auth.role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Only Supervisors, Admins, or GIS Officers can assign zones." } }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const assignedTo = body?.assigned_to;
  if (!assignedTo || typeof assignedTo !== "string" || !UUID_RE.test(assignedTo)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "assigned_to must be a valid user id." } }, { status: 400 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: zone } = await supabase
    .from("map_areas")
    .select("id, name, status, area_type, assignment_id, plot_ids, metadata")
    .eq("id", id)
    .maybeSingle();
  if (!zone || zone.area_type !== "INSPECTION_ZONE") {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection zone not found." } }, { status: 404 });
  }

  const { data: target } = await supabase
    .from("profiles")
    .select("id, display_name, role, is_active")
    .eq("id", assignedTo)
    .maybeSingle();
  if (!target) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "User not found." } }, { status: 404 });
  }
  if (target.role !== "ENGINEER") {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Zones can only be assigned to field engineers." } }, { status: 422 });
  }
  if (target.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "This user is deactivated." } }, { status: 422 });
  }

  // Ensure the zone has a geo-unit (required by inspection_assignments.geo_unit_id)
  const meta = zone.metadata && typeof zone.metadata === "object" ? (zone.metadata as Record<string, unknown>) : {};
  let geoUnitId = typeof meta.geo_unit_id === "string" && UUID_RE.test(meta.geo_unit_id) ? meta.geo_unit_id : null;
  if (!geoUnitId) {
    geoUnitId = await createZoneGeoUnit(zone.name ?? "Inspection zone", zone.id);
    if (!geoUnitId) {
      return NextResponse.json(
        { success: false, error: { code: "CONFIG_ERROR", message: "Could not prepare the zone for assignment. Please try again." } },
        { status: 500 }
      );
    }
    const { error: zoneMetaError } = await supabase
      .from("map_areas")
      .update({ metadata: { ...meta, geo_unit_id: geoUnitId } })
      .eq("id", zone.id);
    if (zoneMetaError) {
      return NextResponse.json({ success: false, error: { code: "UPDATE_ERROR", message: "Could not link the zone for assignment." } }, { status: 500 });
    }
  }

  // One active assignment per officer per zone
  const { data: existing } = await supabase
    .from("inspection_assignments")
    .select("id, status")
    .eq("geo_unit_id", geoUnitId)
    .eq("assigned_to", assignedTo)
    .neq("status", "CANCELLED")
    .maybeSingle();
  if (existing) {
    return NextResponse.json(
      { success: false, error: { code: "ALREADY_ASSIGNED", message: `${target.display_name} is already assigned to this zone.` } },
      { status: 409 }
    );
  }

  // Generate assignment number with retry on collision
  let assignmentNumber = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const randStr = crypto.randomUUID().split("-")[0].toUpperCase().substring(0, 4);
    assignmentNumber = `FHA/ASN/${new Date().getFullYear()}/${randStr}`;
    const { data: existingNumber } = await supabase
      .from("inspection_assignments")
      .select("id")
      .eq("assignment_number", assignmentNumber)
      .maybeSingle();
    if (!existingNumber) break;
  }

  const zonePlotIds = (Array.isArray(zone.plot_ids) ? zone.plot_ids : [])
    .filter((v: unknown): v is string => typeof v === "string" && UUID_RE.test(v));

  // assignment_areas.geo_unit_id must reference existing plot geo-units
  let validPlotIds: string[] = [];
  if (zonePlotIds.length > 0) {
    const { data: plotUnits } = await supabase
      .from("geographical_units")
      .select("id")
      .in("id", zonePlotIds);
    validPlotIds = (plotUnits ?? []).map((u) => u.id);
  }

  const { data: assignment, error: assignError } = await supabase
    .from("inspection_assignments")
    .insert({
      assignment_number: assignmentNumber,
      title: `Zone: ${zone.name}`.slice(0, 200),
      description: `Field assignment for marked zone "${zone.name}".`,
      geo_unit_id: geoUnitId,
      assigned_to: assignedTo,
      created_by: auth.user.id,
      status: "ACTIVE",
      priority: "NORMAL",
      total_areas: validPlotIds.length,
    })
    .select()
    .single();

  if (assignError) {
    console.error("zone assignment insert failed:", { code: assignError.code, message: assignError.message });
    return NextResponse.json({ success: false, error: { code: "CREATE_FAILED", message: "Failed to create the assignment." } }, { status: 500 });
  }

  if (validPlotIds.length > 0) {
    const rows = validPlotIds.map((plotId, i) => ({
      assignment_id: assignment.id,
      geo_unit_id: plotId,
      sort_order: i + 1,
      status: "NOT_INSPECTED" as const,
    }));
    await supabase.from("assignment_areas").insert(rows);
  }

  const zoneUpdates: Record<string, unknown> = { assignment_id: assignment.id };
  if (zone.status === "MARKED") zoneUpdates.status = "IN_PROGRESS";
  await supabase.from("map_areas").update(zoneUpdates).eq("id", zone.id);

  await auditLog({
    action: "ASSIGN_ZONE",
    entityType: "map_area",
    entityId: zone.id,
    metadata: { assigned_to: assignedTo, assignment_id: assignment.id, plotCount: validPlotIds.length },
  });

  return NextResponse.json(
    { success: true, data: { ...assignment, officer_name: target.display_name } },
    { status: 201 }
  );
}
