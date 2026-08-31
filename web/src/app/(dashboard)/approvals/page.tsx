import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function ApprovalsPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Approval Verification</h1>
      <Card><CardContent className="pt-4 space-y-3">
        <input placeholder="FHA/DEV/2024/1056" className="w-full rounded-lg border border-border px-3 py-2 text-sm" defaultValue="FHA/DEV/2024/1056" />
        <button className="rounded-lg bg-brand px-4 py-2 text-sm text-white">Verify Approval</button>
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
          <p className="font-semibold text-emerald-800">APPROVAL RECORD FOUND</p>
          <p>Plot 003 — FHA Festac Estate — 4 Units Townhouse — 2 floors / 4 units</p>
          <p>Approval Date 2025-01-10 — Valid until 2027-01-09 — Status ACTIVE</p>
          <Badge variant="success">RECORD_FOUND</Badge>
          <p className="text-xs text-slate-500 mt-1">System verification result, not a legal determination (AGENTS.md:7)</p>
        </div>
      </CardContent></Card>
    </div>
  );
}
