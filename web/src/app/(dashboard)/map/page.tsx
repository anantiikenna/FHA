import MapView from "@/components/map/MapView";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function MapPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Estate GIS Map</h1>
        <Badge variant="warning">DEMO GEOMETRY</Badge>
      </div>
      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        <Card>
          <CardContent>
            <input placeholder="Search plot / approval / application..." className="w-full rounded-lg border border-border px-3 py-2 text-sm" />
            <div className="mt-4 space-y-2 text-sm">
              <p className="font-semibold">Filters</p>
              <select className="w-full rounded border border-border px-2 py-1.5"><option>All Blocks</option><option>A</option><option>B</option><option>C</option></select>
              <select className="w-full rounded border border-border px-2 py-1.5"><option>All Statuses</option><option>Approved</option><option>Pending</option></select>
              <div className="pt-2">
                <p className="font-semibold">Legend</p>
                <ul className="text-xs space-y-1 text-slate-600">
                  <li><span className="inline-block w-3 h-3 bg-emerald-500 mr-2" /> Approved</li>
                  <li><span className="inline-block w-3 h-3 bg-amber-400 mr-2" /> Pending</li>
                  <li><span className="inline-block w-3 h-3 bg-slate-300 mr-2" /> No record</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
        <MapView />
      </div>
    </div>
  );
}
