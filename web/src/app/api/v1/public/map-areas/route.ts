import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { rateLimitByIP } from "@/lib/rate-limit";
import { toPublicArea } from "@/lib/public-area";

/**
 * Public read-only area list for the shared map link (owner decision,
 * Oct 2026). Whitelisted fields only — see toPublicArea. No session, no
 * user identity, no photos/audit/activity; rate-limited per IP.
 */
export async function GET(req: Request) {
  const limit = rateLimitByIP(req, 60_000, 120);
  if (!limit.allowed) {
    return NextResponse.json(
      { success: false, error: { code: "RATE_LIMITED", message: "Too many requests — please try again shortly." } },
      { status: 429 }
    );
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase
    .from("map_areas")
    .select("id, name, area_type, status, geojson, metadata, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) {
    console.error("public map-areas query failed:", error.code, error.message);
    return NextResponse.json(
      { success: false, error: { code: "QUERY_ERROR", message: "Could not load the public map." } },
      { status: 500 }
    );
  }

  // Photo counts in one pass (public page shows a photo badge).
  const { data: photoRows } = await supabase
    .from("map_area_photos")
    .select("area_id")
    .limit(2000);
  const counts = new Map<string, number>();
  for (const row of photoRows ?? []) {
    counts.set(row.area_id, (counts.get(row.area_id) ?? 0) + 1);
  }

  const areas = (data ?? []).map((row) => toPublicArea(row, counts.get(row.id) ?? 0));

  return NextResponse.json({
    success: true,
    data: areas,
    meta: { demo: true, disclaimer: "DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD" },
  });
}
