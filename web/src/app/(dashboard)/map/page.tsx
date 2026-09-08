import MapContainer from "@/components/map/MapContainer";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import MapFilters from "@/components/map/MapFilters";
import MapPageClient from "./MapPageClient";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AuthLike = { getUser: () => Promise<{ data: { user: any }; error: any }> };

export default async function MapPage() {
  const supabase = await createClient();

  // Get user role
  let userRole = "ENGINEER";
  let userId = "";
  try {
    const { data: { user } } = await (supabase.auth as AuthLike).getUser();
    if (user) {
      userId = user.id;
      const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
      userRole = profile?.role ?? "ENGINEER";
    }
  } catch { /* */ }

  // Fetch plots, areas, and assignment areas — wrap in try/catch
  let plotData: { id: string; plotNumber: string; status: string; inspectionStatus: string; approvalStatus: string; assignmentStatus: string | null; lat: number | null; lng: number | null; block: string; estate: string }[] = [];
  let areaData: { id: string; name: string; description: string; area_type: string; status: string; geojson: { type: string; coordinates: number[][][] }; color: string | null; drawn_by: string; assignment_id: string | null; plot_ids: string[]; created_at: string }[] = [];

  try {
    const { data: plots } = await supabase
      .from("plots")
      .select(`
        id, plot_number, status, inspection_status, approval_status, latitude, longitude,
        block:blocks(block_number),
        estate:estates(name)
      `)
      .order("plot_number");

    const { data: mapAreasRaw } = await supabase
      .from("map_areas")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: assignmentAreas } = await supabase
      .from("assignment_areas")
      .select(`
        id, status, assignment_id,
        geo_unit:geographical_units!assignment_areas_geo_unit_id_fkey(id, code)
      `);

    const assignmentMap = new Map<string, string>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (assignmentAreas ?? []).forEach((aa: any) => {
      if (aa.geo_unit?.id && aa.status) {
        assignmentMap.set(aa.geo_unit.id, aa.status);
      }
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    plotData = ((plots ?? []) as any as {
      id: string; plot_number: string; status: string; inspection_status: string;
      approval_status: string; latitude: number | null; longitude: number | null;
      block: { block_number: string }[] | null; estate: { name: string }[] | null;
    }[]).map((p) => ({
      id: p.id,
      plotNumber: p.plot_number,
      status: p.status,
      inspectionStatus: p.inspection_status ?? "NOT_INSPECTED",
      approvalStatus: p.approval_status ?? "NOT_REVIEWED",
      assignmentStatus: assignmentMap.get(p.id) ?? null,
      lat: p.latitude,
      lng: p.longitude,
      block: p.block?.[0]?.block_number ?? "\u2014",
      estate: p.estate?.[0]?.name ?? "\u2014",
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    areaData = ((mapAreasRaw ?? []) as any[]).map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      area_type: a.area_type,
      status: a.status,
      geojson: a.geojson,
      color: a.color,
      drawn_by: a.drawn_by,
      assignment_id: a.assignment_id,
      plot_ids: a.plot_ids ?? [],
      created_at: a.created_at,
    }));
  } catch {
    // Render with empty data on database error
  }

  const blocks = [...new Set(plotData.map((p) => p.block).filter((b) => b !== "—"))].sort();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">FHA Property & Approval Map</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Festac Town Estate — {plotData.length} plots, {areaData.length} areas</p>
        </div>
      </div>
      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        <div className="space-y-4">
          <MapFilters blocks={blocks} areaCount={areaData.length} />
          <Card>
            <CardHeader>
              <h3 className="font-semibold text-sm text-foreground">Plot Legend</h3>
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
                <p className="text-[11px] text-muted-foreground">
                  <strong>Outer ring</strong> = current view mode<br/>
                  <strong>Inner dot</strong> = other status<br/>
                  Click a marker to view details.<br/>
                  Click a drawn area for actions.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
        <MapPageClient
          plotData={plotData}
          areaData={areaData}
          userRole={userRole}
          userId={userId}
        />
      </div>
    </div>
  );
}
