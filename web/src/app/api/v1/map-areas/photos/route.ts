import { NextResponse } from "next/server";
import { createClient, getProfile } from "@/lib/supabase/server";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_AREAS = 100;

// GET /api/v1/map-areas/photos?area_ids=a,b,c
// Latest evidence photo per area with a short-lived signed URL — used by
// lists (records, zone queue) that show one thumbnail per area.
export async function GET(req: Request) {
  const { user, profile } = await getProfile();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }
  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated or profile missing." } }, { status: 403 });
  }

  const raw = new URL(req.url).searchParams.get("area_ids") ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (ids.length === 0 || ids.length > MAX_AREAS || ids.some((id) => !UUID_RE.test(id))) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: `Provide 1-${MAX_AREAS} valid area IDs.` } },
      { status: 422 }
    );
  }

  const supabase = await createClient();
  const { data: photos, error } = await supabase
    .from("map_area_photos")
    .select("id, area_id, storage_key, file_name, created_at")
    .in("area_id", ids)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch photos." } }, { status: 500 });
  }

  // Latest photo per area (rows are newest-first)
  const latest = new Map<string, { id: string; area_id: string; file_name: string; created_at: string; storage_key: string }>();
  for (const row of photos ?? []) {
    if (!latest.has(row.area_id)) latest.set(row.area_id, row);
  }

  const items: Array<{ area_id: string; photo: { id: string; file_name: string; created_at: string }; signedUrl: string | null }> = [];
  for (const [areaId, row] of latest) {
    let signedUrl: string | null = null;
    try {
      const { data } = await supabase.storage.from("area-photos").createSignedUrl(row.storage_key, 300);
      signedUrl = data?.signedUrl ?? null;
    } catch {
      signedUrl = null;
    }
    items.push({
      area_id: areaId,
      photo: { id: row.id, file_name: row.file_name, created_at: row.created_at },
      signedUrl,
    });
  }

  return NextResponse.json({ success: true, data: items });
}
