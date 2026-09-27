import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; photoId: string }> }
) {
  const { id: inspectionId, photoId } = await params;

  if (!UUID_RE.test(inspectionId) || !UUID_RE.test(photoId)) {
    return NextResponse.json(
      { success: false, error: { code: "VALIDATION_ERROR", message: "Invalid ID." } },
      { status: 422 }
    );
  }

  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json(
      { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } },
      { status: 401 }
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile || profile.is_active === false) {
    return NextResponse.json(
      { success: false, error: { code: "ACCOUNT_DISABLED", message: "Account disabled." } },
      { status: 403 }
    );
  }

  // Verify inspection access
  const { data: inspection } = await supabase
    .from("inspections")
    .select("id, inspector_id")
    .eq("id", inspectionId)
    .single();

  if (!inspection) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Inspection not found." } },
      { status: 404 }
    );
  }

  const isPrivileged = ["ADMIN", "SUPERVISOR", "APPROVAL_OFFICER"].includes(profile.role);
  if (!isPrivileged && inspection.inspector_id !== user.id) {
    return NextResponse.json(
      { success: false, error: { code: "FORBIDDEN", message: "Not your inspection." } },
      { status: 403 }
    );
  }

  // Fetch the photo record to get its storage_key
  const { data: photo } = await supabase
    .from("inspection_photos")
    .select("id, storage_key, file_name")
    .eq("id", photoId)
    .eq("inspection_id", inspectionId)
    .single();

  if (!photo) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Photo not found." } },
      { status: 404 }
    );
  }

  // Generate a short-lived signed URL (60 seconds — enough to display in browser)
  const { data: signedData, error: signError } = await supabase.storage
    .from("inspection-photos")
    .createSignedUrl(photo.storage_key, 60);

  if (signError || !signedData?.signedUrl) {
    return NextResponse.json(
      { success: false, error: { code: "SIGN_FAILED", message: "Could not generate photo URL." } },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true, data: { signedUrl: signedData.signedUrl, fileName: photo.file_name } });
}
