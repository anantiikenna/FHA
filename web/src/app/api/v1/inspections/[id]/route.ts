import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { AuthLike } from "@/lib/supabase/types";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "User profile not found." } }, { status: 403 });
  }
  if (profile.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
  }

  const { data: inspection, error } = await supabase
    .from("inspections")
    .select(`
      id, inspection_number, inspection_type, inspection_date,
      status, compliance_status, construction_stage,
      observed_floors, observed_units, observations, recommendations,
      latitude, longitude, gps_accuracy, inspector_id,
      plot:plots(id, plot_number, street),
      approval:approvals(approved_floors, approved_units)
    `)
    .eq("id", id)
    .single();

  if (error || !inspection) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } }, { status: 404 });
  }

  // Engineers: only their own inspections (GPS/PII scoping)
  const isPrivileged = ["ADMIN", "SUPERVISOR", "APPROVAL_OFFICER"].includes(profile.role);
  if (!isPrivileged && inspection.inspector_id !== user.id) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not your inspection." } }, { status: 403 });
  }

  const safeInspection: Partial<typeof inspection> = { ...inspection };
  delete safeInspection.inspector_id;
  return NextResponse.json({ success: true, data: safeInspection });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  // Fetch profile role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "User profile not found." } }, { status: 403 });
  }
  if (profile.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
  }

  const role = profile.role;

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid request body." } }, { status: 400 });
  }

  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, inspector_id, status, plot_id")
    .eq("id", id)
    .single();

  if (!inspection) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } }, { status: 404 });
  }

  const isOwner = inspection.inspector_id === user.id;

  // Draft field updates — owner may edit DRAFT inspection fields before submit
  const DRAFT_FIELDS: Record<string, (v: unknown) => unknown> = {
    inspectionType: (v) => ["ROUTINE", "FOLLOW_UP", "COMPLIANCE"].includes(v as string) ? v : undefined,
    constructionStage: (v) => typeof v === "string" && v.length <= 100 ? v : undefined,
    observedFloors: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 100 ? v : undefined,
    observedUnits: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 1000 ? v : undefined,
    observations: (v) => typeof v === "string" && v.length <= 5000 ? v : undefined,
    recommendations: (v) => typeof v === "string" && v.length <= 5000 ? v : undefined,
    complianceStatus: (v) => ["COMPLIANT", "MINOR_NON_COMPLIANT", "MAJOR_NON_COMPLIANT", "UNABLE_TO_DETERMINE"].includes(v as string) ? v : undefined,
    latitude: (v) => typeof v === "number" && v >= -90 && v <= 90 ? v : undefined,
    longitude: (v) => typeof v === "number" && v >= -180 && v <= 180 ? v : undefined,
    gpsAccuracy: (v) => typeof v === "number" && v >= 0 ? v : undefined,
  };

  const hasFieldUpdate = Object.keys(DRAFT_FIELDS).some((k) => k in body);
  const wantsStatusChange = "status" in body;

  if (!hasFieldUpdate && !wantsStatusChange) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "No updatable fields provided." } }, { status: 422 });
  }

  if (hasFieldUpdate) {
    if (inspection.status !== "DRAFT" || (!isOwner && role !== "ADMIN")) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Only the owning inspector may edit a draft inspection." } },
        { status: 403 }
      );
    }

    const fieldUpdates: Record<string, unknown> = {};
    const DB_FIELD_MAP: Record<string, string> = {
      inspectionType: "inspection_type",
      constructionStage: "construction_stage",
      observedFloors: "observed_floors",
      observedUnits: "observed_units",
      observations: "observations",
      recommendations: "recommendations",
      complianceStatus: "compliance_status",
      latitude: "latitude",
      longitude: "longitude",
      gpsAccuracy: "gps_accuracy",
    };
    const invalidFields: string[] = [];
    for (const [key, sanitize] of Object.entries(DRAFT_FIELDS)) {
      if (key in body) {
        const value = sanitize(body[key]);
        if (value === undefined) invalidFields.push(key);
        else fieldUpdates[DB_FIELD_MAP[key]] = value;
      }
    }

    if (invalidFields.length > 0) {
      return NextResponse.json(
        { success: false, error: { code: "VALIDATION_ERROR", message: `Invalid value for: ${invalidFields.join(", ")}.` } },
        { status: 422 }
      );
    }

    if (Object.keys(fieldUpdates).length > 0) {
      const { data: fieldRows, error: fieldError } = await supabase
        .from("inspections")
        .update(fieldUpdates)
        .eq("id", id)
        .eq("status", "DRAFT")
        .eq("inspector_id", user.id)
        .select("id");

      if (fieldError || !fieldRows || fieldRows.length === 0) {
        return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update inspection." } }, { status: 500 });
      }
    }

    if (!wantsStatusChange) {
      await auditLog({ action: "UPDATE_INSPECTION_DRAFT", entityType: "inspection", entityId: id, metadata: { fields: Object.keys(body).filter((k) => k in DRAFT_FIELDS) } });
      return NextResponse.json({ success: true, data: { id, status: inspection.status } });
    }
  }

  const status = body.status;

  if (!status || !["SUBMITTED", "UNDER_REVIEW", "COMPLETED"].includes(status)) {
    return NextResponse.json({ success: false, error: { code: "VALIDATION_ERROR", message: "Invalid status." } }, { status: 422 });
  }

  // Transition matrix — skip review only from the correct source state
  const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    DRAFT: ["SUBMITTED"],
    SUBMITTED: ["UNDER_REVIEW"],
    UNDER_REVIEW: ["COMPLETED"],
    // COMPLETED is terminal
  };
  const allowedTargets = ALLOWED_TRANSITIONS[inspection.status] ?? [];
  if (!allowedTargets.includes(status)) {
    return NextResponse.json(
      { success: false, error: { code: "INVALID_TRANSITION", message: `Cannot change status from ${inspection.status} to ${status}.` } },
      { status: 409 }
    );
  }

  // Authorization: role-based status transitions
  const canTransition = (() => {
    if (status === "SUBMITTED" && (isOwner || role === "ADMIN")) return true;
    if (status === "UNDER_REVIEW" && (role === "SUPERVISOR" || role === "ADMIN")) return true;
    if (status === "COMPLETED" && (role === "SUPERVISOR" || role === "ADMIN" || role === "APPROVAL_OFFICER")) return true;
    return false;
  })();

  if (!canTransition) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not authorized to perform this status change." } }, { status: 403 });
  }

  const updates: Record<string, unknown> = { status };
  if (status === "SUBMITTED") updates.submitted_at = new Date().toISOString();

  const { data: updatedRows, error: updateError } = await supabase
    .from("inspections")
    .update(updates)
    .eq("id", id)
    .select("id");

  if (updateError) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update inspection." } }, { status: 500 });
  }

  // RLS can silently filter updates — verify a row was actually changed
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ success: false, error: { code: "UPDATE_FAILED", message: "Failed to update inspection." } }, { status: 403 });
  }

  // Sync plot inspection_status based on inspection status transition
  const plotStatusMap: Record<string, string> = {
    SUBMITTED: "AWAITING_REVIEW",
    UNDER_REVIEW: "INSPECTED",
    COMPLETED: "INSPECTED",
  };
  const mappedPlotStatus = plotStatusMap[status];
  if (mappedPlotStatus && inspection.plot_id) {
    const { data: currentPlot } = await supabase
      .from("plots")
      .select("inspection_status")
      .eq("id", inspection.plot_id)
      .single();

    if (currentPlot && currentPlot.inspection_status !== mappedPlotStatus) {
      await supabase
        .from("plots")
        .update({ inspection_status: mappedPlotStatus })
        .eq("id", inspection.plot_id);

      await supabase.from("plot_status_history").insert({
        plot_id: inspection.plot_id,
        changed_by: user.id,
        field: "inspection_status",
        old_value: currentPlot.inspection_status,
        new_value: mappedPlotStatus,
        reason: `Inspection transitioned to ${status}`,
      });
    }
  }

  await auditLog({ action: "UPDATE_INSPECTION_STATUS", entityType: "inspection", entityId: id, metadata: { new_status: status } });

  return NextResponse.json({ success: true, data: { id, status } });
}

// DELETE /api/v1/inspections/[id] — delete draft inspection (ADMIN/SUPERVISOR only)
export async function DELETE(
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_active === false || !["ADMIN", "SUPERVISOR"].includes(profile.role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, status, plot_id")
    .eq("id", id)
    .single();

  if (!inspection) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } }, { status: 404 });
  }

  if (!["DRAFT", "SUBMITTED"].includes(inspection.status)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Can only delete draft or submitted inspections." } }, { status: 403 });
  }

  const plotId = inspection.plot_id;

  const { data: deletedRows, error } = await supabase
    .from("inspections")
    .delete()
    .eq("id", id)
    .select("id");

  if (error) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete inspection." } }, { status: 500 });
  }

  // RLS can silently filter deletes — verify a row was actually removed
  if (!deletedRows || deletedRows.length === 0) {
    return NextResponse.json({ success: false, error: { code: "DELETE_ERROR", message: "Failed to delete inspection." } }, { status: 500 });
  }

  if (plotId) {
    const { count } = await supabase
      .from("inspections")
      .select("id", { count: "exact", head: true })
      .eq("plot_id", plotId);
    if ((count ?? 0) === 0) {
      const { data: currentPlot } = await supabase
        .from("plots")
        .select("inspection_status")
        .eq("id", plotId)
        .single();

      if (currentPlot && currentPlot.inspection_status !== "NOT_INSPECTED") {
        await supabase
          .from("plots")
          .update({ inspection_status: "NOT_INSPECTED" })
          .eq("id", plotId);

        await supabase.from("plot_status_history").insert({
          plot_id: plotId,
          changed_by: user.id,
          field: "inspection_status",
          old_value: currentPlot.inspection_status,
          new_value: "NOT_INSPECTED",
          reason: "Last inspection deleted",
        });
      }
    }
  }

  await auditLog({ action: "DELETE_INSPECTION", entityType: "inspection", entityId: id, metadata: {} });

  return NextResponse.json({ success: true });
}
