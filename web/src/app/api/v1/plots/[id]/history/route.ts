import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthLike = { getUser: () => Promise<{ data: { user: any }; error: any }> };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as AuthLike).getUser();
  if (!user) {
    return NextResponse.json({ success: false, error: { code: "AUTH_REQUIRED", message: "Authentication required." } }, { status: 401 });
  }

  const { id: plotId } = await params;

  const { data: history, error } = await supabase
    .from("plot_status_history")
    .select("id, field, old_value, new_value, reason, created_at, changed_by:profiles(display_name, email)")
    .eq("plot_id", plotId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: { code: "QUERY_ERROR", message: "Failed to fetch history." } }, { status: 500 });
  }

  return NextResponse.json({ success: true, data: { items: history } });
}
