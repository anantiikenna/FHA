"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { PhotoUpload } from "@/components/inspection/PhotoUpload";
import { ComparisonCard } from "@/components/inspection/ComparisonCard";
import { FindingsForm } from "@/components/inspection/FindingsForm";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";

interface InspectionData {
  id: string;
  inspection_number: string;
  inspection_type: string;
  inspection_date: string;
  status: string;
  compliance_status: string | null;
  construction_stage: string | null;
  observed_floors: number | null;
  observed_units: number | null;
  observations: string | null;
  recommendations: string | null;
  latitude: number | null;
  longitude: number | null;
  gps_accuracy: number | null;
  plot: { id: string; plot_number: string; street: string }[] | { id: string; plot_number: string; street: string } | null;
  map_area: { id: string; name: string }[] | { id: string; name: string } | null;
  approval: { approved_floors: number; approved_units: number }[] | { approved_floors: number; approved_units: number } | null;
}

function firstOf<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

const statusVariant: Record<string, "success" | "warning" | "muted" | "danger" | "info"> = {
  DRAFT: "muted",
  SUBMITTED: "warning",
  UNDER_REVIEW: "info",
  COMPLETED: "success",
};

function label(s: string) {
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function InspectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [inspection, setInspection] = useState<InspectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [canDelete, setCanDelete] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/v1/inspections/${id}`);
        const json = await res.json();
        if (cancelled) return;
        if (json.success) setInspection(json.data);
        else setError(json.error?.message ?? "Inspection not found");
      } catch {
        if (!cancelled) setError("Failed to load inspection");
      } finally {
        if (!cancelled) setLoading(false);
      }
      try {
        const res = await fetch("/api/v1/auth/me");
        const json = await res.json();
        if (!cancelled && json.success) {
          const role = json.data?.role;
          setCanDelete(role === "ADMIN" || role === "SUPERVISOR");
        }
      } catch {
        // keep canDelete false
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/inspections/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "SUBMITTED" }),
      });
      const json = await res.json().catch(() => null);
      if (json?.success) {
        setInspection((prev) => prev ? { ...prev, status: "SUBMITTED" } : prev);
      } else {
        setError(json?.error?.message ?? "Failed to submit inspection.");
      }
    } catch {
      setError("Network error.");
    }
    setSubmitting(false);
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    setDeleting(true);
    try {
      const res = await fetch(`/api/v1/inspections/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        router.push("/inspections");
      } else {
        setError(json.error?.message ?? "Failed to delete.");
        setDeleting(false);
        setConfirmDelete(false);
      }
    } catch {
      setError("Network error.");
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  if (loading) return <p className="text-sm text-slate-500">Loading inspection...</p>;
  if (error) return <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>;
  if (!inspection) return <p className="text-sm text-slate-500">Inspection not found.</p>;

  return (
    <div className="space-y-4 max-w-3xl">
      <Link href="/inspections" className="text-sm text-brand hover:underline">← Back to Inspections</Link>

      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">{inspection.inspection_number}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Plot {firstOf(inspection.plot)?.plot_number ?? "—"} — {inspection.inspection_date}
            {firstOf(inspection.map_area)?.name ? ` — Area: ${firstOf(inspection.map_area)?.name}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariant[inspection.status] ?? "muted"}>{label(inspection.status)}</Badge>
          {canDelete && ["DRAFT", "SUBMITTED"].includes(inspection.status) && (
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

      <Card>
        <CardHeader><h2 className="font-semibold">Inspection Details</h2></CardHeader>
        <CardContent className="text-sm space-y-2">
          <p><span className="text-muted-foreground">Type:</span> {label(inspection.inspection_type)}</p>
          {inspection.construction_stage && <p><span className="text-muted-foreground">Stage:</span> {label(inspection.construction_stage)}</p>}
          {inspection.observed_floors != null && <p><span className="text-muted-foreground">Floors:</span> {inspection.observed_floors}</p>}
          {inspection.observed_units != null && <p><span className="text-muted-foreground">Units:</span> {inspection.observed_units}</p>}
          {inspection.compliance_status && <p><span className="text-muted-foreground">Compliance:</span> {label(inspection.compliance_status)}</p>}
          {inspection.observations && <p><span className="text-muted-foreground">Observations:</span> {inspection.observations}</p>}
          {inspection.recommendations && <p><span className="text-muted-foreground">Recommendations:</span> {inspection.recommendations}</p>}
        </CardContent>
      </Card>

      {inspection.latitude != null && inspection.longitude != null && (
        <Card>
          <CardHeader><h2 className="font-semibold">GPS Evidence</h2></CardHeader>
          <CardContent className="text-sm">
            <p>Location: {inspection.latitude.toFixed(6)}, {inspection.longitude.toFixed(6)}</p>
            {inspection.gps_accuracy != null && <p>Accuracy: ±{inspection.gps_accuracy.toFixed(0)}m</p>}
          </CardContent>
        </Card>
      )}

      <ComparisonCard
        approvedFloors={firstOf(inspection.approval)?.approved_floors ?? null}
        approvedUnits={firstOf(inspection.approval)?.approved_units ?? null}
        observedFloors={inspection.observed_floors}
        observedUnits={inspection.observed_units}
      />

      <FindingsForm
        inspectionId={inspection.id}
        readOnly={inspection.status === "COMPLETED"}
      />

      <PhotoUpload inspectionId={inspection.id} />

      {inspection.status === "DRAFT" && (
        <Card>
          <CardContent className="flex gap-3 pt-4">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit for Review"}
            </button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
