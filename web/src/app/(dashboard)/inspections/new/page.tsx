import { ComparisonCard } from "@/components/inspection/ComparisonCard";
import { GpsCapture } from "@/components/inspection/GpsCapture";
import { PhotoUpload } from "@/components/inspection/PhotoUpload";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function NewInspectionPage() {
  // WORKFLOWS.md:11-16, API.md:25-26
  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold">New Site Inspection</h1>
      <Card><CardHeader><h2 className="font-semibold">Property — Plot 003, Block A, FHA Festac Estate</h2></CardHeader><CardContent className="text-sm text-slate-600">Approval FHA/DEV/2024/1056 — 2 floors / 4 units (DEMO)</CardContent></Card>
      <GpsCapture />
      <PhotoUpload inspectionId="demo-inspection-id" />
      <Card>
        <CardHeader><h2 className="font-semibold">Observations</h2></CardHeader>
        <CardContent className="space-y-3 text-sm">
          <label className="block">Construction Stage <select className="mt-1 w-full rounded border border-border px-2 py-1.5"><option>Roof Level</option><option>Foundation</option></select></label>
          <label className="block">Floors Observed <input className="mt-1 w-full rounded border border-border px-2 py-1.5" placeholder="3" /></label>
          <label className="block">Units Observed <input className="mt-1 w-full rounded border border-border px-2 py-1.5" placeholder="6" /></label>
        </CardContent>
      </Card>
      <ComparisonCard approvedFloors={2} approvedUnits={4} observedFloors={3} observedUnits={6} />
      <Card>
        <CardContent className="flex gap-3 pt-4">
          <button className="rounded-lg border border-border bg-white px-4 py-2 text-sm">Save Draft</button>
          <button className="rounded-lg bg-brand px-4 py-2 text-sm text-white">Submit Inspection</button>
        </CardContent>
      </Card>
    </div>
  );
}
