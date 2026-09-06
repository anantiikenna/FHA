"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface PlotData {
  id: string;
  plotNumber: string;
  status: string;
  inspectionStatus: string;
  approvalStatus: string;
  assignmentStatus: string | null;
  lat: number | null;
  lng: number | null;
  block: string;
  estate: string;
}

// Approval status colors (primary — outer ring)
const APPROVAL_COLORS: Record<string, string> = {
  APPROVED: "#10b981",
  APPROVED_WITH_CONDITIONS: "#34d399",
  PENDING: "#facc15",
  REJECTED: "#ef4444",
  NOT_REVIEWED: "#94a3b8",
};

// Inspection status colors (secondary — inner dot)
const INSPECTION_COLORS: Record<string, string> = {
  NOT_INSPECTED: "#d1d5db",
  INSPECTION_IN_PROGRESS: "#60a5fa",
  INSPECTED: "#f97316",
  AWAITING_REVIEW: "#fbbf24",
  REINSPECTION_REQUIRED: "#a855f7",
};

// Assignment status colors
const ASSIGNMENT_COLORS: Record<string, string> = {
  NOT_INSPECTED: "#d1d5db",
  INSPECTION_IN_PROGRESS: "#3b82f6",
  INSPECTED: "#10b981",
  AWAITING_REVIEW: "#f59e0b",
  REINSPECTION_REQUIRED: "#8b5cf6",
  COMPLETED: "#10b981",
  PENDING: "#facc15",
  IN_PROGRESS: "#3b82f6",
  CANCELLED: "#ef4444",
};

function getStatusLabel(status: string) {
  return status.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MapView({
  plots = [],
  statusMode = "approval",
}: {
  plots?: PlotData[];
  statusMode?: "approval" | "inspection" | "assignment";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const router = useRouter();
  const [selectedPlot, setSelectedPlot] = useState<PlotData | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: ref.current,
      style: "/map-style.json",
      center: [3.2833, 6.4667],
      zoom: 15,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      addMarkers(map, plots);
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-add markers when plots or statusMode changes
  useEffect(() => {
    if (!mapRef.current) return;
    addMarkers(mapRef.current, plots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots, statusMode]);

  function addMarkers(map: maplibregl.Map, data: PlotData[]) {
    // Clear old markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.forEach((plot) => {
      if (plot.lat == null || plot.lng == null) return;

      let primaryColor: string;
      let secondaryColor: string;

      if (statusMode === "assignment") {
        primaryColor = plot.assignmentStatus
          ? (ASSIGNMENT_COLORS[plot.assignmentStatus] ?? "#94a3b8")
          : "#d1d5db";
        secondaryColor = (INSPECTION_COLORS[plot.inspectionStatus] ?? "#94a3b8");
      } else {
        const isApproval = statusMode === "approval";
        primaryColor = isApproval
          ? (APPROVAL_COLORS[plot.approvalStatus] ?? "#94a3b8")
          : (INSPECTION_COLORS[plot.inspectionStatus] ?? "#94a3b8");
        secondaryColor = isApproval
          ? (INSPECTION_COLORS[plot.inspectionStatus] ?? "#94a3b8")
          : (APPROVAL_COLORS[plot.approvalStatus] ?? "#94a3b8");
      }

      // Create a custom marker element with outer ring + inner dot
      const el = document.createElement("div");
      el.style.cssText = `
        width: 28px; height: 28px; border-radius: 50%;
        background: ${primaryColor}; border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3); cursor: pointer;
        display: flex; align-items: center; justify-content: center;
        transition: transform 0.15s;
      `;
      el.onmouseenter = () => { el.style.transform = "scale(1.2)"; };
      el.onmouseleave = () => { el.style.transform = "scale(1)"; };

      // Inner dot
      const dot = document.createElement("div");
      dot.style.cssText = `
        width: 10px; height: 10px; border-radius: 50%;
        background: ${secondaryColor}; border: 1px solid white;
      `;
      el.appendChild(dot);

      const inspLabel = getStatusLabel(plot.inspectionStatus);
      const approvLabel = getStatusLabel(plot.approvalStatus);
      const assignLabel = plot.assignmentStatus ? getStatusLabel(plot.assignmentStatus) : null;

      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([plot.lng, plot.lat])
        .setPopup(
          new maplibregl.Popup({ offset: 25, maxWidth: "280px" }).setHTML(`
            <div style="font-size:13px;padding:6px;font-family:system-ui">
              <strong style="font-size:14px">Plot ${plot.plotNumber}</strong><br/>
              <span style="color:#64748b">Block ${plot.block} — ${plot.estate}</span>
              <div style="margin-top:8px;padding:6px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${INSPECTION_COLORS[plot.inspectionStatus] ?? '#94a3b8'}"></span>
                  <span><strong>Inspection:</strong> ${inspLabel}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px${assignLabel ? ';margin-bottom:4px' : ''}">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${APPROVAL_COLORS[plot.approvalStatus] ?? '#94a3b8'}"></span>
                  <span><strong>Approval:</strong> ${approvLabel}</span>
                </div>
                ${assignLabel ? `
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ASSIGNMENT_COLORS[plot.assignmentStatus!] ?? '#94a3b8'}"></span>
                  <span><strong>Assignment:</strong> ${assignLabel}</span>
                </div>
                ` : ''}
              </div>
              <a href="/plots/${plot.id}" style="display:inline-block;margin-top:8px;color:#2563eb;text-decoration:underline;font-weight:500">View details →</a>
            </div>
          `)
        )
        .addTo(map);

      marker.getElement().addEventListener("click", () => {
        setSelectedPlot(plot);
        router.push(`/plots/${plot.id}`);
      });

      markersRef.current.push(marker);
    });
  }

  return (
    <div className="relative">
      <div ref={ref} className="w-full h-[600px] rounded-xl border border-border overflow-hidden" />
      {selectedPlot && (
        <div className="absolute bottom-4 left-4 bg-surface rounded-xl border border-border shadow-lg px-4 py-3 text-sm">
          <strong>Plot {selectedPlot.plotNumber}</strong> — {selectedPlot.block}
        </div>
      )}
    </div>
  );
}
