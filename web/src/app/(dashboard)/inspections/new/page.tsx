"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ComparisonCard } from "@/components/inspection/ComparisonCard";
import { GpsCapture } from "@/components/inspection/GpsCapture";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface PlotData {
  id: string;
  plot_number: string;
  street: string;
  estate: { name: string } | null;
  block: { block_number: string } | null;
  approvals: { approved_floors: number; approved_units: number }[] | null;
}

export default function NewInspectionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const plotId = searchParams.get("plotId");

  const [plot, setPlot] = useState<PlotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number; accuracy: number | null } | null>(null);

  const [inspectionType, setInspectionType] = useState<"ROUTINE" | "FOLLOW_UP" | "COMPLIANCE">("ROUTINE");
  const [constructionStage, setConstructionStage] = useState("");
  const [observedFloors, setObservedFloors] = useState("");
  const [observedUnits, setObservedUnits] = useState("");
  const [observations, setObservations] = useState("");
  const [recommendations, setRecommendations] = useState("");
  const [complianceStatus, setComplianceStatus] = useState("");

  useEffect(() => {
    if (!plotId) { setLoading(false); return; }
    fetch(`/api/v1/plots/${plotId}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success) setPlot(json.data);
        else setError(json.error?.message ?? "Plot not found");
      })
      .catch(() => setError("Failed to load plot"))
      .finally(() => setLoading(false));
  }, [plotId]);

  async function handleSubmit(status: "DRAFT" | "SUBMITTED") {
    if (!plotId) return;
    setSubmitting(true);
    setError(null);

    const body: Record<string, unknown> = {
      plotId,
      inspectionType,
      constructionStage: constructionStage || undefined,
      observedFloors: observedFloors ? parseInt(observedFloors, 10) : undefined,
      observedUnits: observedUnits ? parseInt(observedUnits, 10) : undefined,
      observations: observations || undefined,
      recommendations: recommendations || undefined,
      complianceStatus: complianceStatus || undefined,
      status,
    };

    if (gpsCoords) {
      body.latitude = gpsCoords.latitude;
      body.longitude = gpsCoords.longitude;
      if (gpsCoords.accuracy != null) body.gpsAccuracy = gpsCoords.accuracy;
    }

    try {
      const res = await fetch("/api/v1/inspections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Failed to save.");
        return;
      }
      const inspectionId = json.data?.id;
      if (inspectionId) {
        router.push(`/inspections/${inspectionId}`);
      } else {
        router.push("/inspections");
      }
    } catch {
      setError("Network error \u2014 try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!plotId) {
    return <div className="text-sm text-slate-500">No plot selected. Go to the map or a plot page to start an inspection.</div>;
  }

  const approval = plot?.approvals?.[0];

  return (
    <div className="space-y-4 max-w-3xl">
      <h1 className="text-xl font-bold">New Site Inspection</h1>

      {loading && <p className="text-sm text-slate-500">Loading plot...</p>}

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>
      )}

      {plot && (
        <>
          <Card>
            <CardHeader>
              <h2 className="font-semibold">
                Plot {plot.plot_number} \u2014 Block {plot.block?.block_number ?? "\u2014"} \u2014 {plot.estate?.name ?? "\u2014"}
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

          {approval && (
            <ComparisonCard
              approvedFloors={approval.approved_floors}
              approvedUnits={approval.approved_units}
              observedFloors={observedFloors ? parseInt(observedFloors, 10) : null}
              observedUnits={observedUnits ? parseInt(observedUnits, 10) : null}
            />
          )}

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
