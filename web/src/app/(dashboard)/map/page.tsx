import MapContainer from "@/components/map/MapContainer";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import MapFilters from "@/components/map/MapFilters";

export default async function MapPage() {
  const supabase = await createClient();

  const { data: plots } = await supabase
    .from("plots")
    .select(`
      id, plot_number, status, inspection_status, approval_status, latitude, longitude,
      block:blocks(block_number),
      estate:estates(name)
    `)
    .order("plot_number");

  // Fetch assignment areas to show assignment status on map
  const { data: assignmentAreas } = await supabase
    .from("assignment_areas")
    .select(`
      id, status, assignment_id,
      geo_unit:geographical_units!assignment_areas_geo_unit_id_fkey(id, code)
    `);

  // Build a map of geo_unit_id -> assignment area status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const assignmentMap = new Map<string, string>();
  (assignmentAreas ?? []).forEach((aa: any) => {
    if (aa.geo_unit?.id && aa.status) {
      assignmentMap.set(aa.geo_unit.id, aa.status);
    }
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const plotData = ((plots ?? []) as any as {
    id: string;
    plot_number: string;
    status: string;
    inspection_status: string;
    approval_status: string;
    latitude: number | null;
    longitude: number | null;
    block: { block_number: string }[] | null;
    estate: { name: string }[] | null;
  }[]).map((p) => ({
    id: p.id,
    plotNumber: p.plot_number,
    status: p.status,
    inspectionStatus: p.inspection_status ?? "NOT_INSPECTED",
    approvalStatus: p.approval_status ?? "NOT_REVIEWED",
    assignmentStatus: assignmentMap.get(p.id) ?? null,
    lat: p.latitude,
    lng: p.longitude,
    block: p.block?.[0]?.block_number ?? "—",
    estate: p.estate?.[0]?.name ?? "—",
  }));

  // Get unique blocks for filter
  const blocks = [...new Set(plotData.map((p) => p.block).filter((b) => b !== "—"))].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">FHA Property & Approval Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Festac Town Estate — {plotData.length} plots</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="space-y-4">
          <MapFilters blocks={blocks} />
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-sm text-foreground">Legend</h3>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">APPROVAL STATUS</p>
                <ul className="text-xs space-y-1.5">
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-success shrink-0" /> Approved</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-success-light shrink-0 border border-success/30" /> Approved with Conditions</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-warning shrink-0" /> Pending</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-danger shrink-0" /> Rejected</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-muted-foreground/40 shrink-0" /> Not Reviewed</li>
                </ul>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">INSPECTION STATUS</p>
                <ul className="text-xs space-y-1.5">
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{background:"#60a5fa"}} /> In Progress</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{background:"#f97316"}} /> Inspected</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{background:"#fbbf24"}} /> Awaiting Review</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{background:"#a855f7"}} /> Reinspection Required</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-muted/60 shrink-0" /> Not Inspected</li>
                </ul>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">ASSIGNMENT STATUS</p>
                <ul className="text-xs space-y-1.5">
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{background:"#3b82f6"}} /> In Progress</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{background:"#10b981"}} /> Inspected / Completed</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{background:"#f59e0b"}} /> Awaiting Review</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full shrink-0" style={{background:"#8b5cf6"}} /> Reinspection Required</li>
                  <li className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-muted/40 shrink-0" /> Not Assigned</li>
                </ul>
              </div>
              <div className="border-t border-border pt-3">
                <p className="text-[11px] text-muted-foreground">
                  <strong>Outer ring</strong> = current view mode<br/>
                  <strong>Inner dot</strong> = other status<br/>
                  Click a marker to view details.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <MapContainer plots={plotData} />
      </div>
    </div>
  );
}
