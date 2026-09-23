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

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, is_active")
    .eq("id", user.id)
    .single();
  if (!profile || profile.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const approvalNumber = searchParams.get("approvalNumber");
  const plotId = searchParams.get("plotId");

  if (!approvalNumber && !plotId) {
    return NextResponse.json(
      { success: false, error: { code: "MISSING_PARAM", message: "Provide approvalNumber or plotId." } },
      { status: 400 }
    );
  }

  let query = supabase
    .from("approvals")
    .select(`
      id, approval_number, approval_date, valid_until, status,
      development_type, approved_floors, approved_units,
      front_setback, side_setback, rear_setback, conditions,
      plot:plots(id, plot_number, street, estate:estates(name))
    `);

  if (approvalNumber) {
    query = query.eq("approval_number", approvalNumber);
  } else if (plotId) {
    query = query.eq("plot_id", plotId).eq("status", "APPROVED");
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to verify approval." } }, { status: 500 });
  }

  if (!data) {
    await auditLog({ action: "VERIFY_APPROVAL", entityType: "approval", entityId: approvalNumber ?? plotId ?? "unknown", metadata: { result: "NOT_FOUND" } });
    return NextResponse.json({
      success: true,
      data: { verification: { result: "NOT_FOUND", checkedAt: new Date().toISOString() } },
    });
  }

  const now = new Date();
  const validUntil = data.valid_until ? new Date(data.valid_until) : null;
  const isExpired = validUntil ? validUntil < now : false;

  await auditLog({
    action: "VERIFY_APPROVAL",
    entityType: "approval",
    entityId: data.id,
    metadata: { approvalNumber: data.approval_number, status: data.status, expired: isExpired },
  });

  return NextResponse.json({
    success: true,
    data: {
      ...data,
      verification: {
        result: "RECORD_FOUND",
        expired: isExpired,
        checkedAt: now.toISOString(),
      },
    },
  });
}
