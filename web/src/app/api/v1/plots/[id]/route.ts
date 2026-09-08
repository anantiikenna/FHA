import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

import type { AuthLike } from "@/lib/supabase/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

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
