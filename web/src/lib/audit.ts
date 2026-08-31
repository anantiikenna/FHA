import { createClient } from "@/lib/supabase/server";

// SECURITY.md:35, ARCHITECTURE.md:24 — append-only audit
export async function auditLog(params: { action: string; entityType: string; entityId: string; metadata?: Record<string, unknown> }) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as unknown as { getUser: () => Promise<{ data: { user: { id: string } | null } }> }).getUser();
  if (!user) return;
  await supabase.from("audit_logs").insert({
    user_id: user.id,
    action: params.action,
    entity_type: params.entityType,
    entity_id: params.entityId,
    metadata: params.metadata ?? {},
  });
}
