import { createClient } from "@/lib/supabase/server";

import type { AuthLike } from "@/lib/supabase/types";

export async function auditLog(params: { action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> }) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  });
}
