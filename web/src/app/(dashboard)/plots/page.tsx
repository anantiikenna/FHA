import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const statusVariant: Record<string, "success" | "warning" | "muted" | "danger"> = {
  APPROVED: "success",
  PENDING: "warning",
  UNDER_CONSTRUCTION: "muted",
  COMPLETED: "success",
  INSPECTION_REQUIRED: "warning",
  REVIEW_REQUIRED: "danger",
};

export default async function PlotsListPage() {
  const supabase = await createClient();

  const { data: plots } = await supabase
    .from("plots")
    .select(`
      id, plot_number, plot_size, plot_size_unit, street, status,
      block:blocks(block_number),
      estate:estates(name)
    `)
    .order("plot_number");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const items = (plots ?? []) as any as {
    id: string;
    plot_number: string;
    plot_size: number;
    plot_size_unit: string;
    street: string;
    status: string;
    block: { block_number: string } | null;
    estate: { name: string } | null;
  }[];

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
                      Block {plot.block?.block_number ?? "—"} — {plot.estate?.name ?? "—"} — {plot.plot_size} {plot.plot_size_unit}
                    </p>
                  </div>
                  <Badge variant={statusVariant[plot.status] ?? "muted"}>{plot.status}</Badge>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
