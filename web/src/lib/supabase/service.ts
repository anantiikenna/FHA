import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only code paths that must run without a
 * user session (public read-only projections, signed-URL minting).
 * NEVER import this from client components — the key must stay server-side.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase service configuration missing.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
