import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

import type { AuthLike } from "@/lib/supabase/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IDS = 100;

// GET /api/v1/map-areas/history?areaIds=<uuid>[,<uuid>...]
// Who submitted / approved / rejected / re-inspected each area, plus
// property-outcome events (newest first). One call can cover many areas so
// queue views avoid N+1 requests.
export async function GET(req: Request) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_active")
    .eq("id", user.id)
    .single();
  if (!profile || profile.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
  }

  const url = new URL(req.url);
  const raw = url.searchParams.get("areaIds") ?? "";
  const ids = raw.split(",").map((s) => s.trim()).filter(Boolean);

  if (ids.length === 0 || ids.length > MAX_IDS || !ids.every((v) => UUID_RE.test(v))) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: `areaIds must be 1-${MAX_IDS} comma-separated UUIDs.` } },
      { status: 422 }
    );
  }

  const { data: history, error } = await supabase
    .from("map_area_status_history")
    .select("id, area_id, field, old_value, new_value, created_at, changed_by:profiles(display_name)")
    .in("area_id", ids)
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("map_area_status_history query failed:", error.code, error.message);
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch activity history." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { items: history ?? [] } });
}
