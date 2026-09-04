"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ApprovalData {
  approval_number: string;
  approval_date: string;
  valid_until: string;
  status: string;
  development_type: string;
  approved_floors: number;
  approved_units: number;
  conditions: string;
  plot: { id: string; plot_number: string; street: string; estate: { name: string } } | null;
  verification: { result: string; expired: boolean; checkedAt: string };
}

export default function ApprovalsPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);

    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.trim());
    const url = isUuid
      ? `/api/v1/approvals?plotId=${query.trim()}`
      : `/api/v1/approvals?approvalNumber=${encodeURIComponent(query.trim())}`;

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Failed to verify.");
      } else if (json.data.verification?.result === "NOT_FOUND") {
        setError("No approval record found for this query.");
      } else {
        setResult(json.data);
      }
    } catch {
      setError("Network error — try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 max-w-2xl">
      <h1 className="text-xl font-bold">Approval Verification</h1>
      <Card>
        <CardContent className="pt-4 space-y-3">
          <form onSubmit={handleVerify} className="flex gap-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Approval number (FHA/DEV/2024/1056) or Plot ID"
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={loading || !query.trim()}
              className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {loading ? "Checking..." : "Verify"}
            </button>
          </form>

          {error && searched && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {result && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-sm">
              <p className="font-semibold text-emerald-800">APPROVAL RECORD FOUND</p>
              <p>Plot {result.plot?.plot_number ?? "—"} — {result.plot?.estate?.name ?? "—"}</p>
              <p>{result.development_type} — {result.approved_floors} floors / {result.approved_units} units</p>
              <p>Approval Date {result.approval_date} — Valid until {result.valid_until} — Status {result.status}</p>
              <Badge variant={result.verification.expired ? "danger" : "success"}>
                {result.verification.expired ? "EXPIRED" : "RECORD_FOUND"}
              </Badge>
              <p className="text-xs text-slate-500 mt-1">System verification result — not a legal determination</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
