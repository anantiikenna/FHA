import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";

export interface AuthUser {
  id: string;
  email?: string;
}

export interface AuthContext {
  user: AuthUser;
  profile: { id: string; role: string; is_active: boolean } | null;
  supabase: Awaited<ReturnType<typeof createClient>>;
}

/**
 * Centralized auth + role check for API routes.
 * Returns { error: NextResponse } on failure, or { user, profile, supabase } on success.
 */
export async function requireAuth(options?: {
  roles?: string[];
}): Promise<{ error: NextResponse } | AuthContext> {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();

  if (!user) {
    return {
      error: NextResponse.json(
        { success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } },
        { status: 401 }
      ),
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, is_active")
    .eq("id", user.id)
    .single();

  if (profile && !profile.is_active) {
    return {
      error: NextResponse.json(
        { success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } },
        { status: 403 }
      ),
    };
  }

  if (options?.roles && profile && !options.roles.includes(profile.role)) {
    return {
      error: NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Insufficient permissions." } },
        { status: 403 }
      ),
    };
  }

  return { user, profile, supabase };
}
