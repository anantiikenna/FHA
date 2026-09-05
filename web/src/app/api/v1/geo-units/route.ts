import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthLike = { getUser: () => Promise<{ data: { user: any }; error: any }> };

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
    query = query.eq("parent_id", parentId);
  } else if (estateId) {
    // Get all descendants of an estate
    query = query.or(`id.eq.${estateId},parent_id.eq.${estateId}`);
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
