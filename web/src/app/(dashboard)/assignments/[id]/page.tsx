"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface AssignmentArea {
  id: string;
  sort_order: number;
  status: string;
  completed_at: string | null;
  geo_unit: {
    id: string;
    name: string;
    code: string;
    latitude: number | null;
    longitude: number | null;
    inspection_status: string;
    approval_status: string;
  } | null;
}

interface Assignment {
  id: string;
  assignment_number: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  target_date: string | null;
  total_areas: number;
  completed_areas: number;
  created_at: string;
  geo_unit: { name: string; unit_type: string } | null;
  assignee: { display_name: string; email: string } | null;
  areas: AssignmentArea[];
}

const areaStatusColors: Record<string, string> = {
  NOT_INSPECTED: "#d1d5db",
  INSPECTION_IN_PROGRESS: "#60a5fa",
  INSPECTED: "#f97316",
  AWAITING_REVIEW: "#fbbf24",
  REINSPECTION_REQUIRED: "#a855f7",
};

function label(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    fetch(`/api/v1/assignments/${id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) {
          setAssignment(json.data);
          // Find current area (first non-completed)
          const idx = json.data.areas.findIndex((a: AssignmentArea) => a.status !== "INSPECTED" && a.status !== "AWAITING_REVIEW");
          setCurrentIdx(idx >= 0 ? idx : 0);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  async function updateAreaStatus(areaId: string, newStatus: string) {
    setUpdating(areaId);
    try {
      await fetch(`/api/v1/assignments/${id}/areas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId, status: newStatus }),
      });
      // Reload
      const res = await fetch(`/api/v1/assignments/${id}`);
      const json = await res.json();
      if (json.success) setAssignment(json.data);
    } catch { /* */ }
    setUpdating(null);
  }

  if (loading) return <div className="py-12 text-center text-sm text-muted-foreground">Loading assignment...</div>;
  if (!assignment) return <div className="py-12 text-center text-sm text-muted-foreground">Assignment not found.</div>;

  const progress = assignment.total_areas > 0 ? Math.round((assignment.completed_areas / assignment.total_areas) * 100) : 0;
  const currentArea = assignment.areas[currentIdx];
  const completedAreas = assignment.areas.filter((a) => a.status === "INSPECTED" || a.status === "AWAITING_REVIEW");
  const pendingAreas = assignment.areas.filter((a) => a.status === "NOT_INSPECTED" || a.status === "INSPECTION_IN_PROGRESS" || a.status === "REINSPECTION_REQUIRED");

  return (
    <div className="space-y-6 max-w-5xl">
      <Link href="/assignments" className="text-sm text-brand hover:underline">← Back to Assignments</Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{assignment.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {assignment.assignment_number} • {assignment.geo_unit?.name} • {assignment.assignee?.display_name ?? "Unassigned"}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={assignment.status === "COMPLETED" ? "success" : assignment.status === "IN_PROGRESS" ? "warning" : "info"}>
            {label(assignment.status)}
          </Badge>
          <Badge variant={assignment.priority === "URGENT" || assignment.priority === "HIGH" ? "danger" : "default"}>
            {label(assignment.priority)}
          </Badge>
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-sm font-bold text-foreground">{assignment.completed_areas}/{assignment.total_areas} ({progress}%)</span>
          </div>
          <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all" style={{ width: `${progress}%` }} />
          </div>
          {assignment.target_date && (
            <p className="text-xs text-muted-foreground mt-2">Target: {new Date(assignment.target_date).toLocaleDateString()}</p>
          )}
        </CardContent>
      </Card>

      <div className="grid lg:grid-cols-[1fr_360px] gap-6">
        {/* Area queue */}
        <div className="space-y-4">
          <h2 className="font-semibold text-foreground">Inspection Queue</h2>
          <div className="space-y-2">
            {assignment.areas.map((area, idx) => {
              const isCurrent = idx === currentIdx;
              const isCompleted = area.status === "INSPECTED" || area.status === "AWAITING_REVIEW";
              return (
                <div
                  key={area.id}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-all ${
                    isCurrent ? "border-brand bg-brand/5 shadow-sm" : "border-border hover:bg-muted/50"
                  }`}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0" style={{ background: isCompleted ? "#10b98120" : isCurrent ? "#2563eb20" : "#f1f5f9", color: isCompleted ? "#10b981" : isCurrent ? "#2563eb" : "#94a3b8" }}>
                    {isCompleted ? "✓" : area.sort_order}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{area.geo_unit?.name ?? "Unknown"}</p>
                    <p className="text-xs text-muted-foreground">{label(area.status)}</p>
                  </div>
                  {isCurrent && (
                    <div className="flex gap-2 shrink-0">
                      {area.status === "NOT_INSPECTED" && (
                        <Button onClick={() => updateAreaStatus(area.id, "INSPECTION_IN_PROGRESS")} disabled={updating === area.id}>
                          Start
                        </Button>
                      )}
                      {area.status === "INSPECTION_IN_PROGRESS" && (
                        <Button onClick={() => updateAreaStatus(area.id, "INSPECTED")} disabled={updating === area.id}>
                          Complete
                        </Button>
                      )}
                      {area.status === "INSPECTED" && (
                        <Button onClick={() => updateAreaStatus(area.id, "AWAITING_REVIEW")} disabled={updating === area.id}>
                          Submit
                        </Button>
                      )}
                      {area.status === "REINSPECTION_REQUIRED" && (
                        <Button onClick={() => updateAreaStatus(area.id, "INSPECTION_IN_PROGRESS")} disabled={updating === area.id}>
                          Reinspect
                        </Button>
                      )}
                    </div>
                  )}
                  {area.geo_unit?.latitude && area.geo_unit?.longitude && (
                    <a
                      href={`https://www.openstreetmap.org/?mlat=${area.geo_unit.latitude}&mlon=${area.geo_unit.longitude}#map=17/${area.geo_unit.latitude}/${area.geo_unit.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-brand shrink-0"
                    >
                      Map
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar — current area detail + stats */}
        <div className="space-y-4">
          {/* Current area card */}
          {currentArea && (
            <Card className="border-brand/20">
              <CardHeader>
                <h3 className="font-semibold text-foreground">Current Area</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-lg font-bold text-foreground">{currentArea.geo_unit?.name}</p>
                  <p className="text-xs text-muted-foreground">Order #{currentArea.sort_order} in queue</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ background: areaStatusColors[currentArea.status] }} />
                  <span className="text-sm font-medium">{label(currentArea.status)}</span>
                </div>
                {currentArea.geo_unit?.latitude && (
                  <p className="text-xs text-muted-foreground">
                    GPS: {currentArea.geo_unit.latitude.toFixed(6)}, {currentArea.geo_unit.longitude?.toFixed(6)}
                  </p>
                )}
                <div className="flex gap-2">
                  {currentArea.status === "NOT_INSPECTED" && (
                    <Button onClick={() => updateAreaStatus(currentArea.id, "INSPECTION_IN_PROGRESS")} disabled={updating === currentArea.id} className="w-full">
                      Start Inspection
                    </Button>
                  )}
                  {currentArea.status === "INSPECTION_IN_PROGRESS" && (
                    <Button onClick={() => updateAreaStatus(currentArea.id, "INSPECTED")} disabled={updating === currentArea.id} className="w-full">
                      Mark Inspected
                    </Button>
                  )}
                  {(currentArea.status === "INSPECTED" || currentArea.status === "AWAITING_REVIEW") && (
                    <Button onClick={() => { if (currentIdx < assignment.areas.length - 1) setCurrentIdx(currentIdx + 1); }} className="w-full">
                      Next Area →
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Stats */}
          <Card>
            <CardHeader><h3 className="font-semibold text-foreground">Summary</h3></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Total areas</span><span className="font-medium">{assignment.total_areas}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Completed</span><span className="font-medium text-success">{completedAreas.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Pending</span><span className="font-medium text-warning">{pendingAreas.length}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Progress</span><span className="font-bold">{progress}%</span></div>
            </CardContent>
          </Card>

          {/* Quick actions */}
          <div className="flex gap-2">
            <Link href={`/map`} className="flex-1">
              <Button variant="secondary" className="w-full">View Map</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
