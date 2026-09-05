"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface GeoUnit {
  id: string;
  name: string;
  unit_type: string;
  code: string | null;
  parent_id: string | null;
}

interface Engineer {
  id: string;
  display_name: string;
  email: string;
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [targetDate, setTargetDate] = useState("");
  const [assignedTo, setAssignedTo] = useState("");

  const [estates, setEstates] = useState<GeoUnit[]>([]);
  const [selectedEstate, setSelectedEstate] = useState("");
  const [blocks, setBlocks] = useState<GeoUnit[]>([]);
  const [selectedBlocks, setSelectedBlocks] = useState<string[]>([]);
  const [plots, setPlots] = useState<GeoUnit[]>([]);
  const [selectedPlots, setSelectedPlots] = useState<string[]>([]);
  const [selectMode, setSelectMode] = useState<"estate" | "blocks" | "plots">("estate");

  const [engineers, setEngineers] = useState<Engineer[]>([]);

  // Load estates + engineers
  useEffect(() => {
    fetch("/api/v1/geo-units?type=ESTATE").then((r) => r.json()).then((j) => { if (j.success) setEstates(j.data.items); });
    fetch("/api/v1/admin/users").then((r) => r.json()).then((j) => {
      if (j.success) setEngineers(j.data.items.filter((u: Engineer & { role: string }) => u.role === "ENGINEER"));
    });
  }, []);

  // Load blocks when estate selected
  useEffect(() => {
    if (!selectedEstate) { setBlocks([]); setPlots([]); return; }
    fetch(`/api/v1/geo-units?parent_id=${selectedEstate}`).then((r) => r.json()).then((j) => { if (j.success) setBlocks(j.data.items); });
  }, [selectedEstate]);

  // Load plots when blocks selected
  useEffect(() => {
    if (selectedBlocks.length === 0) { setPlots([]); return; }
    const fetchAll = selectedBlocks.map((blockId) =>
      fetch(`/api/v1/geo-units?parent_id=${blockId}`).then((r) => r.json())
    );
    Promise.all(fetchAll).then((results) => {
      const allPlots = results.flatMap((j) => (j.success ? j.data.items : []));
      setPlots(allPlots);
    });
  }, [selectedBlocks]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const geoUnitId = selectMode === "estate" ? selectedEstate : selectedBlocks[0];
    const areaIds = selectMode === "plots" ? selectedPlots : undefined;

    if (!title || !geoUnitId) {
      setError("Title and area selection are required.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/v1/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          geoUnitId,
          assignedTo: assignedTo || undefined,
          priority,
          targetDate: targetDate || undefined,
          areaIds,
        }),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Failed to create assignment.");
        setLoading(false);
        return;
      }
      router.push(`/assignments/${json.data.id}`);
    } catch {
      setError("Network error.");
      setLoading(false);
    }
  }

  const selectedEstateName = estates.find((e) => e.id === selectedEstate)?.name ?? "";
  const selectedBlockNames = blocks.filter((b) => selectedBlocks.includes(b.id)).map((b) => b.name);

  return (
    <div className="space-y-6 max-w-3xl">
      <Link href="/assignments" className="text-sm text-brand hover:underline">← Back to Assignments</Link>
      <h1 className="text-2xl font-bold text-foreground">Create Inspection Assignment</h1>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-danger-light border border-danger/20 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic info */}
        <Card>
          <CardHeader><h2 className="font-semibold text-foreground">Assignment Details</h2></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Block A — Plots 001 to 012"
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional notes"
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>
            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Target Date</label>
                <input type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40" />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Assign To</label>
                <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40">
                  <option value="">Unassigned</option>
                  {engineers.map((eng) => (
                    <option key={eng.id} value={eng.id}>{eng.display_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Area selection */}
        <Card>
          <CardHeader><h2 className="font-semibold text-foreground">Select Inspection Area</h2></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Estate *</label>
              <select
                required
                value={selectedEstate}
                onChange={(e) => { setSelectedEstate(e.target.value); setSelectedBlocks([]); setSelectedPlots([]); setSelectMode("estate"); }}
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="">Select estate...</option>
                {estates.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>

            {selectedEstate && blocks.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Blocks (optional — select to narrow scope)</label>
                <div className="grid grid-cols-3 gap-2">
                  {blocks.map((b) => (
                    <label key={b.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer transition-colors ${selectedBlocks.includes(b.id) ? "border-brand bg-brand/5" : "border-border hover:bg-muted"}`}>
                      <input
                        type="checkbox"
                        checked={selectedBlocks.includes(b.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBlocks([...selectedBlocks, b.id]);
                            setSelectMode("blocks");
                          } else {
                            setSelectedBlocks(selectedBlocks.filter((id) => id !== b.id));
                            if (selectedBlocks.length <= 1) setSelectMode("estate");
                          }
                        }}
                        className="rounded"
                      />
                      {b.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {plots.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-medium text-foreground">Plots (optional — select individual plots)</label>
                  <button type="button" onClick={() => { setSelectedPlots(plots.map((p) => p.id)); setSelectMode("plots"); }} className="text-xs text-brand">Select all</button>
                </div>
                <div className="grid grid-cols-4 gap-2 max-h-48 overflow-y-auto border border-border rounded-xl p-3">
                  {plots.map((p) => (
                    <label key={p.id} className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs cursor-pointer transition-colors ${selectedPlots.includes(p.id) ? "border-brand bg-brand/5" : "border-border hover:bg-muted"}`}>
                      <input
                        type="checkbox"
                        checked={selectedPlots.includes(p.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedPlots([...selectedPlots, p.id]);
                            setSelectMode("plots");
                          } else {
                            setSelectedPlots(selectedPlots.filter((id) => id !== p.id));
                          }
                        }}
                        className="rounded"
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Preview */}
            <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Assignment will include:</p>
              <p className="text-muted-foreground mt-0.5">
                {selectMode === "estate" && `All plots in ${selectedEstateName || "..."}`}
                {selectMode === "blocks" && `${selectedBlockNames.join(", ") || "..."} (${plots.length} plots)`}
                {selectMode === "plots" && `${selectedPlots.length} selected plots`}
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button type="submit" disabled={loading}>
            {loading ? "Creating..." : "Create Assignment"}
          </Button>
          <Link href="/assignments">
            <Button type="button" variant="secondary">Cancel</Button>
          </Link>
        </div>
      </form>
    </div>
  );
}
