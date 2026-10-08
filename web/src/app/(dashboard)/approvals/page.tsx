"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { AuthLike } from "@/lib/supabase/types";
import { readPropertyOutcome, outcomeRecordedAt, type PropertyOutcomeRecord } from "@/lib/property-outcome";
import { deriveAreaActivity, type AreaHistoryRow } from "@/lib/area-activity";
import { SafeImg } from "@/components/ui/safe-img";

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

const mapAreaStatusVariant: Record<string, "default" | "success" | "warning" | "danger" | "muted" | "info"> = {
  AWAITING_OUTCOME: "muted",
  ACTIVE: "info",
  APPROVED_PROPERTY: "success",
  EMPTY_UNOCCUPIED: "muted",
  UNAPPROVED_PROPERTY: "warning",
  SET_FOR_DEMOLITION: "danger",
  // Legacy rows (pre-simplification workflow):
  AWAITING_REVIEW: "warning",
  REJECTED: "danger",
  REINSPECTION_REQUIRED: "info",
  APPROVED: "success",
};

const mapAreaStatusLabel: Record<string, string> = {
  AWAITING_OUTCOME: "Awaiting Outcome",
  ACTIVE: "Active",
  EMPTY_UNOCCUPIED: "Empty / Unoccupied",
  UNAPPROVED_PROPERTY: "Unapproved Property",
  SET_FOR_DEMOLITION: "Set for Demolition",
  APPROVED_PROPERTY: "Approved Property",
  // Legacy rows:
  AWAITING_REVIEW: "Awaiting Review",
  REJECTED: "Rejected",
  REINSPECTION_REQUIRED: "Re-inspection Required",
  APPROVED: "Approved",
};

const mapAreaTypeLabel: Record<string, string> = {
  ZONE: "Zone",
  PLOT: "Plot",
  PROPERTY: "Property",
  // Legacy rows (pre-Oct 2026 types):
  INSPECTION_ZONE: "Zone",
  REVIEW_AREA: "Plot",
  INSPECTED_AREA: "Property",
};

/** Leaf areas (plot/property) whose direct outcome has been recorded. */
function hasRecordedOutcome(a: MapAreaItem): boolean {
  return readPropertyOutcome(a.metadata) !== null;
}

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
  // History rows per area — who recorded what, when.
  const [areaHistoryByArea, setAreaHistoryByArea] = useState<Record<string, AreaHistoryRow[]>>({});
  // Latest evidence photo per queued area (signed URL), for the record cards.
  const [areaPhotos, setAreaPhotos] = useState<Record<string, string>>({});

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

    // Map areas with a recorded direct outcome (read-only record list)
    (async () => {
      try {
        const res = await fetch("/api/v1/map-areas?limit=200");
        const json = await res.json().catch(() => null);
        if (!cancelled && res.ok && json?.success && Array.isArray(json.data)) {
          const areas = json.data as MapAreaItem[];
          setMapAreas(areas);
          // One batched history call covers every recorded area (no N+1).
          const queueIds = areas.filter(hasRecordedOutcome).map((a) => a.id);
          if (queueIds.length > 0) {
            const hRes = await fetch(`/api/v1/map-areas/history?areaIds=${encodeURIComponent(queueIds.join(","))}`);
            const hJson = await hRes.json().catch(() => null);
            if (!cancelled && hRes.ok && hJson?.success && Array.isArray(hJson.data?.items)) {
              const grouped: Record<string, AreaHistoryRow[]> = {};
              for (const row of hJson.data.items as AreaHistoryRow[]) {
                (grouped[row.area_id] ??= []).push(row);
              }
              setAreaHistoryByArea(grouped);
            }
          }
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

  const mapAreaQueue = mapAreas.filter(hasRecordedOutcome);
  const areaNameById = new Map(mapAreas.map((a) => [a.id, a.name]));

  // One batched call for every queued area's latest evidence photo (no N+1).
  const queueIds = mapAreaQueue.map((a) => a.id).join(",");
  useEffect(() => {
    if (!queueIds) return;
    let cancelled = false;
    fetch(`/api/v1/map-areas/photos?area_ids=${encodeURIComponent(queueIds)}`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          const map: Record<string, string> = {};
          for (const item of json.data) {
            if (item.signedUrl) map[item.area_id] = item.signedUrl;
          }
          setAreaPhotos(map);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [queueIds]);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Review Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Properties awaiting approval review, plus recorded map-area outcomes</p>
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
            <p className="text-sm text-muted-foreground/60 mt-1">No properties awaiting review and no recorded map-area outcomes</p>
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
            <h2 className="text-lg font-semibold text-foreground">Recorded property outcomes</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Direct one-step outcomes recorded from the map</p>
          </div>
          {mapAreaQueue.map((area) => {
            const outcome: PropertyOutcomeRecord | null = readPropertyOutcome(area.metadata);
            const recordedAt = outcome ? outcomeRecordedAt(outcome) : null;
            const activity = deriveAreaActivity(areaHistoryByArea[area.id] ?? []);
            const activityParts: string[] = [];
            if (activity.submittedBy) activityParts.push(`Submitted by ${activity.submittedBy}`);
            if (activity.reviewedAction && activity.reviewedBy) {
              activityParts.push(`${activity.reviewedAction === "APPROVED" ? "Approved" : "Rejected"} by ${activity.reviewedBy}`);
            }
            if (activity.reinspectionBy) activityParts.push(`Re-inspection requested by ${activity.reinspectionBy}`);
            if (activity.latestOutcome) {
              const verb =
                activity.latestOutcome.state === "RECORDED"
                  ? "Outcome recorded"
                  : activity.latestOutcome.state === "ACCEPTED"
                    ? "Outcome accepted"
                    : activity.latestOutcome.state === "REJECTED"
                      ? "Outcome rejected"
                      : "Outcome proposed";
              activityParts.push(`${verb} by ${activity.latestOutcome.actor}`);
            }
            return (
            <Card key={area.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted border border-border shrink-0 flex items-center justify-center">
                    <SafeImg
                      src={areaPhotos[area.id]}
                      alt={`Evidence photo — ${area.name}`}
                      className="w-full h-full object-cover"
                    />
                    {!areaPhotos[area.id] && (
                      <svg className="w-6 h-6 text-muted-foreground/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground">{area.name}</span>
                      <Badge variant="muted">{mapAreaTypeLabel[area.area_type] ?? area.area_type}</Badge>
                      <Badge variant={mapAreaStatusVariant[area.status] ?? "default"}>
                        {mapAreaStatusLabel[area.status] ?? area.status}
                      </Badge>
                      {outcome && (
                        <Badge variant={outcome.state === "REJECTED" ? "danger" : "success"}>
                          {outcome.label} · {outcome.state === "RECORDED" ? "Recorded" : outcome.state === "PROPOSED" ? "Proposed (legacy)" : outcome.state === "ACCEPTED" ? "Accepted (legacy)" : "Rejected (legacy)"}
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-1.5">
                      {area.parent_area_id && areaNameById.get(area.parent_area_id)
                        ? `Inside ${areaNameById.get(area.parent_area_id)} • `
                        : ""}
                      {(area.plot_ids?.length ?? 0)} plot(s) • Created {area.created_at.slice(0, 10)}
                      {recordedAt
                        ? ` • Recorded ${recordedAt.slice(0, 10)}`
                        : ""}
                    </div>
                    {activityParts.length > 0 && (
                      <p className="text-[11px] text-muted-foreground/80 mt-1">
                        {activityParts.join(" · ")}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Link href={`/map`}>
                      <Button variant="secondary">Open on Map</Button>
                    </Link>
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
