"use client";

import { useState } from "react";

type StatusMode = "approval" | "inspection" | "assignment";

export default function MapFilters({ blocks, areaCount }: { blocks: string[]; areaCount?: number }) {
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
      <CardContent className="space-y-4">
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

        {/* Drawn Areas Legend */}
        <div className="border-t border-border pt-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">
            DRAWN AREAS {areaCount != null && areaCount > 0 && <span className="text-brand">({areaCount})</span>}
          </p>
          <ul className="text-xs space-y-1.5">
            <LegendItem color="#3b82f6" fill="rgba(59,130,246,0.18)" label="Marked" />
            <LegendItem color="#f59e0b" fill="rgba(245,158,11,0.18)" label="In Progress" />
            <LegendItem color="#10b981" fill="rgba(16,185,129,0.18)" label="Inspected" />
            <LegendItem color="#facc15" fill="rgba(250,204,21,0.18)" label="Awaiting Review" />
            <LegendItem color="#8b5cf6" fill="rgba(139,92,246,0.18)" label="Reinspection" />
            <LegendItem color="#ef4444" fill="rgba(239,68,68,0.18)" label="Rejected" />
          </ul>
        </div>

        <p className="text-[11px] text-muted-foreground/60">
          Use the drawing tools on the map to create inspection areas.
        </p>
      </CardContent>
    </Card>
  );
}

function LegendItem({ color, fill, label }: { color: string; fill: string; label: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className="w-4 h-3 rounded-sm shrink-0 border border-black/10" style={{ background: fill }} />
      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <span>{label}</span>
    </li>
  );
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface shadow-sm ${className ?? ""}`}>{children}</div>;
}
function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="px-5 py-4 border-b border-border">{children}</div>;
}
function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className ?? ""}`}>{children}</div>;
}
