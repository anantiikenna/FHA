import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import { inspectionSchema } from "@/lib/validation/inspection";

import type { AuthLike } from "@/lib/supabase/types";

export async function POST(req: Request) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
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

  const { data: plot } = await supabase
    .from("plots")
    .select("id, approval:approvals(id, approval_number)")
    .eq("id", d.plotId)
    .single();

  if (!plot) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Plot not found." } }, { status: 404 });
  }

  const inspectionNumber = `FHA/INSP/${new Date().getFullYear()}/${String(Date.now() % 10000).padStart(4, "0")}`;
  const approvals = plot.approval as unknown as { id: string; approval_number: string }[] | null;
  const approvalId = d.approvalId ?? approvals?.[0]?.id ?? null;

  const { data: inspection, error } = await supabase
    .from("inspections")
    .insert({
      plot_id: d.plotId,
      approval_id: approvalId,
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
      status: "DRAFT",
    })
    .select("id, inspection_number, status")
    .single();

  if (error) {
    return NextResponse.json({ success: false, error: { code: "CREATE_FAILED", message: "Failed to create inspection." } }, { status: 500 });
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
    .select("role")
    .eq("id", user.id)
    .single();

  const role = profile?.role;

  const { searchParams } = new URL(req.url);
  const plotId = searchParams.get("plotId");

  let query = supabase
    .from("inspections")
    .select(`
      id, inspection_number, inspection_type, inspection_date,
      status, compliance_status, construction_stage,
      observed_floors, observed_units, observations,
      plot:plots(id, plot_number, street)
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
