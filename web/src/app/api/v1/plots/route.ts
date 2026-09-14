import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { AuthLike } from "@/lib/supabase/types";

export async function GET(req: Request) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const blockId = searchParams.get("blockId");
  const estateId = searchParams.get("estateId");
  const status = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "50", 10)));
  const offset = (page - 1) * limit;

  let query = supabase
    .from("plots")
    .select(`
      id, plot_number, plot_reference, plot_size, plot_size_unit,
      street, land_use, latitude, longitude, status, is_demo,
      inspection_status, approval_status,
      block:blocks(block_number),
      estate:estates(name, phase)
    `, { count: "exact" })
    .order("plot_number", { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    // Use .ilike() for each field to avoid PostgREST string interpolation injection
    const safeSearch = search.replace(/[%_]/g, "").slice(0, 100);
    if (safeSearch) {
      query = query.or(
        `plot_number.ilike.%${safeSearch}%,plot_reference.ilike.%${safeSearch}%,street.ilike.%${safeSearch}%`
      );
    }
  }
  if (blockId) query = query.eq("block_id", blockId);
  if (estateId) query = query.eq("estate_id", estateId);
  if (status) query = query.eq("status", status);

  const { data, error, count } = await query;
  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch plots." } }, { status: 500 });
  }

  await auditLog({ action: "LIST_PLOTS", entityType: "plot", entityId: "bulk", metadata: { search, page, limit } });

  return NextResponse.json({
    success: true,
    data: {
      items: data,
      pagination: { page, limit, total: count ?? 0, totalPages: Math.ceil((count ?? 0) / limit) },
    },
  });
}
