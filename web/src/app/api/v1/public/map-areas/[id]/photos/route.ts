import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitByIP } from "@/lib/rate-limit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNED_URL_TTL_SECONDS = 60;

/**
 * Public read-only evidence photos for one area: short-lived signed URLs
 * only. Never exposes uploader, GPS, or storage keys (owner decision —
 * the public may view building photos, not their provenance).
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const limit = rateLimitByIP(req, 60_000, 120);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", message: "Too many requests — please try again shortly." } },
      { status: 429 }
    );
  }

  const { id } = await params;
  if (!UUID_RE.test(id)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID." } },
      { status: 422 }
    );
  }

  const supabase = createServiceClient();

  const { data: area, error: areaError } = await supabase
    .from("map_areas")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (areaError) {
    console.error("public photos area lookup failed:", areaError.code, areaError.message);
    return NextResponse.json(
      { success: false, error: { code: "QUERY_ERROR", message: "Could not load photos." } },
      { status: 500 }
    );
  }
  if (!area) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Map area not found." } },
      { status: 404 }
    );
  }

  const { data: photos, error } = await supabase
    .from("map_area_photos")
    .select("id, storage_key, file_name, mime_type, captured_at, created_at")
    .eq("area_id", id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    console.error("public photos query failed:", error.code, error.message);
    return NextResponse.json(
      { success: false, error: { code: "QUERY_ERROR", message: "Could not load photos." } },
      { status: 500 }
    );
  }

  const signed: Array<{
    id: string;
    file_name: string;
    mime_type: string;
    captured_at: string | null;
    created_at: string;
    url: string | null;
  }> = [];
  for (const photo of photos ?? []) {
    const { data: signedData, error: signError } = await supabase.storage
      .from("area-photos")
      .createSignedUrl(photo.storage_key, SIGNED_URL_TTL_SECONDS);
    if (signError) {
      console.error("public photo sign failed:", signError.message);
      continue;
    }
    signed.push({
      id: photo.id,
      file_name: photo.file_name,
      mime_type: photo.mime_type,
      captured_at: photo.captured_at,
      created_at: photo.created_at,
      url: signedData?.signedUrl ?? null,
    });
  }

  return NextResponse.json({
    success: true,
    data: signed,
    meta: { area_id: id, count: signed.length, expires_in: SIGNED_URL_TTL_SECONDS },
  });
}
