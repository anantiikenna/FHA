import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent } from "@/components/ui/card";

const MapView = dynamic(() => import("@/components/map/MapView"), { ssr: false });

export default async function MapPage() {
  const supabase = await createClient();

  const { data: plots } = await supabase
    .from("plots")
    .select(`
      id, plot_number, status, latitude, longitude,
      block:blocks(block_number),
      estate:estates(name)
    `)
    .order("plot_number");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plotData = ((plots ?? []) as any as {
    id: string;
    plot_number: string;
    status: string;
    latitude: number | null;
    longitude: number | null;
    block: { block_number: string }[] | null;
    estate: { name: string }[] | null;
  }[]).map((p) => ({
    id: p.id,
    plotNumber: p.plot_number,
    status: p.status,
    lat: p.latitude,
    lng: p.longitude,
    block: p.block?.[0]?.block_number ?? "—",
    estate: p.estate?.[0]?.name ?? "—",
  }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Estate GIS Map</h1>
        <span className="text-xs text-slate-500">{plotData.length} plots loaded</span>
      </div>
      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <Card>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">Legend</p>
              <ul className="text-xs space-y-1 text-slate-600">
                <li><span className="inline-block w-3 h-3 bg-emerald-500 mr-2 rounded" /> Approved</li>
                <li><span className="inline-block w-3 h-3 bg-amber-400 mr-2 rounded" /> Pending</li>
                <li><span className="inline-block w-3 h-3 bg-blue-400 mr-2 rounded" /> Under Construction</li>
                <li><span className="inline-block w-3 h-3 bg-slate-300 mr-2 rounded" /> Other</li>
              </ul>
            </div>
            <div className="mt-4 text-xs text-slate-500">
              Click a plot marker to view details.
            </div>
          </CardContent>
        </Card>
        <MapView plots={plotData} />
      </div>
    </div>
  );
}
