"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface GeoUnit {
  id: string;
  parent_id: string | null;
  unit_type: string;
  name: string;
  code: string | null;
  latitude: number | null;
  longitude: number | null;
  inspection_status: string;
}

interface Engineer {
  id: string;
  display_name: string;
  email: string;
}

const UNIT_ICONS: Record<string, string> = {
  DEVELOPMENT: "🏢",
  ESTATE: "🏘️",
  SUB_ESTATE: "🏗️",
  SCHEME: "📋",
  PHASE: "📐",
  SECTION: "📍",
  ZONE: "🗺️",
  BLOCK: "🔲",
  PARCEL: "📦",
  PLOT: "🟩",
};

export default function NewAssignmentPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [units, setUnits] = useState<GeoUnit[]>([]);
  const [children, setChildren] = useState<GeoUnit[]>([]);
  const [breadcrumb, setBreadcrumb] = useState<GeoUnit[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<GeoUnit | null>(null);
  const [selectedPlots, setSelectedPlots] = useState<string[]>([]);
  const [engineers, setEngineers] = useState<Engineer[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [targetDate, setTargetDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Load top-level units
  useEffect(() => {
    fetch("/api/v1/geo-units")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setUnits(json.data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Load engineers
  useEffect(() => {
    fetch("/api/v1/admin/users")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setEngineers(json.data.items.filter((u: Engineer & { role: string }) => u.role === "ENGINEER"));
        }
      })
      .catch(() => {});
  }, []);

  async function loadChildren(parentId: string, parent: GeoUnit) {
    const res = await fetch(`/api/v1/geo-units?parent_id=${parentId}`);
    const json = await res.json();
    if (json.success) {
      setChildren(json.data.items);
      setBreadcrumb([...breadcrumb, parent]);
      setSelectedUnit(parent);
    }
  }

  async function loadPlots(parentId: string) {
    const res = await fetch(`/api/v1/geo-units?type=PLOT`);
    const json = await res.json();
    if (json.success) {
      // Filter plots that are descendants of this unit
      const allPlots = json.data.items as GeoUnit[];
      // For now, show all plots (in production, use recursive query)
      setChildren(allPlots);
      setBreadcrumb([...breadcrumb, { id: parentId, name: "All Plots", unit_type: "PLOTS", parent_id: null, code: null, latitude: null, longitude: null, inspection_status: "" }]);
    }
  }

  function togglePlot(id: string) {
    setSelectedPlots((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function selectAllPlots() {
    setSelectedPlots(children.map((c) => c.id));
  }

  function goBack() {
    if (breadcrumb.length > 0) {
      const newBreadcrumb = breadcrumb.slice(0, -1);
      setBreadcrumb(newBreadcrumb);
      if (newBreadcrumb.length === 0) {
        setSelectedUnit(null);
        setChildren([]);
        // Reload top-level
        fetch("/api/v1/geo-units")
          .then((r) => r.json())
          .then((json) => {
            if (json.success) setUnits(json.data.items);
          });
      } else {
        const parent = newBreadcrumb[newBreadcrumb.length - 1];
        loadChildren(parent.id, parent);
      }
    }
  }

  async function createAssignment() {
    if (!selectedUnit || !title) {
      setError("Title and area are required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const res = await fetch("/api/v1/assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          geoUnitId: selectedUnit.id,
          assignedTo: assignedTo || null,
          priority,
          targetDate: targetDate || null,
          areaIds: selectedPlots.length > 0 ? selectedPlots : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        router.push(`/assignments/${json.data.id}`);
      } else {
        setError(json.error?.message ?? "Failed to create assignment.");
      }
    } catch {
      setError("Network error.");
    }
    setCreating(false);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Create Inspection Assignment</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Select an area and assign it to an engineer for inspection</p>
      </div>

      {/* Progress steps */}
      <div className="flex items-center gap-2 text-sm">
        <div className={`flex items-center gap-1.5 ${step >= 1 ? "text-brand font-semibold" : "text-muted-foreground"}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}>1</span>
          Select Area
        </div>
        <div className="w-8 h-px bg-border" />
        <div className={`flex items-center gap-1.5 ${step >= 2 ? "text-brand font-semibold" : "text-muted-foreground"}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}>2</span>
          Choose Plots
        </div>
        <div className="w-8 h-px bg-border" />
        <div className={`flex items-center gap-1.5 ${step >= 3 ? "text-brand font-semibold" : "text-muted-foreground"}`}>
          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 3 ? "bg-brand text-white" : "bg-muted text-muted-foreground"}`}>3</span>
          Assign & Submit
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-danger-light border border-danger/20 px-4 py-3 text-sm text-danger">{error}</div>
      )}

      {/* Step 1: Select Area */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Select Geographic Area</h2>
              {breadcrumb.length > 0 && (
                <button onClick={goBack} className="text-sm text-brand hover:underline">← Back</button>
              )}
            </div>
            {breadcrumb.length > 0 && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <button onClick={() => { setBreadcrumb([]); setSelectedUnit(null); setChildren([]); fetch("/api/v1/geo-units").then(r=>r.json()).then(j=>{ if(j.success) setUnits(j.data.items); }); }} className="hover:text-brand">Root</button>
                {breadcrumb.map((b, i) => (
                  <span key={b.id}>/ <span className="text-foreground">{b.name}</span></span>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading areas...</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {(breadcrumb.length === 0 ? units : children).map((unit) => (
                  <button
                    key={unit.id}
                    onClick={() => {
                      if (unit.unit_type === "PLOT") {
                        togglePlot(unit.id);
                      } else {
                        loadChildren(unit.id, unit);
                      }
                    }}
                    className={`flex items-center gap-3 rounded-xl border p-4 text-left transition-all hover:shadow-md ${
                      selectedPlots.includes(unit.id)
                        ? "border-brand bg-brand/5 shadow-sm"
                        : "border-border bg-surface hover:border-brand/30"
                    }`}
                  >
                    <span className="text-2xl">{UNIT_ICONS[unit.unit_type] ?? "📍"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{unit.name}</p>
                      <p className="text-xs text-muted-foreground">{unit.unit_type.replace(/_/g, " ")}</p>
                      <div className="flex items-center gap-1 mt-1">
                        <span className={`w-2 h-2 rounded-full ${
                          unit.inspection_status === "APPROVED" ? "bg-success" :
                          unit.inspection_status === "AWAITING_REVIEW" ? "bg-warning" :
                          unit.inspection_status === "INSPECTED" ? "bg-amber-500" :
                          "bg-muted-foreground/30"
                        }`} />
                        <span className="text-[10px] text-muted-foreground">{unit.inspection_status.replace(/_/g, " ").toLowerCase()}</span>
                      </div>
                    </div>
                    {unit.unit_type !== "PLOT" && (
                      <svg className="w-4 h-4 text-muted-foreground shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>
            )}
            {selectedUnit && (
              <div className="mt-4 pt-4 border-t border-border flex justify-end">
                <Button onClick={() => setStep(2)}>
                  Select Plots in {selectedUnit.name} →
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Choose Plots */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-foreground">Choose Plots to Inspect</h2>
              <div className="flex gap-2">
                <button onClick={selectAllPlots} className="text-xs text-brand hover:underline">Select All</button>
                <button onClick={() => setStep(1)} className="text-xs text-muted-foreground hover:underline">← Change Area</button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedUnit?.name} — {selectedPlots.length} plot(s) selected
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
              {children.filter((c) => c.unit_type === "PLOT").map((plot) => (
                <button
                  key={plot.id}
                  onClick={() => togglePlot(plot.id)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all ${
                    selectedPlots.includes(plot.id)
                      ? "border-success bg-success-light"
                      : "border-border hover:border-brand/30"
                  }`}
                >
                  <span className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                    selectedPlots.includes(plot.id) ? "border-success bg-success" : "border-muted-foreground/30"
                  }`}>
                    {selectedPlots.includes(plot.id) && (
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                      </svg>
                    )}
                  </span>
                  <div>
                    <p className="font-medium text-foreground">{plot.name}</p>
                    <p className="text-[10px] text-muted-foreground">{plot.inspection_status.replace(/_/g, " ").toLowerCase()}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-border flex justify-between">
              <Button variant="secondary" onClick={() => setStep(1)}>← Back</Button>
              <Button onClick={() => setStep(3)} disabled={selectedPlots.length === 0}>
                Continue ({selectedPlots.length} plots) →
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Assign & Submit */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold text-foreground">Assignment Details</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl bg-muted px-4 py-3 text-sm">
              <p><span className="text-muted-foreground">Area:</span> <span className="font-medium">{selectedUnit?.name}</span></p>
              <p><span className="text-muted-foreground">Plots:</span> <span className="font-medium">{selectedPlots.length} selected</span></p>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Block A Inspection — Phase 1"
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Assign To</label>
                <select
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                >
                  <option value="">Unassigned</option>
                  {engineers.map((e) => (
                    <option key={e.id} value={e.id}>{e.display_name} ({e.email})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Priority</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                >
                  <option value="LOW">Low</option>
                  <option value="NORMAL">Normal</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5">Target Date</label>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Optional notes about this assignment..."
                className="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </div>

            <div className="flex justify-between pt-2">
              <Button variant="secondary" onClick={() => setStep(2)}>← Back</Button>
              <Button onClick={createAssignment} disabled={creating || !title}>
                {creating ? "Creating..." : "Create Assignment"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
