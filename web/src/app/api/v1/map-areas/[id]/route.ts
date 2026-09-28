import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

const ADMIN_ROLES = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"];

async function requireAuth() {
  const { user, profile } = await getProfile();
  if (!user) {
    return { error: NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 }) };
  }
  if (!profile) {
    return { error: NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 }) };
  }
  return { user, role: profile.role };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("map_areas")
    .select("id, name, description, area_type, status, geojson, color, drawn_by, assignment_id, plot_ids, metadata, created_at, updated_at")
    .eq("id", id)
    .single();

  if (error || !data) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
  }

  return NextResponse.json({ success: true, data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  const supabase = await createClient();

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Invalid request body." } }, { status: 400 });
  }

  const VALID_STATUSES = ["DRAFT", "MARKED", "IN_PROGRESS", "INSPECTED", "AWAITING_REVIEW", "APPROVED", "REJECTED", "REINSPECTION_REQUIRED"];
  const isStatusOnly = Object.keys(body).length === 1 && "status" in body;
  const isApprovalOfficer = auth.role === "APPROVAL_OFFICER";

  // APPROVAL_OFFICER may only change status; full field edits require ADMIN/SUPERVISOR/GIS_OFFICER
  if (isApprovalOfficer) {
    if (!isStatusOnly) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Approval officers may only update status." } },
        { status: 403 }
      );
    }
  } else if (!auth.role || !ADMIN_ROLES.includes(auth.role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  const allowed = isApprovalOfficer
    ? ["status"]
    : ["name", "description", "status", "color", "area_type", "assignment_id", "plot_ids", "metadata"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) updates[key] = body[key];
  }

  // Validate status against enum
  if (updates.status && !VALID_STATUSES.includes(updates.status as string)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` } }, { status: 422 });
  }

  if ("plot_ids" in updates) {
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    updates.plot_ids = (Array.isArray(updates.plot_ids) ? updates.plot_ids : [])
      .filter((v: unknown): v is string => typeof v === "string" && UUID_RE.test(v))
      .slice(0, 500);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "No valid fields to update." } }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("map_areas")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_ERROR", message: "Failed to update map area." } }, { status: 500 });
  }

  await auditLog({ action: "UPDATE_MAP_AREA", entityType: "map_area", entityId: id, metadata: updates });

  return NextResponse.json({ success: true, data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireAuth();
  if ("error" in auth) return auth.error;

  if (!auth.role || !ADMIN_ROLES.includes(auth.role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  const { id } = await params;
  const supabase = await createClient();

  const { data: deletedRows, error } = await supabase
    .from("map_areas")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete map area." } }, { status: 500 });
  }

  // RLS can silently filter deletes — verify a row was actually removed
  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete map area." } }, { status: 500 });
  }

  await auditLog({ action: "DELETE_MAP_AREA", entityType: "map_area", entityId: id, metadata: {} });

  return NextResponse.json({ success: true });
}
