import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";

export async function GET() {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Not authenticated." } }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, email, display_name, role, is_active")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Profile not found." } }, { status: 404 });
  }

  if (profile.is_active === false) {
    return NextResponse.json(
      { success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true, data: profile });
}
