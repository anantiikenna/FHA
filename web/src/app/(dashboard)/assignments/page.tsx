"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { zoneCoverageProgress } from "@/lib/assignment-progress";

interface Assignment {
  id: string;
  assignment_number: string;
  title: string;
  status: string;
  priority: string;
  target_date: string | null;
  total_areas: number;
  completed_areas: number;
  created_at: string;
  geo_unit: { name: string; unit_type: string } | null;
  assignee: { display_name: string; email: string } | null;
}

const statusColors: Record<string, "success" | "warning" | "info" | "danger" | "muted"> = {
  DRAFT: "muted",
  ACTIVE: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "danger",
};

const priorityColors: Record<string, "default" | "warning" | "danger" | "muted"> = {
  LOW: "muted",
  NORMAL: "default",
  HIGH: "warning",
  URGENT: "danger",
};

function label(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const url = filter ? `/api/v1/assignments?status=${filter}` : "/api/v1/assignments";
    fetch(url)
      .then((r) => r.json())
      .then((json) => { if (json.success) setAssignments(json.data.items); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filter]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Inspection Assignments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage field inspection work packages</p>
        </div>
        <Link href="/assignments/new">
          <Button>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
            </svg>
            Create Assignment
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {["", "ACTIVE", "IN_PROGRESS", "COMPLETED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === s ? "bg-brand text-white" : "bg-surface border border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {s ? label(s) : "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-sm text-muted-foreground">Loading assignments...</div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No assignments found.</p>
            <Link href="/assignments/new" className="text-sm text-brand mt-2 inline-block">Create one →</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {assignments.map((a) => {
            const progress = zoneCoverageProgress(a.completed_areas, a.total_areas);
            return (
              <Link key={a.id} href={`/assignments/${a.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="px-5 py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-foreground truncate">{a.title}</h3>
                          <Badge variant={statusColors[a.status] ?? "muted"}>{label(a.status)}</Badge>
                          <Badge variant={priorityColors[a.priority] ?? "default"}>{label(a.priority)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {a.assignment_number} • {a.geo_unit?.name ?? "—"} • {a.assignee?.display_name ?? "Unassigned"}
                          {a.target_date && ` • Due ${new Date(a.target_date).toLocaleDateString()}`}
                        </p>
                      </div>
                      <div className="text-right ml-4">
                        <p className="text-lg font-bold text-foreground">{progress}%</p>
                        <p className="text-xs text-muted-foreground">{a.completed_areas}/{a.total_areas} covered</p>
                        <div className="w-24 h-1.5 bg-muted rounded-full mt-1.5">
                          <div
                            className="h-full bg-brand rounded-full transition-all"
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
