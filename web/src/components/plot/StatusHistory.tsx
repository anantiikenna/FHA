"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface HistoryEntry {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string;
  reason: string | null;
  created_at: string;
  changed_by: { display_name: string; email: string } | null;
}

function label(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

const statusColors: Record<string, string> = {
  APPROVED: "#10b981",
  APPROVED_WITH_CONDITIONS: "#34d399",
  PENDING: "#facc15",
  REJECTED: "#ef4444",
  NOT_REVIEWED: "#94a3b8",
  INSPECTED: "#f97316",
  AWAITING_REVIEW: "#fbbf24",
  INSPECTION_IN_PROGRESS: "#60a5fa",
  REINSPECTION_REQUIRED: "#a855f7",
  NOT_INSPECTED: "#d1d5db",
};

export default function StatusHistory({ plotId }: { plotId: string }) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/v1/plots/${plotId}/history`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setHistory(json.data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [plotId]);

  if (loading) return null;
  if (history.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-foreground">Status History</h3>
      </CardHeader>
      <CardContent>
        <div className="space-y-0">
          {history.map((entry, i) => (
            <div key={entry.id} className="flex gap-3 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className="w-3 h-3 rounded-full shrink-0 mt-1"
                  style={{ background: statusColors[entry.new_value] ?? "#94a3b8" }}
                />
                {i < history.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-muted-foreground">
                    {label(entry.field)}
                  </span>
                  {entry.old_value && (
                    <>
                      <span className="text-xs text-muted-foreground/60">→</span>
                      <span className="text-xs line-through text-muted-foreground/60">{label(entry.old_value)}</span>
                      <span className="text-xs text-muted-foreground">→</span>
                    </>
                  )}
                  <span className="text-xs font-semibold" style={{ color: statusColors[entry.new_value] ?? "#94a3b8" }}>
                    {label(entry.new_value)}
                  </span>
                </div>
                {entry.reason && (
                  <p className="text-xs text-muted-foreground mt-0.5 italic">"{entry.reason}"</p>
                )}
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                  {entry.changed_by?.display_name ?? "Unknown"} • {new Date(entry.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
