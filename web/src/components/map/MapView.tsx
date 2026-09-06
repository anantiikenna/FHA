"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import MapDrawToolbar, { type DrawTool } from "./MapDrawToolbar";

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

export interface MapArea {
  id: string;
  name: string;
  description: string | null;
  area_type: string;
  status: string;
  geojson: { type: string; coordinates: number[][][] };
  color: string | null;
  drawn_by: string;
  assignment_id: string | null;
  plot_ids: string[];
  created_at: string;
}

const AREA_COLORS: Record<string, string> = {
  DRAFT: "#94a3b8",
  MARKED: "#3b82f6",
  IN_PROGRESS: "#f59e0b",
  INSPECTED: "#10b981",
  AWAITING_REVIEW: "#facc15",
  APPROVED: "#10b981",
  REJECTED: "#ef4444",
  REINSPECTION_REQUIRED: "#8b5cf6",
};

const AREA_COLORS_FILL: Record<string, string> = {
  DRAFT: "rgba(148,163,184,0.15)",
  MARKED: "rgba(59,130,246,0.18)",
  IN_PROGRESS: "rgba(245,158,11,0.18)",
  INSPECTED: "rgba(16,185,129,0.18)",
  AWAITING_REVIEW: "rgba(250,204,21,0.18)",
  APPROVED: "rgba(16,185,129,0.18)",
  REJECTED: "rgba(239,68,68,0.18)",
  REINSPECTION_REQUIRED: "rgba(139,92,246,0.18)",
};

const APPROVAL_COLORS: Record<string, string> = {
  APPROVED: "#10b981",
  APPROVED_WITH_CONDITIONS: "#34d399",
  PENDING: "#facc15",
  REJECTED: "#ef4444",
  NOT_REVIEWED: "#94a3b8",
};

const INSPECTION_COLORS: Record<string, string> = {
  NOT_INSPECTED: "#d1d5db",
  INSPECTION_IN_PROGRESS: "#60a5fa",
  INSPECTED: "#f97316",
  AWAITING_REVIEW: "#fbbf24",
  REINSPECTION_REQUIRED: "#a855f7",
};

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
  mapAreas = [],
  statusMode = "approval",
  userRole = "ENGINEER",
  userId = "",
  onAreasChange,
}: {
  plots?: PlotData[];
  mapAreas?: MapArea[];
  statusMode?: "approval" | "inspection" | "assignment";
  userRole?: string;
  userId?: string;
  onAreasChange?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const drawSourceRef = useRef<string>("areas-draw");
  const router = useRouter();

  const [activeTool, setActiveTool] = useState<DrawTool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState<number[][]>([]);
  const [previewLineId, setPreviewLineId] = useState<string | null>(null);
  const [previewPolyId, setPreviewPolyId] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<MapArea | null>(null);
  const [showAreaPanel, setShowAreaPanel] = useState(false);

  // Refs for drawing state to avoid stale closures
  const activeToolRef = useRef<DrawTool>(null);
  const isDrawingRef = useRef(false);
  const drawPointsRef = useRef<number[][]>([]);

  useEffect(() => { activeToolRef.current = activeTool; }, [activeTool]);
  useEffect(() => { isDrawingRef.current = isDrawing; }, [isDrawing]);
  useEffect(() => { drawPointsRef.current = drawPoints; }, [drawPoints]);

  // Initialize map
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
      addAreaLayers(map);
      updateAreaSource(map, mapAreas);
    });

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-add markers when plots/statusMode changes
  useEffect(() => {
    if (!mapRef.current) return;
    addMarkers(mapRef.current, plots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots, statusMode]);

  // Update area source when mapAreas changes
  useEffect(() => {
    if (!mapRef.current) return;
    updateAreaSource(mapRef.current, mapAreas);
    // eslint-disable-next-line react-hooks/exhausted-deps
  }, [mapAreas]);

  // Handle locate tool
  useEffect(() => {
    if (activeTool !== "locate") return;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (mapRef.current) {
          mapRef.current.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17, duration: 1500 });
        }
        setActiveTool(null);
      },
      () => { setActiveTool(null); },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, [activeTool]);

  // Add GeoJSON layers for areas
  function addAreaLayers(map: maplibregl.Map) {
    // Source for drawn areas
    map.addSource(drawSourceRef.current, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    // Fill layer
    map.addLayer({
      id: "areas-fill",
      type: "fill",
      source: drawSourceRef.current,
      paint: {
        "fill-color": ["coalesce", ["get", "fillColor"], "rgba(59,130,246,0.18)"],
        "fill-opacity": 0.7,
      },
    });

    // Border layer
    map.addLayer({
      id: "areas-border",
      type: "line",
      source: drawSourceRef.current,
      paint: {
        "line-color": ["coalesce", ["get", "borderColor"], "#3b82f6"],
        "line-width": 2.5,
      },
    });

    // Labels
    map.addLayer({
      id: "areas-label",
      type: "symbol",
      source: drawSourceRef.current,
      layout: {
        "text-field": ["get", "name"],
        "text-size": 12,
        "text-font": ["Open Sans Bold", "Arial Unicode MS Bold"],
        "text-anchor": "center",
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": "#1e293b",
        "text-halo-color": "white",
        "text-halo-width": 1.5,
      },
    });

    // Click handler for areas
    map.on("click", "areas-fill", (e) => {
      if (activeToolRef.current && activeToolRef.current !== "select") return;
      const feature = e.features?.[0];
      if (!feature) return;
      const areaId = feature.properties?.id;
      const area = mapAreas.find((a) => a.id === areaId);
      if (area) {
        setSelectedArea(area);
        setShowAreaPanel(true);
      }
    });

    // Change cursor on hover
    map.on("mouseenter", "areas-fill", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "areas-fill", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  // Update area source data
  function updateAreaSource(map: maplibregl.Map, areas: MapArea[]) {
    const source = map.getSource(drawSourceRef.current);
    if (!source) return;

    const features = areas
      .filter((a) => a.geojson?.coordinates)
      .map((a) => ({
        type: "Feature" as const,
        properties: {
          id: a.id,
          name: a.name,
          status: a.status,
          area_type: a.area_type,
          fillColor: AREA_COLORS_FILL[a.status] ?? "rgba(59,130,246,0.18)",
          borderColor: AREA_COLORS[a.status] ?? "#3b82f6",
        },
        geometry: a.geojson as GeoJSON.Polygon,
      }));

    (source as maplibregl.GeoJSONSource).setData({
      type: "FeatureCollection",
      features,
    });
  }

  // Map click handler for drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    function handleClick(e: maplibregl.MapMouseEvent) {
      const tool = activeToolRef.current;
      if (!tool || tool === "select" || tool === "locate") return;
      if (!map) return;

      const coords = [e.lngLat.lng, e.lngLat.lat];

      if (tool === "rectangle" && drawPointsRef.current.length >= 2) return;

      const newPoints = [...drawPointsRef.current, coords];
      setDrawPoints(newPoints);
      setIsDrawing(true);

      // Update preview
      updateDrawPreview(map, newPoints, tool);
    }

    map.on("click", handleClick);
    return () => { map.off("click", handleClick); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle keyboard escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") cancelDrawing();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update draw preview on map
  function updateDrawPreview(map: maplibregl.Map, points: number[][], tool: string) {
    // Remove old preview
    if (previewLineId && map.getLayer(previewLineId)) map.removeLayer(previewLineId);
    if (previewPolyId && map.getLayer(previewPolyId)) map.removeLayer(previewPolyId);
    const drawSrc = "draw-preview";
    if (map.getSource(drawSrc)) map.removeSource(drawSrc);

    if (points.length < 1) return;

    if (tool === "rectangle" && points.length === 2) {
      // Create rectangle from 2 corners
      const [lng1, lat1] = points[0];
      const [lng2, lat2] = points[1];
      const rectCoords = [[
        [lng1, lat1], [lng2, lat1], [lng2, lat2], [lng1, lat2], [lng1, lat1],
      ]];

      map.addSource(drawSrc, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "Polygon", coordinates: rectCoords },
          properties: {},
        },
      });

      const polyId = "draw-preview-poly";
      const lineId = "draw-preview-line";
      map.addLayer({ id: polyId, type: "fill", source: drawSrc, paint: { "fill-color": "#3b82f6", "fill-opacity": 0.15 } });
      map.addLayer({ id: lineId, type: "line", source: drawSrc, paint: { "line-color": "#3b82f6", "line-width": 2, "line-dasharray": [3, 2] } });
      setPreviewPolyId(polyId);
      setPreviewLineId(lineId);
    } else if (points.length >= 2) {
      // Line preview
      map.addSource(drawSrc, {
        type: "geojson",
        data: {
          type: "Feature",
          geometry: { type: "LineString", coordinates: points },
          properties: {},
        },
      });

      const lineId = "draw-preview-line";
      map.addLayer({ id: lineId, type: "line", source: drawSrc, paint: { "line-color": "#3b82f6", "line-width": 2.5, "line-dasharray": [3, 2] } });
      setPreviewLineId(lineId);

      // If 3+ points, also show polygon preview
      if (points.length >= 3) {
        const polyId = "draw-preview-poly";
        map.addLayer({
          id: polyId,
          type: "fill",
          source: drawSrc,
          paint: { "fill-color": "#3b82f6", "fill-opacity": 0.12 },
        }, lineId);
        setPreviewPolyId(polyId);

        // Close the polygon for fill
        const source = map.getSource(drawSrc) as maplibregl.GeoJSONSource;
        source?.setData({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [[...points, points[0]]] },
          properties: {},
        });
      }
    }
  }

  function cancelDrawing() {
    const map = mapRef.current;
    if (map) {
      if (previewLineId && map.getLayer(previewLineId)) map.removeLayer(previewLineId);
      if (previewPolyId && map.getLayer(previewPolyId)) map.removeLayer(previewPolyId);
      if (map.getSource("draw-preview")) map.removeSource("draw-preview");
    }
    setDrawPoints([]);
    setIsDrawing(false);
    setActiveTool(null);
    setPreviewLineId(null);
    setPreviewPolyId(null);
  }

  function undoPoint() {
    const newPoints = drawPoints.slice(0, -1);
    setDrawPoints(newPoints);
    if (mapRef.current) updateDrawPreview(mapRef.current, newPoints, activeToolRef.current ?? "polygon");
    if (newPoints.length === 0) {
      setIsDrawing(false);
      setActiveTool(null);
    }
  }

  async function saveArea(name: string) {
    const points = drawPoints;
    if (points.length < 3) return;

    // Build GeoJSON polygon
    const coords = [...points, points[0]]; // close the polygon
    const geojson = { type: "Polygon" as const, coordinates: [coords] };

    const res = await fetch("/api/v1/map-areas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        area_type: "INSPECTION_ZONE",
        geojson,
        color: null,
        metadata: { drawn_by_role: userRole },
      }),
    });

    if (res.ok) {
      cancelDrawing();
      onAreasChange?.();
    }
  }

  async function updateAreaStatus(areaId: string, status: string) {
    await fetch(`/api/v1/map-areas/${areaId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setShowAreaPanel(false);
    setSelectedArea(null);
    onAreasChange?.();
  }

  async function deleteArea(areaId: string) {
    await fetch(`/api/v1/map-areas/${areaId}`, { method: "DELETE" });
    setShowAreaPanel(false);
    setSelectedArea(null);
    onAreasChange?.();
  }

  function addMarkers(map: maplibregl.Map, data: PlotData[]) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.forEach((plot) => {
      if (plot.lat == null || plot.lng == null) return;

      let primaryColor: string;
      let secondaryColor: string;

      if (statusMode === "assignment") {
        primaryColor = plot.assignmentStatus ? (ASSIGNMENT_COLORS[plot.assignmentStatus] ?? "#94a3b8") : "#d1d5db";
        secondaryColor = INSPECTION_COLORS[plot.inspectionStatus] ?? "#94a3b8";
      } else {
        const isApproval = statusMode === "approval";
        primaryColor = isApproval ? (APPROVAL_COLORS[plot.approvalStatus] ?? "#94a3b8") : (INSPECTION_COLORS[plot.inspectionStatus] ?? "#94a3b8");
        secondaryColor = isApproval ? (INSPECTION_COLORS[plot.inspectionStatus] ?? "#94a3b8") : (APPROVAL_COLORS[plot.approvalStatus] ?? "#94a3b8");
      }

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

      const dot = document.createElement("div");
      dot.style.cssText = `width: 10px; height: 10px; border-radius: 50%; background: ${secondaryColor}; border: 1px solid white;`;
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
                ${assignLabel ? `<div style="display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ASSIGNMENT_COLORS[plot.assignmentStatus!] ?? '#94a3b8'}"></span>
                  <span><strong>Assignment:</strong> ${assignLabel}</span>
                </div>` : ''}
              </div>
              <a href="/plots/${plot.id}" style="display:inline-block;margin-top:8px;color:#2563eb;text-decoration:underline;font-weight:500">View details →</a>
            </div>
          `)
        )
        .addTo(map);

      marker.getElement().addEventListener("click", () => router.push(`/plots/${plot.id}`));
      markersRef.current.push(marker);
    });
  }

  return (
    <div className="relative">
      <div ref={ref} className="w-full h-[600px] rounded-xl border border-border overflow-hidden" />

      {/* Drawing toolbar */}
      <MapDrawToolbar
        activeTool={activeTool}
        onToolChange={(tool) => {
          cancelDrawing();
          if (tool) setActiveTool(tool);
        }}
        isDrawing={isDrawing}
        drawPoints={drawPoints}
        onUndo={undoPoint}
        onCancel={cancelDrawing}
        onFinish={() => { /* handled by save flow */ }}
        onSave={saveArea}
        areaCount={mapAreas.length}
        userRole={userRole}
      />

      {/* Selected area info panel */}
      {showAreaPanel && selectedArea && (
        <div className="absolute top-20 right-4 z-30 w-[300px] bg-white/90 dark:bg-black/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl p-5 animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-foreground text-base">{selectedArea.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedArea.area_type.replace(/_/g, " ")}</p>
            </div>
            <button onClick={() => { setShowAreaPanel(false); setSelectedArea(null); }} className="text-muted-foreground hover:text-foreground">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full" style={{ background: AREA_COLORS[selectedArea.status] ?? "#94a3b8" }} />
            <span className="text-sm font-medium">{getStatusLabel(selectedArea.status)}</span>
          </div>

          {selectedArea.description && (
            <p className="text-sm text-muted-foreground mb-4">{selectedArea.description}</p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Actions</p>
            {selectedArea.status === "MARKED" && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "IN_PROGRESS")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors shadow-md shadow-brand/20">
                Start Inspection
              </button>
            )}
            {selectedArea.status === "IN_PROGRESS" && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "INSPECTED")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-md shadow-green-600/20">
                Mark Inspected
              </button>
            )}
            {selectedArea.status === "INSPECTED" && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "AWAITING_REVIEW")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20">
                Submit for Review
              </button>
            )}
            {selectedArea.status === "AWAITING_REVIEW" && userRole === "APPROVAL_OFFICER" && (
              <div className="flex gap-2">
                <button onClick={() => updateAreaStatus(selectedArea.id, "APPROVED")} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors">
                  Approve
                </button>
                <button onClick={() => updateAreaStatus(selectedArea.id, "REJECTED")} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
                  Reject
                </button>
              </div>
            )}
            {(selectedArea.status === "MARKED" || selectedArea.status === "DRAFT") && (
              <button onClick={() => deleteArea(selectedArea.id)} className="w-full px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                Delete Area
              </button>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground/50 mt-3">
            Created {new Date(selectedArea.created_at).toLocaleDateString()}
          </p>
        </div>
      )}
    </div>
  );
}
