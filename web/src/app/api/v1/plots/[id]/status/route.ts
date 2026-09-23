import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

import type { AuthLike } from "@/lib/supabase/types";

const VALID_INSPECTION_STATUSES = ["NOT_INSPECTED", "INSPECTION_IN_PROGRESS", "INSPECTED", "AWAITING_REVIEW", "REINSPECTION_REQUIRED"];
const VALID_APPROVAL_STATUSES = ["NOT_REVIEWED", "PENDING", "APPROVED", "APPROVED_WITH_CONDITIONS", "REJECTED"];

// Who can do what
const INSPECTION_STATUS_ROLES = ["ENGINEER", "SUPERVISOR", "ADMIN"];
const APPROVAL_STATUS_ROLES = ["APPROVAL_OFFICER", "SUPERVISOR", "ADMIN"];

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: profile } = await supabase.from("profiles").select("role, is_active").eq("id", user.id).single();
  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Profile not found." } }, { status: 403 });
  }
  if (profile.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
  }

  const { id: plotId } = await params;
  const body = await req.json().catch(() => null);
  const field = body?.field; // "inspection_status" or "approval_status"
  const newValue = body?.value;
  const reason = body?.reason;

  if (!field || !newValue) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "field and value are required." } }, { status: 422 });
  }

  if (field === "inspection_status") {
    if (!VALID_INSPECTION_STATUSES.includes(newValue)) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: `Invalid inspection status.` } }, { status: 422 });
    }
    if (!INSPECTION_STATUS_ROLES.includes(profile.role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Only Engineers, Supervisors, or Admins can change inspection status." } }, { status: 403 });
    }
  } else if (field === "approval_status") {
    if (!VALID_APPROVAL_STATUSES.includes(newValue)) {
      return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: `Invalid approval status.` } }, { status: 422 });
    }
    if (!APPROVAL_STATUS_ROLES.includes(profile.role)) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Only Approval Officers, Supervisors, or Admins can change approval status." } }, { status: 403 });
    }
  } else {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "field must be inspection_status or approval_status." } }, { status: 422 });
  }

  // Engineers may only change inspection status on plots assigned to them
  if (field === "inspection_status" && profile.role === "ENGINEER") {
    const { data: assignedAreas } = await supabase
      .from("assignment_areas")
      .select("assignment:inspection_assignments(assigned_to, status)")
      .eq("geo_unit_id", plotId);

    const hasOwnAssignment = (assignedAreas ?? []).some((a) => {
      const assignment = Array.isArray(a.assignment) ? a.assignment[0] : a.assignment;
      return assignment?.assigned_to === user.id && assignment?.status !== "CANCELLED";
    });

    if (!hasOwnAssignment) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "You can only update status for plots assigned to you." } },
        { status: 403 }
      );
    }
  }

  // Get current value
  const { data: plot } = await supabase.from("plots").select(`${field}`).eq("id", plotId).single();
  if (!plot) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Plot not found." } }, { status: 404 });
  }

  const oldValue = plot[field];

  // Update the plot
  const { data: updatedRows, error: updateError } = await supabase
    .from("plots")
    .update({ [field]: newValue })
    .eq("id", plotId)
    .select("id");

  if (updateError) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update status." } }, { status: 500 });
  }

  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update status." } }, { status: 500 });
  }

  // If approval status changed, sync the approvals table
  if (field === "approval_status") {
    // Map plot enum values that don't exist on approvals.status
    const approvalStatusMap: Record<string, string> = {
      NOT_REVIEWED: "PENDING",
      APPROVED_WITH_CONDITIONS: "APPROVED_WITH_CONDITIONS",
      PENDING: "PENDING",
      APPROVED: "APPROVED",
      REJECTED: "REJECTED",
    };
    const approvalStatus = approvalStatusMap[newValue as string] ?? "PENDING";

    const { data: existingApproval } = await supabase
      .from("approvals")
      .select("id")
      .eq("plot_id", plotId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingApproval) {
      const { error: approvalErr } = await supabase.from("approvals").update({
        status: approvalStatus,
      }).eq("id", existingApproval.id);
      if (approvalErr) {
        return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to sync approval record." } }, { status: 500 });
      }
    } else {
      const approvalNumber = `FHA/APPR/${new Date().getFullYear()}/${String(Date.now() % 10000).padStart(4, "0")}`;
      const { error: approvalErr } = await supabase.from("approvals").insert({
        plot_id: plotId,
        approval_number: approvalNumber,
        status: approvalStatus,
      });
      if (approvalErr) {
        return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to create approval record." } }, { status: 500 });
      }
    }
  }

  // Record history
  await supabase.from("plot_status_history").insert({
    plot_id: plotId,
    changed_by: user.id,
    field,
    old_value: oldValue,
    new_value: newValue,
    reason: reason || null,
  });

  // Audit log
  await auditLog({
    action: "UPDATE_PLOT_STATUS",
    entityType: "plot",
    entityId: plotId,
    metadata: { field, old_value: oldValue, new_value: newValue, reason },
  });

  return NextResponse.json({
    success: true,
    data: { field, old_value: oldValue, new_value: newValue },
  });
}
