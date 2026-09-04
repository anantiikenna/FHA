import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthLike = { getUser: () => Promise<{ data: { user: any }; error: any }> };

export async function GET(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as AuthLike).getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const plotId = searchParams.get("plotId");
  const approvalId = searchParams.get("approvalId");
  const inspectionId = searchParams.get("inspectionId");

  let query = supabase
    .from("documents")
    .select(`
      id, file_name, document_type, mime_type, file_size, created_at,
      plot:plots(id, plot_number)
    `)
    .order("created_at", { ascending: false });

  if (plotId) query = query.eq("plot_id", plotId);
  if (approvalId) query = query.eq("approval_id", approvalId);
  if (inspectionId) query = query.eq("inspection_id", inspectionId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch documents." } }, { status: 500 });
  }

  await auditLog({ action: "LIST_DOCUMENTS", entityType: "document", entityId: "bulk", metadata: { plotId, approvalId, inspectionId } });

  return NextResponse.json({ success: true, data: { items: data } });
}
