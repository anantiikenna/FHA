import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SafeImg } from "@/components/ui/safe-img";

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

interface PlotListItem {
  id: string;
  plot_number: string;
  plot_size: number;
  plot_size_unit: string;
  street: string | null;
  status: string;
  inspection_status: string;
  approval_status: string;
  // PostgREST may embed a to-one relation as an object or a one-row array.
  block: { block_number: string }[] | { block_number: string } | null;
  estate: { name: string }[] | { name: string } | null;
  property_interests: { name: string; allocation_number: string | null; is_current: boolean }[] | null;
}

function firstOf<T>(value: T[] | T | null | undefined): T | null {
  return Array.isArray(value) ? value[0] ?? null : value ?? null;
}

// Latest evidence photo per plot ("building photo") from any map area that
// covers the plot — signed for a few minutes so the record rows can render
// them directly.
async function loadPlotPhotos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  plotIds: string[]
): Promise<Map<string, string>> {
  const byPlot = new Map<string, string>();
  if (plotIds.length === 0) return byPlot;
  try {
    const { data: areas } = await supabase
      .from("map_areas")
      .select("id, plot_ids")
      .overlaps("plot_ids", plotIds)
      .order("created_at", { ascending: false })
      .limit(200);
    if (!areas || areas.length === 0) return byPlot;

    const plotSet = new Set(plotIds);
    const areaToPlots = new Map<string, string[]>();
    for (const a of areas as { id: string; plot_ids: string[] | null }[]) {
      areaToPlots.set(a.id, (a.plot_ids ?? []).filter((p) => plotSet.has(p)));
    }

    const { data: photos } = await supabase
      .from("map_area_photos")
      .select("area_id, storage_key, created_at")
      .in("area_id", [...areaToPlots.keys()])
      .order("created_at", { ascending: false })
      .limit(500);

    const seen = new Set<string>();
    for (const row of photos ?? []) {
      const targets = (areaToPlots.get(row.area_id) ?? []).filter((p) => !seen.has(p));
      if (targets.length === 0) continue;
      const { data } = await supabase.storage
        .from("area-photos")
        .createSignedUrl(row.storage_key, 300);
      if (!data?.signedUrl) continue;
      for (const plotId of targets) {
        if (seen.size >= 100) break;
        seen.add(plotId);
        byPlot.set(plotId, data.signedUrl);
      }
      if (seen.size >= 100) break;
    }
  } catch {
    // thumbnails are optional — the record row still renders
  }
  return byPlot;
}

export default async function PlotsListPage() {
  let items: PlotListItem[] = [];
  let photoByPlot = new Map<string, string>();

  try {
    const supabase = await createClient();
    const { data: plots } = await supabase
      .from("plots")
      .select(`
        id, plot_number, plot_size, plot_size_unit, street, status,
        inspection_status, approval_status,
        block:blocks(block_number),
        estate:estates(name),
        property_interests(name, allocation_number, is_current)
      `)
      .order("plot_number");

    items = (plots ?? []) as unknown as PlotListItem[];
    photoByPlot = await loadPlotPhotos(supabase, items.slice(0, 100).map((p) => p.id));
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
          {items.map((plot) => {
            const owner = (plot.property_interests ?? []).find((i) => i.is_current !== false && i.name);
            const photoUrl = photoByPlot.get(plot.id);
            const blockNum = firstOf(plot.block)?.block_number ?? "—";
            const estateName = firstOf(plot.estate)?.name ?? "—";
            return (
              <Link key={plot.id} href={`/plots/${plot.id}`}>
                <Card className="hover:border-brand transition-colors cursor-pointer">
                  <CardContent className="flex items-center gap-4 py-3">
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                      <SafeImg
                        src={photoUrl}
                        alt={`Photo of plot ${plot.plot_number}`}
                        className="w-full h-full object-cover"
                      />
                      {!photoUrl && (
                        <svg className="w-6 h-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm0 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                        </svg>
                      )}
                    </div>
                    <div className="text-sm flex-1 min-w-0">
                      <p className="font-medium">Plot {plot.plot_number}</p>
                      <p className="text-slate-500 truncate">
                        Block {blockNum} — {estateName} — {plot.plot_size} {plot.plot_size_unit}
                      </p>
                      <p className="text-slate-500 truncate">
                        {owner ? `Owner: ${owner.name}${owner.allocation_number ? ` (${owner.allocation_number})` : ""}` : "Owner: —"}
                        {plot.street ? ` • ${plot.street}` : ""}
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
            );
          })}
        </div>
      )}
    </div>
  );
}
