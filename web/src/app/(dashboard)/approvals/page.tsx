"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { AuthLike } from "@/lib/supabase/types";
import { readPropertyOutcome, type PropertyOutcomeRecord } from "@/lib/property-outcome";

interface Plot {
  id: string;
  plot_number: string;
  plot_size: number | null;
  plot_size_unit: string;
  street: string | null;
  inspection_status: string;
  approval_status: string;
  latitude: number | null;
  longitude: number | null;
  block: { block_number: string } | null;
  estate: { name: string } | null;
}

interface ApprovalVerification {
  approval_number: string;
  status: string;
  approval_date: string | null;
  valid_until: string | null;
  development_type: string | null;
  approved_floors: number;
  approved_units: number;
  conditions: string | null;
  plot: { plot_number: string; street: string; estate: { name: string } | null } | null;
  verification: { result: string; expired: boolean; checkedAt: string };
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

interface MapAreaItem {
  id: string;
  name: string;
  area_type: string;
  status: string;
  parent_area_id: string | null;
  plot_ids: string[] | null;
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

const MAP_AREA_QUEUE_STATUSES = ["AWAITING_REVIEW", "REJECTED", "REINSPECTION_REQUIRED"];

const mapAreaStatusVariant: Record<string, "default" | "success" | "warning" | "danger" | "muted" | "info"> = {
  AWAITING_REVIEW: "warning",
  REJECTED: "danger",
  REINSPECTION_REQUIRED: "info",
  APPROVED: "success",
  EMPTY_UNOCCUPIED: "muted",
  UNAPPROVED_PROPERTY: "warning",
  SET_FOR_DEMOLITION: "danger",
  APPROVED_PROPERTY: "success",
};

const mapAreaStatusLabel: Record<string, string> = {
  AWAITING_REVIEW: "Awaiting Review",
  REJECTED: "Rejected",
  REINSPECTION_REQUIRED: "Re-inspection Required",
  APPROVED: "Approved",
  EMPTY_UNOCCUPIED: "Empty / Unoccupied",
  UNAPPROVED_PROPERTY: "Unapproved Property",
  SET_FOR_DEMOLITION: "Set for Demolition",
  APPROVED_PROPERTY: "Approved Property",
};

const mapAreaTypeLabel: Record<string, string> = {
  INSPECTION_ZONE: "Zone",
  INSPECTED_AREA: "Field Area",
};

export default function ReviewQueuePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6 max-w-4xl">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        </div>
      }
    >
      <ReviewQueueContent />
    </Suspense>
  );
}

function ReviewQueueContent() {
  const searchParams = useSearchParams();
  const plotIdParam = searchParams.get("plotId");

  const [plots, setPlots] = useState<Plot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [updateError, setUpdateError] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [verification, setVerification] = useState<ApprovalVerification | null>(null);
  const [mapAreas, setMapAreas] = useState<MapAreaItem[]>([]);
  const [mapAreaUpdating, setMapAreaUpdating] = useState<string | null>(null);

  function applyPendingPlots(items: Plot[]) {
    const pending = items.filter((p) =>
      ["INSPECTED", "AWAITING_REVIEW", "REINSPECTION_REQUIRED"].includes(p.inspection_status) &&
      ["NOT_REVIEWED", "PENDING"].includes(p.approval_status)
    );
    setPlots(pending);
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/plots?limit=100");
        const json = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok || !json?.success) {
          setLoadError(json?.error?.message ?? "Failed to load properties awaiting review.");
          setPlots([]);
        } else {
          applyPendingPlots(json.data.items as Plot[]);
        }
      } catch {
        if (!cancelled) {
          setLoadError("Network error. Please try again.");
          setPlots([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Map areas drawn on the map (zones / field areas) awaiting review
    (async () => {
      try {
        const res = await fetch("/api/v1/map-areas?limit=200");
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.success && Array.isArray(json.data)) {
          setMapAreas(json.data as MapAreaItem[]);
        }
      } catch {
        // review queue for map areas is optional; plot queue still renders
      }
    })();

    const supabase = createClient();
    const auth = supabase.auth as unknown as AuthLike;
    auth.getUser().then(({ data: { user } }) => {
      if (user && !cancelled) {
        supabase.from("profiles").select("role").eq("id", user.id).single()
          .then(({ data }) => { if (data?.role && !cancelled) setUserRole(data.role); });
      }
    }).catch(() => {});

    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!plotIdParam) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/approvals?plotId=${encodeURIComponent(plotIdParam)}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data?.verification?.result === "RECORD_FOUND") {
          setVerification(json.data as ApprovalVerification);
        } else if (json.success && json.data?.verification?.result === "NOT_FOUND") {
          setVerification(null);
          setLoadError("No approved approval record found for this plot.");
        } else {
          setLoadError(json.error?.message ?? "Failed to verify approval.");
        }
      } catch {
        if (!cancelled) setLoadError("Failed to verify approval.");
      }
    })();
    return () => { cancelled = true; };
  }, [plotIdParam]);

  async function updateApproval(plotId: string, status: string) {
    setUpdating(plotId);
    setUpdateError(null);
    try {
      const res = await fetch(`/api/v1/plots/${plotId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ field: "approval_status", value: status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setUpdateError(json?.error?.message ?? "Failed to update approval status.");
      } else {
        setLoading(true);
        try {
          const listRes = await fetch("/api/v1/plots?limit=100");
          const listJson = await listRes.json().catch(() => null);
          if (!listRes.ok || !listJson?.success) {
            setLoadError(listJson?.error?.message ?? "Failed to load properties awaiting review.");
            setPlots([]);
          } else {
            applyPendingPlots(listJson.data.items as Plot[]);
          }
        } catch {
          setLoadError("Network error. Please try again.");
          setPlots([]);
          setLoading(false);
        }
      }
    } catch {
      setUpdateError("Network error. Please try again.");
    }
    setUpdating(null);
  }

  async function updateMapAreaStatus(areaId: string, status: string) {
    setMapAreaUpdating(areaId);
    setUpdateError(null);
    try {
      const res = await fetch(`/api/v1/map-areas/${areaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setUpdateError(json?.error?.message ?? "Failed to update map area status.");
      } else {
        setMapAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, status } : a)));
      }
    } catch {
      setUpdateError("Network error. Please try again.");
    }
    setMapAreaUpdating(null);
  }

  // Higher review role agrees to / rejects an officer's proposed outcome.
  async function updateMapAreaOutcome(areaId: string, type: string, action: "agree" | "reject") {
    setMapAreaUpdating(areaId);
    setUpdateError(null);
    try {
      const res = await fetch(`/api/v1/map-areas/${areaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ property_outcome: { type, action } }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        setUpdateError(json?.error?.message ?? "Failed to review the property outcome.");
      } else {
        setMapAreas((prev) => prev.map((a) => (a.id === areaId ? { ...a, metadata: json?.data?.metadata ?? a.metadata } : a)));
      }
    } catch {
      setUpdateError("Network error. Please try again.");
    }
    setMapAreaUpdating(null);
  }

  const canReview = ["APPROVAL_OFFICER", "SUPERVISOR", "ADMIN"].includes(userRole);
  const mapAreaQueue = mapAreas.filter((a) => MAP_AREA_QUEUE_STATUSES.includes(a.status));
  const areaNameById = new Map(mapAreas.map((a) => [a.id, a.name]));

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Properties and map areas awaiting approval officer review</p>
      </div>

      {plotIdParam && (
        <Card>
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Approval Verification</h2>
                <p className="text-xs text-muted-foreground">Plot ID: {plotIdParam}</p>
              </div>
              <Link href="/approvals">
                <Button variant="ghost">Clear</Button>
              </Link>
            </div>
            {verification ? (
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant={approvalStatusVariant[verification.status] ?? "default"}>
                    {approvalStatusLabel[verification.status] ?? verification.status}
                  </Badge>
                  <span className="font-medium">{verification.approval_number}</span>
                  {verification.verification.expired && (
                    <Badge variant="danger">Expired</Badge>
                  )}
                </div>
                <p className="text-muted-foreground">
                  {verification.plot?.plot_number ?? "—"}
                  {verification.plot?.estate?.name ? ` • ${verification.plot.estate.name}` : ""}
                </p>
                <p>
                  Approved: {verification.approved_floors} floors / {verification.approved_units} units
                  {verification.development_type ? ` • ${verification.development_type}` : ""}
                </p>
                {verification.valid_until && (
                  <p className="text-muted-foreground">Valid until: {verification.valid_until}</p>
                )}
                {verification.conditions && (
                  <p className="text-muted-foreground">Conditions: {verification.conditions}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Stored record found. Result reflects database state only — not an official FHA decision.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No approved approval record found for this plot.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {loadError && (
        <div className="rounded-xl bg-danger-light/50 border border-danger/15 px-4 py-3 text-sm text-danger">
          {loadError}
        </div>
      )}
      {updateError && (
        <div className="rounded-xl bg-danger-light/50 border border-danger/15 px-4 py-3 text-sm text-danger">
          {updateError}
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : plots.length === 0 && mapAreaQueue.length === 0 && !loadError ? (
        <Card>
          <CardContent className="text-center py-12">
            <svg className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            <p className="text-muted-foreground font-medium">All clear</p>
            <p className="text-sm text-muted-foreground/60 mt-1">No properties or map areas awaiting review</p>
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
                      <span className="text-sm text-muted-foreground">
                        {plot.block?.block_number ? `Block ${plot.block.block_number}` : ""}
                        {plot.estate?.name ? ` • ${plot.estate.name}` : ""}
                        {plot.street ? ` • ${plot.street}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      <Badge variant={approvalStatusVariant[plot.approval_status] ?? "default"}>
                        {approvalStatusLabel[plot.approval_status] ?? plot.approval_status}
                      </Badge>
                      {plot.plot_size && (
                        <span className="text-xs text-muted-foreground">{plot.plot_size} {plot.plot_size_unit}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/plots/${plot.id}`}>
                      <Button variant="secondary">View</Button>
                    </Link>
                    <Link href={`/approvals?plotId=${plot.id}`}>
                      <Button variant="ghost">Verify</Button>
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

      {!loading && mapAreaQueue.length > 0 && (
        <div className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Map areas awaiting review</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Zones and field areas submitted from the map</p>
          </div>
          {mapAreaQueue.map((area) => {
            const outcome: PropertyOutcomeRecord | null = readPropertyOutcome(area.metadata);
            return (
            <Card key={area.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{area.name}</span>
                      <Badge variant="muted">{mapAreaTypeLabel[area.area_type] ?? area.area_type}</Badge>
                      <Badge variant={mapAreaStatusVariant[area.status] ?? "default"}>
                        {mapAreaStatusLabel[area.status] ?? area.status}
                      </Badge>
                      {outcome && (
                        <Badge variant={outcome.state === "ACCEPTED" ? "success" : outcome.state === "REJECTED" ? "danger" : "warning"}>
                          {outcome.label} · {outcome.state === "PROPOSED" ? "Proposed" : outcome.state === "ACCEPTED" ? "Accepted" : "Rejected"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {area.parent_area_id && areaNameById.get(area.parent_area_id)
                        ? `Inside ${areaNameById.get(area.parent_area_id)} • `
                        : ""}
                      {(area.plot_ids?.length ?? 0)} plot(s) • Created {area.created_at.slice(0, 10)}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {canReview && outcome?.state === "PROPOSED" && (
                      <>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => updateMapAreaOutcome(area.id, outcome.type, "agree")}
                          disabled={mapAreaUpdating === area.id}
                        >
                          Agree Outcome
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => updateMapAreaOutcome(area.id, outcome.type, "reject")}
                          disabled={mapAreaUpdating === area.id}
                        >
                          Reject Outcome
                        </Button>
                      </>
                    )}
                    {canReview && area.status === "AWAITING_REVIEW" && (
                      <>
                        <Button
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => updateMapAreaStatus(area.id, "APPROVED")}
                          disabled={mapAreaUpdating === area.id}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => updateMapAreaStatus(area.id, "REJECTED")}
                          disabled={mapAreaUpdating === area.id}
                        >
                          Reject
                        </Button>
                      </>
                    )}
                    {canReview && area.status === "REJECTED" && (
                      <Button
                        variant="secondary"
                        onClick={() => updateMapAreaStatus(area.id, "REINSPECTION_REQUIRED")}
                        disabled={mapAreaUpdating === area.id}
                      >
                        Request Re-inspection
                      </Button>
                    )}
                    {area.status === "REINSPECTION_REQUIRED" && (
                      <span className="text-xs text-muted-foreground self-center">
                        {area.area_type === "INSPECTION_ZONE"
                          ? "With the zone officer — re-inspection required"
                          : "With the field officer — re-inspection required"}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
