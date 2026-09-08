import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthLike = { getUser: () => Promise<{ data: { user: any }; error: any }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/v1/geo-units — list geographical units (hierarchical)
export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as AuthLike).getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const url = new URL(req.url);
  const parentId = url.searchParams.get("parent_id");
  const unitType = url.searchParams.get("type");
  const estateId = url.searchParams.get("estate_id");

  let query = supabase
    .from("geographical_units")
    .select("id, parent_id, unit_type, name, code, latitude, longitude, area_size, area_size_unit, inspection_status, approval_status, is_demo")
    .order("name");

  if (parentId) {
    if (!UUID_RE.test(parentId)) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Invalid parent_id format." } }, { status: 400 });
    }
    query = query.eq("parent_id", parentId);
  } else if (estateId) {
    if (!UUID_RE.test(estateId)) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION", message: "Invalid estate_id format." } }, { status: 400 });
    }
    // Use two safe .eq() calls instead of string interpolation
    const { data: matchingUnits } = await supabase
      .from("geographical_units")
      .select("id")
      .or(`id.eq.${estateId},parent_id.eq.${estateId}`);
    const ids = (matchingUnits ?? []).map((u: { id: string }) => u.id);
    if (ids.length === 0) {
      return NextResponse.json({ success: true, data: { items: [] } });
    }
    query = query.in("id", ids);
  } else {
    // Top-level units only (no parent)
    query = query.is("parent_id", null);
  }

  if (unitType) query = query.eq("unit_type", unitType);

  const { data: units, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch units." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { items: units } });
}
