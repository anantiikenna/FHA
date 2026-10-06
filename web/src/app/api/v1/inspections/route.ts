import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { inspectionSchema } from "@/lib/validation/inspection";
import { areaStatusForInspection, syncAssignmentAreaFromPlot } from "@/lib/assignment-progress";

import type { AuthLike } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  // Only ENGINEER and SUPERVISOR can create inspections
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_active === false || !["ENGINEER", "SUPERVISOR", "ADMIN"].includes(profile.role)) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = inspectionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: parsed.error.issues[0]?.message } },
      { status: 422 }
    );
  }

  const d = parsed.data;
  const initialStatus = d.status ?? "DRAFT";

  const { data: plot } = await supabase
    .from("plots")
    .select("id, approval:approvals(id, approval_number)")
    .eq("id", d.plotId)
    .single();

  if (!plot) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Plot not found." } }, { status: 404 });
  }

  // Engineers may only create inspections on plots assigned to them
  if (profile.role === "ENGINEER") {
    const { data: areas } = await supabase
      .from("assignment_areas")
      .select("assignment:inspection_assignments(assigned_to, status)")
      .eq("geo_unit_id", d.plotId);
    const ok = (areas ?? []).some((a) => {
      const asg = Array.isArray(a.assignment) ? a.assignment[0] : a.assignment;
      return asg?.assigned_to === user.id && asg?.status !== "CANCELLED";
    });
    if (!ok) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Plot not assigned to you." } },
        { status: 403 }
      );
    }
  }

  let inspectionNumber = "";
  for (let attempt = 0; attempt < 5; attempt++) {
    const randStr = crypto.randomUUID().split("-")[0].toUpperCase().substring(0, 4);
    inspectionNumber = `FHA/INSP/${new Date().getFullYear()}/${randStr}`;
    const { data: existing } = await supabase.from("inspections").select("id").eq("inspection_number", inspectionNumber).maybeSingle();
    if (!existing) break;
  }
  const approvals = plot.approval as unknown as { id: string; approval_number: string }[] | null;
  const plotApprovalId = approvals?.[0]?.id ?? null;

  // If client supplies approvalId, it must belong to this plot
  let approvalId = plotApprovalId;
  if (d.approvalId) {
    const { data: clientApproval } = await supabase
      .from("approvals")
      .select("id, plot_id")
      .eq("id", d.approvalId)
      .single();
    if (!clientApproval || clientApproval.plot_id !== d.plotId) {
      return NextResponse.json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "approvalId does not belong to this plot." },
      }, { status: 422 });
    }
    approvalId = clientApproval.id;
  }

  // Optional map area context (zone / field area the inspection was started from)
  if (d.areaId) {
    const { data: area } = await supabase
      .from("map_areas")
      .select("id")
      .eq("id", d.areaId)
      .maybeSingle();
    if (!area) {
      return NextResponse.json({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "areaId does not match a map area." },
      }, { status: 422 });
    }
  }

  const { data: inspection, error } = await supabase
    .from("inspections")
    .insert({
      plot_id: d.plotId,
      approval_id: approvalId,
      map_area_id: d.areaId ?? null,
      inspection_number: inspectionNumber,
      inspector_id: user.id,
      inspection_type: d.inspectionType,
      inspection_date: new Date().toISOString().split("T")[0],
      construction_stage: d.constructionStage,
      observed_floors: d.observedFloors,
      observed_units: d.observedUnits,
      observations: d.observations,
      recommendations: d.recommendations,
      compliance_status: d.complianceStatus,
      latitude: d.latitude,
      longitude: d.longitude,
      gps_accuracy: d.gpsAccuracy,
      gps_captured_at: d.gpsCapturedAt ?? null,
      status: initialStatus,
      submitted_at: initialStatus === "SUBMITTED" ? new Date().toISOString() : null,
    })
    .select("id, inspection_number, status")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: { code: "CREATE_FAILED", message: "Failed to create inspection." } }, { status: 500 });
  }

  // Update plot inspection_status based on initial status
  const plotStatusMap: Record<string, string> = {
    DRAFT: "INSPECTION_IN_PROGRESS",
    SUBMITTED: "AWAITING_REVIEW",
  };
  const mappedPlotStatus = plotStatusMap[initialStatus];
  if (mappedPlotStatus) {
    const { data: currentPlot } = await supabase
      .from("plots")
      .select("inspection_status")
      .eq("id", d.plotId)
      .single();

    if (currentPlot && currentPlot.inspection_status !== mappedPlotStatus) {
      await supabase
        .from("plots")
        .update({ inspection_status: mappedPlotStatus })
        .eq("id", d.plotId);

      await supabase.from("plot_status_history").insert({
        plot_id: d.plotId,
        changed_by: user.id,
        field: "inspection_status",
        old_value: currentPlot.inspection_status,
        new_value: mappedPlotStatus,
        reason: `New inspection created (${initialStatus})`,
      });
    }
  }

  // Keep assignment progress in step with real inspection work (best-effort)
  const createdAreaStatus = areaStatusForInspection(initialStatus);
  if (createdAreaStatus) {
    await syncAssignmentAreaFromPlot(supabase, {
      plotId: d.plotId,
      areaStatus: createdAreaStatus,
      inspectionId: inspection.id,
    });
  }

  await auditLog({ action: "CREATE_INSPECTION", entityType: "inspection", entityId: inspection.id, metadata: { plotId: d.plotId, inspectionNumber } });

  return NextResponse.json({ success: true, data: inspection }, { status: 201 });
}

export async function GET(req: Request) {
  const supabase = await createClient();
  const getAuth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await getAuth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  // Fetch role for filtering
  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
  }

  const role = profile.role;

  const { searchParams } = new URL(req.url);
  const plotId = searchParams.get("plotId");

  let query = supabase
    .from("inspections")
    .select(`
      id, inspection_number, inspection_type, inspection_date,
      status, compliance_status, construction_stage,
      observed_floors, observed_units, observations,
      plot:plots(id, plot_number, street),
      map_area:map_areas(id, name)
    `)
    .order("created_at", { ascending: false });

  if (plotId) {
    query = query.eq("plot_id", plotId);
  }

  // Engineers only see their own inspections
  if (role === "ENGINEER") {
    query = query.eq("inspector_id", user.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch inspections." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { items: data } });
}
