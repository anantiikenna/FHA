import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";

import type { AuthLike } from "@/lib/supabase/types";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: inspectionId } = await params;
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "User profile not found." } }, { status: 403 });
  }

  const isPrivileged = ["ADMIN", "SUPERVISOR", "APPROVAL_OFFICER"].includes(profile.role);

  // Engineers: only photos for inspections they own
  const query = supabase
    .from("inspection_photos")
    .select("id, file_name, storage_key, mime_type, file_size, created_at")
    .eq("inspection_id", inspectionId)
    .order("created_at", { ascending: false });

  if (!isPrivileged) {
    const { data: inspection } = await supabase
      .from("inspections")
      .select("id, inspector_id")
      .eq("id", inspectionId)
      .single();

    if (!inspection || inspection.inspector_id !== user.id) {
      return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not your inspection." } }, { status: 403 });
    }
  }

  const { data: photos, error } = await query;

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch photos." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: photos ?? [] });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: inspectionId } = await params;
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  // Verify inspection exists and user is the inspector
  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, inspector_id, status")
    .eq("id", inspectionId)
    .single();

  if (!inspection) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } }, { status: 404 });
  }

  if (inspection.inspector_id !== user.id) {
    return NextResponse.json({ success: false, error: { code: "FORBIDDEN", message: "Not your inspection." } }, { status: 403 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ success: false, error: { code: "MISSING_FILE", message: "No file provided." } }, { status: 400 });
  }

  // Validate type
  const allowedTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json({ success: false, error: { code: "INVALID_TYPE", message: "Only JPG/PNG allowed." } }, { status: 422 });
  }

  // Validate size (10MB)
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ success: false, error: { code: "FILE_TOO_LARGE", message: "Max 10MB." } }, { status: 422 });
  }

  const ext = file.type === "image/png" ? "png" : "jpg";
  const storageKey = `inspections/${inspectionId}/${Date.now()}.${ext}`;

  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from("inspection-photos")
    .upload(storageKey, file, { contentType: file.type });

  if (uploadError) {
    return NextResponse.json({ success: false, error: { code: "UPLOAD_FAILED", message: "Storage upload failed." } }, { status: 500 });
  }

  // Create database record
  const { data: photo, error: dbError } = await supabase
    .from("inspection_photos")
    .insert({
      inspection_id: inspectionId,
      storage_key: storageKey,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      uploaded_by: user.id,
      captured_at: new Date().toISOString(),
    })
    .select("id, file_name, storage_key, created_at")
    .single();

  if (dbError) {
    return NextResponse.json({ success: false, error: { code: "DB_ERROR", message: "Failed to save photo record." } }, { status: 500 });
  }

  await auditLog({ action: "UPLOAD_PHOTO", entityType: "inspection_photo", entityId: photo.id, metadata: { inspectionId, fileName: file.name } });

  return NextResponse.json({ success: true, data: photo }, { status: 201 });
}
