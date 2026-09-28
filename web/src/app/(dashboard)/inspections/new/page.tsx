"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ComparisonCard } from "@/components/inspection/ComparisonCard";
import { GpsCapture } from "@/components/inspection/GpsCapture";
import { PhotoUpload } from "@/components/inspection/PhotoUpload";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function firstOf<T>(v: T[] | T | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

interface PlotData {
  id: string;
  plot_number: string;
  street: string;
  estate: { name: string }[] | null;
  block: { block_number: string }[] | null;
  approvals: { approved_floors: number; approved_units: number }[] | null;
}

export default function NewInspectionPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 max-w-3xl">
          <div className="h-8 w-64 bg-muted rounded animate-pulse" />
          <div className="h-40 bg-muted rounded-xl animate-pulse" />
        </div>
      }
    >
      <NewInspectionContent />
    </Suspense>
  );
}

function NewInspectionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plotId = searchParams.get("plotId");
  const areaId = searchParams.get("areaId");

  const [plot, setPlot] = useState<PlotData | null>(null);
  const [areaName, setAreaName] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!plotId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspectionId, setInspectionId] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);

  const [inspectionType, setInspectionType] = useState<"ROUTINE" | "FOLLOW_UP" | "COMPLIANCE">("ROUTINE");
  const [constructionStage, setConstructionStage] = useState("");
  const [observedFloors, setObservedFloors] = useState("");
  const [observedUnits, setObservedUnits] = useState("");
  const [observations, setObservations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [complianceStatus, setComplianceStatus] = useState("");

  useEffect(() => {
    if (!plotId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/plots/${plotId}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) setPlot(json.data);
        else setError(json.error?.message ?? "Plot not found");
      } catch {
        if (!cancelled) setError("Failed to load plot");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [plotId]);

  useEffect(() => {
    if (!areaId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/v1/map-areas/${areaId}`);
        const json = await res.json();
        if (!cancelled && json.success) setAreaName(json.data?.name ?? null);
      } catch { /* chip is optional */ }
    })();
    return () => { cancelled = true; };
  }, [areaId]);

  function buildPayload(status?: "DRAFT" | "SUBMITTED"): Record<string, unknown> {
    const body: Record<string, unknown> = {
      plotId,
      inspectionType,
      constructionStage: constructionStage || undefined,
      observedFloors: observedFloors ? parseInt(observedFloors, 10) : undefined,
      observedUnits: observedUnits ? parseInt(observedUnits, 10) : undefined,
      observations: observations || undefined,
      recommendations: recommendations || undefined,
      complianceStatus: complianceStatus || undefined,
    };
    if (status) body.status = status;
    if (gpsCoords) {
      body.latitude = gpsCoords.latitude;
      body.longitude = gpsCoords.longitude;
      if (gpsCoords.accuracy != null) body.gpsAccuracy = gpsCoords.accuracy;
    }
    return body;
  }

  const draftLockRef = useRef(false);

  async function ensureDraft(): Promise<string | null> {
    if (inspectionId) return inspectionId;
    if (draftLockRef.current) return null;
    draftLockRef.current = true;
    try {
      const res = await fetch("/api/v1/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("DRAFT")),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Failed to save draft.");
        return null;
      }
      const id = json.data?.id as string | undefined;
      if (id) setInspectionId(id);
      return id ?? null;
    } finally {
      draftLockRef.current = false;
    }
  }

  async function handleSubmit(status: "DRAFT" | "SUBMITTED") {
    if (!plotId) return;
    if (submitting) return;
    setSubmitting(true);
    setError(null);

    try {
      if (status === "DRAFT") {
        if (inspectionId) {
          const res = await fetch(`/api/v1/inspections/${inspectionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(buildPayload()),
          });
          const json = await res.json();
          if (!json.success) {
            setError(json.error?.message ?? "Failed to save.");
            return;
          }
          router.push(`/inspections/${inspectionId}`);
          return;
        }
        const id = await ensureDraft();
        if (!id) return;
        router.push(`/inspections/${id}`);
        return;
      }

      // SUBMIT: create draft if needed (so photos attach), then PATCH status
      let targetId = inspectionId;
      if (!targetId) {
        targetId = await ensureDraft();
        if (!targetId) return;
      }

      const patchRes = await fetch(`/api/v1/inspections/${targetId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload("SUBMITTED")),
      });
      const json = await patchRes.json();
      if (!json.success) {
        setError(json.error?.message ?? "Failed to submit.");
        return;
      }
      router.push(`/inspections/${targetId}`);
    } catch {
      setError("Network error — try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePhotoCapture() {
    if (submitting || draftLockRef.current) return;
    setSubmitting(true);
    try {
      if (!inspectionId && plotId) {
        await ensureDraft();
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!plotId) {
    return <div className="text-sm text-slate-500">No plot selected. Go to the map or a plot page to start an inspection.</div>;
  }

  const approval = firstOf(plot?.approvals);
  const blockNum = firstOf(plot?.block)?.block_number ?? "—";
  const estateName = firstOf(plot?.estate)?.name ?? "—";
  const em = "\u2014";

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold">New Site Inspection</h1>

      {areaName && (
        <div className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-sm text-blue-700 w-fit">
          <span className="font-semibold">Marked area:</span>
          {areaName}
        </div>
      )}

      {loading && <p className="text-sm text-slate-500">Loading plot...</p>}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {plot && (
        <>
          <Card>
            <CardHeader>
              <h2 className="font-semibold">
                Plot {plot.plot_number} {em} Block {blockNum} {em} {estateName}
              </h2>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              {approval
                ? `${approval.approved_floors} floors / ${approval.approved_units} units`
                : "No approval on record"}
            </CardContent>
          </Card>

          <GpsCapture onCapture={setGpsCoords} />

          {gpsCoords && (
            <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-sm text-green-700">
              GPS captured: {gpsCoords.latitude.toFixed(6)}, {gpsCoords.longitude.toFixed(6)}
              {gpsCoords.accuracy != null && ` \u00b1${gpsCoords.accuracy.toFixed(0)}m`}
            </div>
          )}

          {inspectionId && <PhotoUpload inspectionId={inspectionId} />}
          {!inspectionId && (
            <Card>
              <CardContent className="pt-4">
              <button
                onClick={handlePhotoCapture}
                disabled={submitting}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Enable Photo Capture (creates draft)"}
              </button>
                <p className="text-xs text-slate-500 mt-2">Save the draft first to attach site photos.</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader><h2 className="font-semibold">Observations</h2></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="block">
                Inspection Type
                <select value={inspectionType} onChange={(e) => setInspectionType(e.target.value as typeof inspectionType)} className="mt-1 w-full rounded border border-border px-2 py-1.5">
                  <option value="ROUTINE">Routine</option>
                  <option value="FOLLOW_UP">Follow Up</option>
                  <option value="COMPLIANCE">Compliance</option>
                </select>
              </label>
              <label className="block">
                Construction Stage
                <select value={constructionStage} onChange={(e) => setConstructionStage(e.target.value)} className="mt-1 w-full rounded border border-border px-2 py-1.5">
                  <option value="">Select...</option>
                  <option value="FOUNDATION">Foundation</option>
                  <option value="GROUND_FLOOR">Ground Floor</option>
                  <option value="FIRST_FLOOR">First Floor</option>
                  <option value="ROOF_LEVEL">Roof Level</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </label>
              <label className="block">
                Floors Observed
                <input type="number" min={0} value={observedFloors} onChange={(e) => setObservedFloors(e.target.value)} placeholder="e.g. 2" className="mt-1 w-full rounded border border-border px-2 py-1.5" />
              </label>
              <label className="block">
                Units Observed
                <input type="number" min={0} value={observedUnits} onChange={(e) => setObservedUnits(e.target.value)} placeholder="e.g. 4" className="mt-1 w-full rounded border border-border px-2 py-1.5" />
              </label>
              <label className="block">
                Observations
                <textarea value={observations} onChange={(e) => setObservations(e.target.value)} rows={3} placeholder="Describe what you observed..." className="mt-1 w-full rounded border border-border px-2 py-1.5" />
              </label>
              <label className="block">
                Recommendations
                <textarea value={recommendations} onChange={(e) => setRecommendations(e.target.value)} rows={2} placeholder="Recommendations..." className="mt-1 w-full rounded border border-border px-2 py-1.5" />
              </label>
              <label className="block">
                Compliance Status
                <select value={complianceStatus} onChange={(e) => setComplianceStatus(e.target.value)} className="mt-1 w-full rounded border border-border px-2 py-1.5">
                  <option value="">Select...</option>
                  <option value="COMPLIANT">Compliant</option>
                  <option value="MINOR_NON_COMPLIANT">Minor Non-Compliant</option>
                  <option value="MAJOR_NON_COMPLIANT">Major Non-Compliant</option>
                  <option value="UNABLE_TO_DETERMINE">Unable to Determine</option>
                </select>
              </label>
            </CardContent>
          </Card>

          <ComparisonCard
            approvedFloors={approval?.approved_floors ?? null}
            approvedUnits={approval?.approved_units ?? null}
            observedFloors={observedFloors ? parseInt(observedFloors, 10) : null}
            observedUnits={observedUnits ? parseInt(observedUnits, 10) : null}
          />

          <Card>
            <CardContent className="flex gap-3 pt-4">
              <button
                onClick={() => handleSubmit("DRAFT")}
                disabled={submitting}
                className="rounded-lg border border-border bg-white px-4 py-2 text-sm disabled:opacity-50"
              >
                {submitting ? "Saving..." : "Save Draft"}
              </button>
              <button
                onClick={() => handleSubmit("SUBMITTED")}
                disabled={submitting}
                className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Inspection"}
              </button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
