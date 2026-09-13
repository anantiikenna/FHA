import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid plot ID." } }, { status: 422 });
  }

  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;

  const { data: plot, error } = await supabase
    .from("plots")
    .select(`
      id, plot_number, plot_reference, plot_size, plot_size_unit,
      street, land_use, latitude, longitude, status, is_demo,
      created_at, updated_at,
      block:blocks(id, block_number),
      estate:estates(id, name, phase, state),
      property_interests(id, name, organization_name, interest_type, allocation_number, allocation_date, is_current),
      approvals(id, approval_number, approval_date, valid_until, status, development_type,
                approved_floors, approved_units, front_setback, side_setback, rear_setback, conditions)
    `)
    .eq("id", id)
    .single();

  if (error || !plot) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Plot not found." } }, { status: 404 });
  }

  await auditLog({ action: "VIEW_PLOT", entityType: "plot", entityId: id });

  return NextResponse.json({ success: true, data: plot });
}
