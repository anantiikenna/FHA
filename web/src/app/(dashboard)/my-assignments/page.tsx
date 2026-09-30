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
  description: string | null;
  status: string;
  priority: string;
  target_date: string | null;
  total_areas: number;
  completed_areas: number;
  created_at: string;
  geo_unit: { id: string; name: string; unit_type: string } | null;
}

const priorityVariant: Record<string, "default" | "success" | "warning" | "danger" | "muted"> = {
  LOW: "muted",
  NORMAL: "default",
  HIGH: "warning",
  URGENT: "danger",
};

const statusVariant: Record<string, "default" | "success" | "warning" | "info" | "muted"> = {
  DRAFT: "muted",
  ACTIVE: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "muted",
};

export default function MyAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/v1/assignments")
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setAssignments(json.data.items);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const active = assignments.filter((a) => ["ACTIVE", "IN_PROGRESS"].includes(a.status));
  const completed = assignments.filter((a) => a.status === "COMPLETED");

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">My Assignments</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Inspection work assigned to you</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
            </svg>
            <p className="text-muted-foreground font-medium">No assignments yet</p>
            <p className="text-sm text-muted-foreground/60 mt-1">Ask your supervisor to assign inspection work</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active assignments */}
          {active.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">ACTIVE ({active.length})</h2>
              <div className="space-y-3">
                {active.map((a) => {
                  const progress = zoneCoverageProgress(a.completed_areas, a.total_areas);
                  return (
                    <Link key={a.id} href={`/assignments/${a.id}`}>
                      <Card className="hover:shadow-md transition-shadow cursor-pointer border-brand/20">
                        <CardContent className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-foreground">{a.title}</h3>
                                <Badge variant={priorityVariant[a.priority] ?? "default"}>{a.priority}</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground mt-1">{a.geo_unit?.name ?? "Unknown area"}</p>
                              <p className="text-xs text-muted-foreground/60 mt-1">{a.assignment_number}</p>
                            </div>
                            <div className="text-right shrink-0">
                              <div className="text-2xl font-bold text-brand">{progress}%</div>
                              <p className="text-xs text-muted-foreground">{a.completed_areas}/{a.total_areas} plots covered</p>
                            </div>
                          </div>
                          {/* Progress bar */}
                          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-brand rounded-full transition-all duration-500"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          {a.target_date && (
                            <p className="text-xs text-muted-foreground mt-2">
                              Target: {new Date(a.target_date).toLocaleDateString()}
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* Completed */}
          {completed.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3">COMPLETED ({completed.length})</h2>
              <div className="space-y-3">
                {completed.map((a) => (
                  <Link key={a.id} href={`/assignments/${a.id}`}>
                    <Card className="hover:shadow-sm transition-shadow cursor-pointer opacity-70">
                      <CardContent className="p-5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-medium text-foreground">{a.title}</h3>
                            <p className="text-xs text-muted-foreground">{a.geo_unit?.name}</p>
                          </div>
                          <Badge variant="success">Done</Badge>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
