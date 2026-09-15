import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { AuthLike } from "@/lib/supabase/types";
import { redirect } from "next/navigation";

const statusVariant: Record<string, "success" | "warning" | "muted" | "danger" | "info"> = {
  DRAFT: "muted",
  SUBMITTED: "warning",
  UNDER_REVIEW: "info",
  COMPLETED: "success",
};

export default async function InspectionsPage() {
  interface InspectionListItem {
    id: string;
    inspection_number: string;
    inspection_type: string;
    inspection_date: string;
    status: string;
    compliance_status: string | null;
    construction_stage: string | null;
    plot: { id: string; plot_number: string; street: string } | null;
  }

  let items: InspectionListItem[] = [];
  let userRole = "ENGINEER";

  try {
    const supabase = await createClient();
    const auth = supabase.auth as unknown as AuthLike;
    const { data: { user } } = await auth.getUser();
    if (!user) redirect("/login");

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    userRole = profile?.role ?? "ENGINEER";

    let query = supabase
      .from("inspections")
      .select(`
        id, inspection_number, inspection_type, inspection_date,
        status, compliance_status, construction_stage,
        plot:plots(id, plot_number, street)
      `)
      .order("created_at", { ascending: false });

    // Engineers only see their own inspections
    if (userRole === "ENGINEER") {
      query = query.eq("inspector_id", user.id);
    }

    const { data: inspections } = await query;
    items = (inspections ?? []) as unknown as InspectionListItem[];
  } catch {
    // Render with empty list on database error
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Inspections</h1>
        {["ENGINEER", "SUPERVISOR", "ADMIN"].includes(userRole) && (
          <Link href="/inspections/new" className="rounded-lg bg-brand px-4 py-2 text-sm text-white">New Inspection</Link>
        )}
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="text-sm text-slate-600">No inspections yet — create one from a plot page.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((insp) => (
            <Link key={insp.id} href={`/inspections/${insp.id}`}>
              <Card className="hover:border-brand transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between gap-4 py-3">
                  <div className="text-sm">
                    <p className="font-medium">{insp.inspection_number}</p>
                    <p className="text-slate-500">
                      Plot {insp.plot?.plot_number ?? "\u2014"} \u2014 {insp.construction_stage ?? "\u2014"} \u2014 {insp.inspection_date}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {insp.compliance_status && (
                      <Badge variant={insp.compliance_status === "COMPLIANT" ? "success" : "warning"}>
                        {insp.compliance_status}
                      </Badge>
                    )}
                    <Badge variant={statusVariant[insp.status] ?? "muted"}>{insp.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
