import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/v1/plots/[id]/photo — latest evidence photo from a map area
// covering this plot (the "building photo"). Responds 302 to a short-lived
// signed URL so it can be used directly as an <img src> (map popup, records
// list). 404 when the plot has no photo yet — callers should hide the image
// on error.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { user, profile } = await getProfile();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }
  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 });
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID." } }, { status: 422 });
  }

  const supabase = await createClient();

  const { data: areas } = await supabase
    .from("map_areas")
    .select("id")
    .contains("plot_ids", [id])
    .order("created_at", { ascending: false })
    .limit(50);
  const areaIds = (areas ?? []).map((r) => r.id);
  if (areaIds.length === 0) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "No photo for this plot." } }, { status: 404 });
  }

  const { data: photo } = await supabase
    .from("map_area_photos")
    .select("id, storage_key")
    .in("area_id", areaIds)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!photo) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "No photo for this plot." } }, { status: 404 });
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from("area-photos")
    .createSignedUrl(photo.storage_key, 300);
  if (signError || !signedData?.signedUrl) {
    return NextResponse.json({ success: false, error: { code: "SIGN_FAILED", message: "Could not generate photo URL." } }, { status: 500 });
  }

  return NextResponse.redirect(signedData.signedUrl, { status: 302 });
}
