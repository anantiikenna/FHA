import { compareInspection } from "@/lib/comparison";
import { Badge } from "@/components/ui/badge";

export function ComparisonCard({ approvedFloors, approvedUnits, observedFloors, observedUnits }: { approvedFloors: number | null; approvedUnits: number | null; observedFloors: number | null; observedUnits: number | null }) {
  const result = compareInspection({ floors: approvedFloors, units: approvedUnits }, { floors: observedFloors, units: observedUnits });
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h3 className="font-semibold mb-3">Approved vs Observed</h3>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="font-medium">Item</div><div className="font-medium">Approved</div><div className="font-medium">Observed</div>
        <div>Floors</div><div>{approvedFloors ?? "—"}</div><div>{observedFloors ?? "—"}</div>
        <div>Units</div><div>{approvedUnits ?? "—"}</div><div>{observedUnits ?? "—"}</div>
      </div>
      <div className="mt-3">
        {result.hasDiscrepancy ? (
          <Badge variant="warning">POTENTIAL DISCREPANCY — Flag for FHA review</Badge>
        ) : result.needsReview ? (
          <Badge variant="info">REVIEW REQUIRED — Missing approved or observed data</Badge>
        ) : (
          <Badge variant="success">No difference detected</Badge>
        )}
      </div>
      <p className="text-xs text-slate-500 mt-2">System flag only — not a legal determination (AGENTS.md:8)</p>
    </div>
  );
}
