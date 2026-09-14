"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { AuthLike } from "@/lib/supabase/types";

interface Plot {
  id: string;
  plot_number: string;
  plot_label: string;
  size_sqm: number | null;
  inspection_status: string;
  approval_status: string;
  latitude: number | null;
  longitude: number | null;
  geo_unit_name: string;
}

const approvalStatusVariant: Record<string, "default" | "success" | "warning" | "danger" | "muted" | "info"> = {
  NOT_REVIEWED: "muted",
  PENDING: "warning",
  APPROVED: "success",
  APPROVED_WITH_CONDITIONS: "info",
  REJECTED: "danger",
};

const approvalStatusLabel: Record<string, string> = {
  NOT_REVIEWED: "Not Reviewed",
  PENDING: "Pending",
  APPROVED: "Approved",
  APPROVED_WITH_CONDITIONS: "With Conditions",
  REJECTED: "Rejected",
};

export default function ReviewQueuePage() {
  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");

  useEffect(() => {
    fetchPlots();
    const supabase = createClient();
    const auth = supabase.auth as unknown as AuthLike;
    auth.getUser().then(({ data: { user } }) => {
      if (user) {
        supabase.from("profiles").select("role").eq("id", user.id).single()
          .then(({ data }) => { if (data?.role) setUserRole(data.role); });
      }
    }).catch(() => {});
  }, []);

  async function fetchPlots() {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/plots?limit=100");
      const json = await res.json();
      if (json.success) {
        const items = json.data.items as Plot[];
        // Show plots where inspection is done but not yet approved
        const pending = items.filter((p) =>
          ["INSPECTED", "AWAITING_REVIEW", "REINSPECTION_REQUIRED"].includes(p.inspection_status) &&
          ["NOT_REVIEWED", "PENDING"].includes(p.approval_status)
        );
        setPlots(pending);
      }
    } catch { /* */ }
    setLoading(false);
  }

  async function updateApproval(plotId: string, status: string) {
    setUpdating(plotId);
    try {
      await fetch(`/api/v1/plots/${plotId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "approval_status", value: status }),
      });
      fetchPlots();
    } catch { /* */ }
    setUpdating(null);
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Properties awaiting approval officer review</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : plots.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <p className="text-muted-foreground font-medium">All clear</p>
            <p className="text-sm text-muted-foreground/60 mt-1">No properties awaiting review</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {plots.map((plot) => (
            <Card key={plot.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/plots/${plot.id}`} className="font-semibold text-brand hover:underline">
                        {plot.plot_number}
                      </Link>
                      <span className="text-xs text-muted-foreground">•</span>
                      <span className="text-sm text-muted-foreground">{plot.geo_unit_name}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <Badge variant={approvalStatusVariant[plot.approval_status] ?? "default"}>
                        {approvalStatusLabel[plot.approval_status] ?? plot.approval_status}
                      </Badge>
                      {plot.size_sqm && (
                        <span className="text-xs text-muted-foreground">{plot.size_sqm} sqm</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/plots/${plot.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                    {["APPROVAL_OFFICER", "SUPERVISOR", "ADMIN"].includes(userRole) && (
                      <>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => updateApproval(plot.id, "APPROVED")}
                          disabled={updating === plot.id}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="secondary"
                          onClick={() => updateApproval(plot.id, "APPROVED_WITH_CONDITIONS")}
                          disabled={updating === plot.id}
                        >
                          Conditions
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => updateApproval(plot.id, "REJECTED")}
                          disabled={updating === plot.id}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
