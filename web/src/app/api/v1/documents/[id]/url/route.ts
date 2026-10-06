import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { auditLog } from "@/lib/audit";
import type { AuthLike } from "@/lib/supabase/types";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// GET /api/v1/documents/{id}/url
// Short-lived signed URL for a stored document. Row visibility is enforced
// by the documents RLS policy (active authenticated profiles) via the
// user-scoped client; each access is audited (AGENTS §12/§14).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  if (!UUID_RE.test(id)) {
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
    .select("id, is_active")
    .eq("id", user.id)
    .single();
  if (!profile || profile.is_active === false) {
    return NextResponse.json(
      { success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } },
      { status: 403 }
    );
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id, storage_key, file_name, plot_id")
    .eq("id", id)
    .single();

  if (!doc) {
    return NextResponse.json(
      { success: false, error: { code: "NOT_FOUND", message: "Document not found." } },
      { status: 404 }
    );
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from("property-documents")
    .createSignedUrl(doc.storage_key, 300);

  if (signError || !signedData?.signedUrl) {
    // Typical in demo data: the row exists but no file was uploaded.
    console.error("document sign failed:", signError?.message);
    return NextResponse.json(
      { success: false, error: { code: "SIGN_FAILED", message: "Could not open this document. The file may not be available." } },
      { status: 500 }
    );
  }

  await auditLog({
    action: "VIEW_DOCUMENT",
    entityType: "document",
    entityId: doc.id,
    metadata: { plot_id: doc.plot_id, file_name: doc.file_name },
  });

  return NextResponse.json({ success: true, data: { signedUrl: signedData.signedUrl, fileName: doc.file_name } });
}
