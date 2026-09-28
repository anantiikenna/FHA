import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

import type { AuthLike } from "@/lib/supabase/types";

// profiles RLS only exposes own profile / admin directory, so author names for
// areas drawn by other engineers are resolved with the service role (read-only,
// id-scoped) and fall back to the user-scoped client when it is unavailable.
async function fetchAuthorNames(ids: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  if (ids.length === 0) return names;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && serviceKey) {
    try {
      const res = await fetch(`${url}/rest/v1/profiles?id=in.("${ids.join('","')}")&select=id,display_name`, {
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      });
      if (res.ok) {
        const rows = (await res.json()) as Array<{ id: string; display_name: string }>;
        for (const row of rows) names.set(row.id, row.display_name);
        return names;
      }
    } catch {
      // fall through to user-scoped client
    }
  }

  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("id, display_name").in("id", ids);
  for (const row of data ?? []) names.set(row.id, row.display_name);
  return names;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const auth = supabase.auth as unknown as AuthLike;
  const { data: { user } } = await auth.getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { data: activeProfile } = await supabase
    .from("profiles")
    .select("id, is_active")
    .eq("id", user.id)
    .single();
  if (!activeProfile || activeProfile.is_active === false) {
    return NextResponse.json({ success: false, error: { code: "ACCOUNT_DISABLED", message: "Account is deactivated." } }, { status: 403 });
  }

  const { id } = await params;

  const { data: parent } = await supabase
    .from("map_areas")
    .select("id, area_type")
    .eq("id", id)
    .maybeSingle();
  if (!parent) {
    return NextResponse.json({ success: false, error: { code: "NOT_FOUND", message: "Map area not found." } }, { status: 404 });
  }

  const { data: children, error } = await supabase
    .from("map_areas")
    .select("id, name, status, area_type, drawn_by, created_at, updated_at")
    .eq("parent_area_id", id)
    .order("created_at", { ascending: true });
  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch sub-areas." } }, { status: 500 });
  }

  const authorIds = [...new Set((children ?? []).map((c) => c.drawn_by).filter((v): v is string => typeof v === "string"))];
  const authors = await fetchAuthorNames(authorIds);

  const items = (children ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    area_type: c.area_type,
    drawn_by: c.drawn_by,
    author_name: typeof c.drawn_by === "string" ? authors.get(c.drawn_by) ?? null : null,
    created_at: c.created_at,
    updated_at: c.updated_at,
  }));

  return NextResponse.json({ success: true, data: items });
}
