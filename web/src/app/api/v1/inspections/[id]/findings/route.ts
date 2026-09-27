import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api-auth";
import { auditLog } from "@/lib/audit";
import { z } from "zod";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const VALID_SEVERITIES = ["INFO", "REVIEW_REQUIRED", "HIGH_PRIORITY"] as const;

const FindingSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  category: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  severity: z.enum(VALID_SEVERITIES).optional(),
  recommendation: z.string().max(2000).optional(),
});

// GET /api/v1/inspections/[id]/findings
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: inspectionId } = await params;

  if (!UUID_RE.test(inspectionId)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid inspection ID." } },
      { status: 422 }
    );
  }

  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user, profile, supabase } = auth;

  const isPrivileged = ["ADMIN", "SUPERVISOR", "APPROVAL_OFFICER"].includes(profile?.role ?? "");

  // Engineers: only findings on inspections they own
  if (!isPrivileged) {
    const { data: inspection } = await supabase
      .from("inspections")
      .select("id, inspector_id")
      .eq("id", inspectionId)
      .single();

    if (!inspection || inspection.inspector_id !== user.id) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Not your inspection." } },
        { status: 403 }
      );
    }
  }

  const { data: findings, error } = await supabase
    .from("inspection_findings")
    .select("id, category, title, description, severity, recommendation, status, created_at, updated_at")
    .eq("inspection_id", inspectionId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch findings." } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: findings ?? [] });
}

// POST /api/v1/inspections/[id]/findings
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: inspectionId } = await params;

  if (!UUID_RE.test(inspectionId)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid inspection ID." } },
      { status: 422 }
    );
  }

  const auth = await requireAuth();
  if ("error" in auth) return auth.error;
  const { user, supabase } = auth;

  // Verify inspection exists and user is the inspector (or ADMIN)
  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, inspector_id, status")
    .eq("id", inspectionId)
    .single();

  if (!inspection) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } },
      { status: 404 }
    );
  }

  const isOwner = inspection.inspector_id === user.id;
  const isAdmin = auth.profile?.role === "ADMIN";

  if (!isOwner && !isAdmin) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Not your inspection." } },
      { status: 403 }
    );
  }

  if (inspection.status === "COMPLETED") {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Cannot add findings to a completed inspection." } },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = FindingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Invalid input.",
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 422 }
    );
  }

  const { title, category, description, severity, recommendation } = parsed.data;

  const { data: finding, error: dbError } = await supabase
    .from("inspection_findings")
    .insert({
      inspection_id: inspectionId,
      title,
      category: category ?? null,
      description: description ?? null,
      severity: severity ?? "INFO",
      recommendation: recommendation ?? null,
      status: "OPEN",
    })
    .select("id, category, title, description, severity, recommendation, status, created_at")
    .single();

  if (dbError || !finding) {
    return NextResponse.json(
      { success: false, error: { code: "DB_ERROR", message: "Failed to record finding." } },
      { status: 500 }
    );
  }

  await auditLog({
    action: "ADD_FINDING",
    entityType: "inspection_finding",
    entityId: finding.id,
    metadata: { inspectionId, title, severity: severity ?? "INFO" },
  });

  return NextResponse.json({ success: true, data: finding }, { status: 201 });
}
