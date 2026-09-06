"use client";

import { useState } from "react";

type StatusMode = "approval" | "inspection" | "assignment";

export default function MapFilters({ blocks }: { blocks: string[] }) {
  const [statusMode, setStatusMode] = useState<StatusMode>("approval");

  const modes: { value: StatusMode; label: string }[] = [
    { value: "approval", label: "Approval" },
    { value: "inspection", label: "Inspection" },
    { value: "assignment", label: "Assignment" },
  ];

  return (
    <Card>
      <CardHeader>
        <h3 className="font-semibold text-sm text-foreground">Map View</h3>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1.5">Color by</label>
          <div className="flex rounded-lg border border-border overflow-hidden">
            {modes.map((mode) => (
              <button
                key={mode.value}
                onClick={() => {
                  setStatusMode(mode.value);
                  window.dispatchEvent(new CustomEvent("map:statusMode", { detail: mode.value }));
                }}
                className={`flex-1 px-3 py-2 text-xs font-medium transition-colors ${
                  statusMode === mode.value
                    ? "bg-brand text-white"
                    : "bg-surface text-muted-foreground hover:bg-muted"
                }`}
              >
                {mode.label}
              </button>
            ))}
          </div>
        </div>
        {blocks.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Block</label>
            <select className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-brand/40">
              <option value="">All Blocks</option>
              {blocks.map((b) => (
                <option key={b} value={b}>Block {b}</option>
              ))}
            </select>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Inline Card components to avoid circular import
function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface shadow-sm ${className ?? ""}`}>{children}</div>;
}
function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4 border-b border-border">{children}</div>;
}
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className ?? ""}`}>{children}</div>;
}
