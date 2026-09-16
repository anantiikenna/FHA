"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

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
  geo_unit: { id: string; name: string; unit_type: string } | null;
  assignee: { id: string; display_name: string; email: string } | null;
  areas: Area[];
}

interface Area {
  id: string;
  sort_order: number;
  status: string;
  completed_at: string | null;
  geo_unit: {
    id: string;
    name: string;
    code: string;
    latitude: number;
    longitude: number;
    inspection_status: string;
    approval_status: string;
  };
}

const statusColor: Record<string, string> = {
  NOT_INSPECTED: "bg-muted-foreground/20",
  INSPECTION_IN_PROGRESS: "bg-blue-400",
  INSPECTED: "bg-amber-400",
  AWAITING_REVIEW: "bg-warning",
  REINSPECTION_REQUIRED: "bg-purple-400",
};

const statusLabel: Record<string, string> = {
  NOT_INSPECTED: "Not Inspected",
  INSPECTION_IN_PROGRESS: "In Progress",
  INSPECTED: "Inspected",
  AWAITING_REVIEW: "Awaiting Review",
  REINSPECTION_REQUIRED: "Reinspection Required",
};

export default function AssignmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string>("");
  const router = useRouter();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    params.then((p) => {
      setId(p.id);
      fetch(`/api/v1/assignments/${p.id}`)
        .then((r) => r.json())
        .then((json) => {
          if (json.success) setAssignment(json.data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, [params]);

  async function updateAreaStatus(areaId: string, status: string) {
    setUpdating(areaId);
    try {
      await fetch(`/api/v1/assignments/${id}/areas`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ areaId, status }),
      });
      // Reload
      const res = await fetch(`/api/v1/assignments/${id}`);
      const json = await res.json();
      if (json.success) setAssignment(json.data);
    } catch { /* */ }
    setUpdating(null);
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/assignments/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        router.push("/assignments");
      } else {
        alert(json.error?.message ?? "Failed to delete.");
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch {
      alert("Network error.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  function navigateToPlot(lat: number, lng: number) {
    // Dispatch event for map to navigate
    window.dispatchEvent(new CustomEvent("map:navigate", { detail: { lat, lng, zoom: 17 } }));
  }

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-8 w-48 bg-muted rounded" /><div className="h-64 bg-muted rounded-xl" /></div>;
  }

  if (!assignment) {
    return (
      <div className="space-y-4">
        <Link href="/my-assignments" className="text-sm text-brand">← Back</Link>
        <Card><CardContent className="text-sm text-muted-foreground">Assignment not found.</CardContent></Card>
      </div>
    );
  }

  const progress = assignment.total_areas > 0 ? Math.round((assignment.completed_areas / assignment.total_areas) * 100) : 0;
  const nextArea = assignment.areas.find((a) => a.status === "NOT_INSPECTED" || a.status === "INSPECTION_IN_PROGRESS");
  const currentArea = assignment.areas.find((a) => a.status === "INSPECTION_IN_PROGRESS");

  return (
    <div className="space-y-6 max-w-4xl">
      <Link href="/my-assignments" className="text-sm text-brand hover:underline">← My Assignments</Link>

      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{assignment.title}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {assignment.geo_unit?.name} • {assignment.assignment_number}
          </p>
        </div>
        <div className="flex gap-2">
          <Badge variant={assignment.priority === "URGENT" ? "danger" : assignment.priority === "HIGH" ? "warning" : "default"}>
            {assignment.priority}
          </Badge>
          <Badge variant={assignment.status === "COMPLETED" ? "success" : "info"}>
            {assignment.status}
          </Badge>
          {assignment.status !== "COMPLETED" && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
                confirmDelete
                  ? "bg-danger text-white hover:bg-danger/90"
                  : "text-danger hover:bg-danger-light"
              } disabled:opacity-50`}
            >
              {deleting ? "Deleting..." : confirmDelete ? "Confirm Delete" : "Delete"}
            </button>
          )}
        </div>
      </div>

      {/* Progress */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Progress</span>
            <span className="text-2xl font-bold text-brand">{progress}%</span>
          </div>
          <div className="h-3 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-brand rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-2">{assignment.completed_areas} of {assignment.total_areas} plots inspected</p>
        </CardContent>
      </Card>

      {/* Quick actions */}
      {currentArea && (
        <Card className="border-brand/30 bg-brand/5">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">CURRENTLY INSPECTING</p>
                <p className="text-lg font-bold text-foreground">{currentArea.geo_unit.name}</p>
              </div>
              <div className="flex gap-2">
                {currentArea.geo_unit.latitude && (
                  <Button variant="secondary" onClick={() => navigateToPlot(currentArea.geo_unit.latitude, currentArea.geo_unit.longitude)}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    Navigate
                  </Button>
                )}
                <Button onClick={() => updateAreaStatus(currentArea.id, "AWAITING_REVIEW")} disabled={updating === currentArea.id}>
                  Submit for Review
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Next area prompt */}
      {nextArea && !currentArea && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-blue-600">NEXT AREA</p>
                <p className="text-lg font-bold text-foreground">{nextArea.geo_unit.name}</p>
              </div>
              <div className="flex gap-2">
                {nextArea.geo_unit.latitude && (
                  <Button variant="secondary" onClick={() => navigateToPlot(nextArea.geo_unit.latitude, nextArea.geo_unit.longitude)}>
                    <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                    </svg>
                    Navigate
                  </Button>
                )}
                <Button onClick={() => updateAreaStatus(nextArea.id, "INSPECTION_IN_PROGRESS")} disabled={updating === nextArea.id}>
                  Start Inspection
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plot queue */}
      <Card>
        <CardHeader>
          <h2 className="font-semibold text-foreground">Inspection Queue ({assignment.areas.length})</h2>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-border">
            {assignment.areas.map((area, i) => (
              <div key={area.id} className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 transition-colors">
                <span className="text-xs text-muted-foreground w-6 text-right">{i + 1}</span>
                <div className={`w-3 h-3 rounded-full shrink-0 ${statusColor[area.status] ?? "bg-muted-foreground/20"}`} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{area.geo_unit.name}</p>
                  <p className="text-xs text-muted-foreground">{statusLabel[area.status] ?? area.status}</p>
                </div>
                {area.geo_unit.latitude && (
                  <button
                    onClick={() => navigateToPlot(area.geo_unit.latitude, area.geo_unit.longitude)}
                    className="text-xs text-brand hover:underline"
                  >
                    Map →
                  </button>
                )}
                {area.status === "NOT_INSPECTED" && (
                  <Button
                    variant="secondary"
                    onClick={() => updateAreaStatus(area.id, "INSPECTION_IN_PROGRESS")}
                    disabled={updating === area.id}
                  >
                    Start
                  </Button>
                )}
                {area.status === "INSPECTION_IN_PROGRESS" && (
                  <Button
                    onClick={() => updateAreaStatus(area.id, "AWAITING_REVIEW")}
                    disabled={updating === area.id}
                  >
                    Submit
                  </Button>
                )}
                {area.status === "AWAITING_REVIEW" && (
                  <Badge variant="warning">Pending</Badge>
                )}
                {area.status === "INSPECTED" && (
                  <Badge variant="success">Done</Badge>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
