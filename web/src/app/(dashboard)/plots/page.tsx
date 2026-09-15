import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusVariant: Record<string, "success" | "warning" | "muted" | "danger" | "info"> = {
  APPROVED: "success",
  PENDING: "warning",
  UNDER_CONSTRUCTION: "muted",
  COMPLETED: "success",
  INSPECTION_REQUIRED: "warning",
  REVIEW_REQUIRED: "danger",
  NOT_INSPECTED: "muted",
  INSPECTION_IN_PROGRESS: "info",
  INSPECTED: "warning",
  AWAITING_REVIEW: "warning",
  REINSPECTION_REQUIRED: "danger",
  NOT_REVIEWED: "muted",
  APPROVED_WITH_CONDITIONS: "success",
  REJECTED: "danger",
};

export default async function PlotsListPage() {
  interface PlotListItem {
    id: string;
    plot_number: string;
    plot_size: number;
    plot_size_unit: string;
    street: string | null;
    status: string;
    inspection_status: string;
    approval_status: string;
    block: { block_number: string }[] | null;
    estate: { name: string }[] | null;
  }

  let items: PlotListItem[] = [];

  try {
    const supabase = await createClient();
    const { data: plots } = await supabase
      .from("plots")
      .select(`
        id, plot_number, plot_size, plot_size_unit, street, status,
        inspection_status, approval_status,
        block:blocks(block_number),
        estate:estates(name)
      `)
      .order("plot_number");

    items = (plots ?? []) as unknown as PlotListItem[];
  } catch {
    // Render with empty list on database error
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Properties</h1>
        <span className="text-sm text-slate-500">{items.length} plots</span>
      </div>

      {items.length === 0 ? (
        <Card><CardContent className="text-sm text-slate-600">No plots found.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((plot) => (
            <Link key={plot.id} href={`/plots/${plot.id}`}>
              <Card className="hover:border-brand transition-colors cursor-pointer">
                <CardContent className="flex items-center justify-between py-3">
                  <div className="text-sm">
                    <p className="font-medium">Plot {plot.plot_number}</p>
                    <p className="text-slate-500">
                      Block {Array.isArray(plot.block) ? plot.block[0]?.block_number ?? "—" : "—"} — {Array.isArray(plot.estate) ? plot.estate[0]?.name ?? "—" : "—"} — {plot.plot_size} {plot.plot_size_unit}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={statusVariant[plot.inspection_status] ?? "muted"}>
                      {plot.inspection_status?.replace(/_/g, " ")}
                    </Badge>
                    <Badge variant={statusVariant[plot.approval_status] ?? "muted"}>
                      {plot.approval_status?.replace(/_/g, " ")}
                    </Badge>
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
