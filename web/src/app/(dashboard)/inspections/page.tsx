import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusVariant: Record<string, "success" | "warning" | "muted" | "danger"> = {
  DRAFT: "muted",
  SUBMITTED: "warning",
  UNDER_REVIEW: "warning",
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

  try {
    const supabase = await createClient();
    const { data: inspections } = await supabase
      .from("inspections")
      .select(`
        id, inspection_number, inspection_type, inspection_date,
        status, compliance_status, construction_stage,
        plot:plots(id, plot_number, street)
      `)
      .order("created_at", { ascending: false });

    items = (inspections ?? []) as unknown as InspectionListItem[];
  } catch {
    // Render with empty list on database error
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Inspections</h1>
        <Link href="/inspections/new" className="rounded-lg bg-brand px-4 py-2 text-sm text-white">New Inspection</Link>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="text-sm text-slate-600">No inspections yet — create one from a plot page.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((insp) => (
            <Card key={insp.id}>
              <CardContent className="flex items-center justify-between gap-4 py-3">
                <div className="text-sm">
                  <p className="font-medium">{insp.inspection_number}</p>
                  <p className="text-slate-500">
                    Plot {insp.plot?.plot_number ?? "—"} — {insp.construction_stage ?? "—"} — {insp.inspection_date}
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
          ))}
        </div>
      )}
    </div>
  );
}
