import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { readPropertyOutcome } from "@/lib/property-outcome";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireActive() {
  const { user, profile } = await getProfile();
  if (!user) return { error: NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 }) };
  if (!profile) return { error: NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 }) };
  return { user, role: profile.role };
}

// GET /api/v1/map-areas/[id]/photos/[photoId] — short-lived signed URL
export async function GET(_req: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const { id, photoId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(photoId)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID." } }, { status: 422 });
  }

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("map_area_photos")
    .select("id, storage_key, file_name")
    .eq("id", photoId)
    .eq("area_id", id)
    .maybeSingle();
  if (!photo) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Photo not found." } }, { status: 404 });
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from("area-photos")
    .createSignedUrl(photo.storage_key, 60);

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json({ success: false, error: { code: "SIGN_FAILED", message: "Could not generate photo URL." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { signedUrl: signedData.signedUrl, fileName: photo.file_name } });
}

// DELETE /api/v1/map-areas/[id]/photos/[photoId] — "mistake" removal.
// Allowed for the uploader (or admin/supervisor) and only while no property
// outcome has been recorded — RLS mirrors the same rule.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; photoId: string }> }) {
  const auth = await requireActive();
  if ("error" in auth) return auth.error;

  const { id, photoId } = await params;
  if (!UUID_RE.test(id) || !UUID_RE.test(photoId)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID." } }, { status: 422 });
  }

  const supabase = await createClient();
  const { data: area } = await supabase
    .from("map_areas")
    .select("id, metadata")
    .eq("id", id)
    .maybeSingle();
  if (!area) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
  }

  const outcomeState = readPropertyOutcome(area.metadata)?.state;
  if (outcomeState === "RECORDED" || outcomeState === "PROPOSED" || outcomeState === "ACCEPTED") {
    return NextResponse.json(
      { success: false, error: { code: "LOCKED", message: "A property outcome has been recorded on this area — photos can no longer be deleted." } },
      { status: 403 }
    );
  }

  const { data: photo } = await supabase
    .from("map_area_photos")
    .select("id, storage_key, uploaded_by")
    .eq("id", photoId)
    .eq("area_id", id)
    .maybeSingle();
  if (!photo) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Photo not found." } }, { status: 404 });
  }

  const canDelete = photo.uploaded_by === auth.user.id || auth.role === "ADMIN" || auth.role === "SUPERVISOR";
  if (!canDelete) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "You can only delete your own photos." } }, { status: 403 });
  }

  const { error: delError, count } = await supabase
    .from("map_area_photos")
    .delete({ count: "exact" })
    .eq("id", photoId);

  if (delError || !count) {
    return NextResponse.json({ success: false, error: { code: "DELETE_FAILED", message: "Could not delete the photo." } }, { status: 500 });
  }

  // Best-effort object removal — the row is already gone either way
  try { await supabase.storage.from("area-photos").remove([photo.storage_key]); } catch { /* best effort */ }

  await auditLog({ action: "DELETE_AREA_PHOTO", entityType: "map_area_photo", entityId: photoId, metadata: { areaId: id } });

  return NextResponse.json({ success: true, data: { id: photoId } });
}
