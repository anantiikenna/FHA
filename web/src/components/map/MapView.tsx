"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
import { createGeomanInstance } from "@geoman-io/maplibre-geoman-free";
import MapDrawToolbar, { type DrawTool } from "./MapDrawToolbar";
import MapSearch from "./MapSearch";

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

function esc(str: string) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

const DRAW_SRC = "areas-draw";
const SATELLITE_SOURCE = "eox-satellite";
const SATELLITE_LAYER = "eox-satellite-layer";

export default function MapView({
  plots = [],
  mapAreas = [],
  statusMode: initialStatusMode = "approval",
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
  const gmRef = useRef<any>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const router = useRouter();

  const [activeTool, setActiveTool] = useState<DrawTool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [statusMode, setStatusMode] = useState<"approval" | "inspection" | "assignment">(initialStatusMode);
  const [selectedArea, setSelectedArea] = useState<MapArea | null>(null);
  const [showAreaPanel, setShowAreaPanel] = useState(false);
  const [isSatellite, setIsSatellite] = useState(false);
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.95);
  const [pendingFeature, setPendingFeature] = useState<{ feature: any; geojson: any } | null>(null);
  const [showNameModal, setShowNameModal] = useState(false);

  const statusModeRef = useRef<"approval" | "inspection" | "assignment">(initialStatusMode);
  const mapAreasRef = useRef<MapArea[]>(mapAreas);
  const activeToolRef = useRef<DrawTool>(null);
  const mapLoadedRef = useRef(false);

  useEffect(() => {
    function handleModeChange(e: Event) {
      const mode = (e as CustomEvent).detail as "approval" | "inspection" | "assignment";
      if (mode) {
        setStatusMode(mode);
        statusModeRef.current = mode;
        if (mapRef.current) addMarkers(mapRef.current, plots);
      }
    }
    window.addEventListener("map:statusMode", handleModeChange);
    return () => window.removeEventListener("map:statusMode", handleModeChange);
  }, [plots]);

  useEffect(() => { mapAreasRef.current = mapAreas; }, [mapAreas]);

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

    map.on("load", async () => {
      map.addSource(SATELLITE_SOURCE, {
        type: "raster",
        tiles: [
          "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg",
        ],
        tileSize: 256,
        attribution: "Sentinel-2 cloudless by EOX IT Services (CC BY 4.0)",
        maxzoom: 19,
      });

      mapLoadedRef.current = true;
      addAreaLayers(map);
      updateAreaSource(map, mapAreasRef.current);
      addMarkers(map, plots);

      try {
        const gm = await createGeomanInstance(map, {});
        await gm.init();
        gmRef.current = gm;

        map.dragPan.enable();
        map.dragRotate.disable();

        map.on("gm:create" as any, (e: any) => {
          const feature = e.feature;
          if (feature) {
            const geoJson = feature.getGeoJson();
            setPendingFeature({ feature, geojson: geoJson });
            setIsDrawing(false);
            setActiveTool(null);
            activeToolRef.current = null;
            map.getCanvas().style.cursor = "";
            map.dragPan.enable();
            map.dragRotate.disable();
            setShowNameModal(true);
          }
        });
      } catch (err) {
        console.error("Failed to initialize Geoman:", err);
      }
    });

    return () => {
      gmRef.current?.destroy();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    addMarkers(mapRef.current, plots);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plots, statusMode]);

  useEffect(() => {
    if (!mapRef.current) return;
    updateAreaSource(mapRef.current, mapAreas);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapAreas]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoadedRef.current) return;

    const layerExists = map.getLayer(SATELLITE_LAYER);

    if (isSatellite) {
      if (!layerExists) {
        map.addLayer({
          id: SATELLITE_LAYER,
          type: "raster",
          source: SATELLITE_SOURCE,
          paint: { "raster-opacity": satelliteOpacity },
        }, "areas-fill");
      } else {
        map.setPaintProperty(SATELLITE_LAYER, "raster-opacity", satelliteOpacity);
      }
      map.setLayoutProperty("osm", "visibility", "none");
    } else {
      if (layerExists) {
        map.removeLayer(SATELLITE_LAYER);
      }
      map.setLayoutProperty("osm", "visibility", "visible");
    }
  }, [isSatellite, satelliteOpacity]);

  function restoreMapDrag() {
    const map = mapRef.current;
    if (map) {
      map.dragPan.enable();
      map.dragRotate.disable();
    }
  }

  function handleToolChange(tool: DrawTool) {
    const gm = gmRef.current;
    if (!gm) return;

    if (tool === "polygon" || tool === "rectangle") {
      gm.disableDraw();
      gm.enableDraw(tool);
      setActiveTool(tool);
      activeToolRef.current = tool;
      setIsDrawing(true);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "crosshair";
    } else if (tool === "select") {
      gm.disableDraw();
      restoreMapDrag();
      setActiveTool(tool);
      activeToolRef.current = tool;
      setIsDrawing(false);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
    } else if (tool === "locate") {
      gm.disableDraw();
      restoreMapDrag();
      setActiveTool(null);
      activeToolRef.current = null;
      setIsDrawing(false);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17, duration: 1500 });
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
    } else {
      gm.disableDraw();
      restoreMapDrag();
      setActiveTool(null);
      activeToolRef.current = null;
      setIsDrawing(false);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
    }
  }

  function cancelDrawing() {
    gmRef.current?.disableDraw();
    restoreMapDrag();
    setActiveTool(null);
    activeToolRef.current = null;
    setIsDrawing(false);
    setPendingFeature(null);
    setShowNameModal(false);
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
  }

  async function saveArea(name: string) {
    if (!pendingFeature) return;

    const geojson = pendingFeature.geojson.geometry || pendingFeature.geojson;

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
      try { await pendingFeature.feature.delete(); } catch {}
      setPendingFeature(null);
      setShowNameModal(false);
      restoreMapDrag();
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

  function addAreaLayers(map: maplibregl.Map) {
    if (map.getSource(DRAW_SRC)) return;

    map.addSource(DRAW_SRC, {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });

    map.addLayer({
      id: "areas-fill",
      type: "fill",
      source: DRAW_SRC,
      paint: {
        "fill-color": ["coalesce", ["get", "fillColor"], "rgba(59,130,246,0.18)"],
        "fill-opacity": 0.7,
      },
    });

    map.addLayer({
      id: "areas-border",
      type: "line",
      source: DRAW_SRC,
      paint: {
        "line-color": ["coalesce", ["get", "borderColor"], "#3b82f6"],
        "line-width": 2.5,
      },
    });

    map.addLayer({
      id: "areas-label",
      type: "symbol",
      source: DRAW_SRC,
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

    map.on("click", "areas-fill", (e) => {
      const tool = activeToolRef.current;
      if (tool && tool !== "select") return;
      const feature = e.features?.[0];
      if (!feature) return;
      const areaId = feature.properties?.id;
      const area = mapAreasRef.current.find((a) => a.id === areaId);
      if (area) {
        setSelectedArea(area);
        setShowAreaPanel(true);
      }
    });

    map.on("mouseenter", "areas-fill", () => {
      if (!activeToolRef.current || activeToolRef.current === "select") {
        map.getCanvas().style.cursor = "pointer";
      }
    });
    map.on("mouseleave", "areas-fill", () => {
      if (activeToolRef.current === "polygon" || activeToolRef.current === "rectangle") {
        map.getCanvas().style.cursor = "crosshair";
      } else {
        map.getCanvas().style.cursor = "";
      }
    });
  }

  function updateAreaSource(map: maplibregl.Map, areas: MapArea[]) {
    const source = map.getSource(DRAW_SRC);
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

  function addMarkers(map: maplibregl.Map, data: PlotData[]) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    data.forEach((plot) => {
      if (plot.lat == null || plot.lng == null) return;

      let primaryColor: string;
      let secondaryColor: string;

      if (statusModeRef.current === "assignment") {
        primaryColor = plot.assignmentStatus ? (ASSIGNMENT_COLORS[plot.assignmentStatus] ?? "#94a3b8") : "#d1d5db";
        secondaryColor = INSPECTION_COLORS[plot.inspectionStatus] ?? "#94a3b8";
      } else {
        const isApproval = statusModeRef.current === "approval";
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
              <strong style="font-size:14px">Plot ${esc(plot.plotNumber)}</strong><br/>
              <span style="color:#64748b">Block ${esc(plot.block)} — ${esc(plot.estate)}</span>
              <div style="margin-top:8px;padding:6px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${INSPECTION_COLORS[plot.inspectionStatus] ?? '#94a3b8'}"></span>
                  <span><strong>Inspection:</strong> ${esc(inspLabel)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px${assignLabel ? ';margin-bottom:4px' : ''}">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${APPROVAL_COLORS[plot.approvalStatus] ?? '#94a3b8'}"></span>
                  <span><strong>Approval:</strong> ${esc(approvLabel)}</span>
                </div>
                ${assignLabel ? `<div style="display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${ASSIGNMENT_COLORS[plot.assignmentStatus!] ?? '#94a3b8'}"></span>
                  <span><strong>Assignment:</strong> ${esc(assignLabel)}</span>
                </div>` : ''}
              </div>
              <a href="/plots/${esc(plot.id)}" style="display:inline-block;margin-top:8px;color:#2563eb;text-decoration:underline;font-weight:500">View details →</a>
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

      {/* All overlays above the map */}
      <div className="absolute inset-0 z-40 pointer-events-none">
        <div className="pointer-events-auto">
          <MapSearch
            onSearch={(lat, lng) => {
              mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });
            }}
          />
        </div>

        <div className="pointer-events-auto absolute bottom-4 left-4">
          <div className="flex items-center gap-0 rounded-xl border border-slate-700/40 shadow-lg overflow-hidden transition-all duration-300 bg-slate-800/80 backdrop-blur-md">
            <button
              onClick={() => setIsSatellite(!isSatellite)}
              title={isSatellite ? "Switch to street map" : "Switch to satellite view"}
              className={`px-4 py-2.5 text-sm font-semibold flex items-center gap-2.5 transition-all duration-200 ${isSatellite ? 'text-white hover:bg-white/10' : 'text-white/80 hover:text-white hover:bg-white/10'}`}
            >
              {isSatellite ? (
                <svg className="w-5 h-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
                </svg>
              ) : (
                <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
              )}
              <span>{isSatellite ? "Street" : "Satellite"}</span>
            </button>

            {isSatellite && (
              <div className="flex items-center gap-2 px-3 border-l border-slate-600/50">
                <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6z" />
                </svg>
                <input
                  type="range"
                  min="0.3"
                  max="1"
                  step="0.05"
                  value={satelliteOpacity}
                  onChange={(e) => setSatelliteOpacity(parseFloat(e.target.value))}
                  className="w-20 h-1 accent-emerald-400 cursor-pointer"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <MapDrawToolbar
        activeTool={activeTool}
        onToolChange={handleToolChange}
        isDrawing={isDrawing}
        drawPoints={[]}
        onUndo={() => {}}
        onCancel={cancelDrawing}
        onFinish={() => {}}
        onSave={saveArea}
        areaCount={mapAreas.length}
        userRole={userRole}
      />

      {showNameModal && (
        <NameInputModal
          onSave={saveArea}
          onCancel={cancelDrawing}
        />
      )}

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

function NameInputModal({ onSave, onCancel }: { onSave: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-border p-6 w-[360px] animate-in zoom-in-95 fade-in duration-200">
        <h3 className="text-lg font-bold text-foreground mb-1">Name This Area</h3>
        <p className="text-sm text-muted-foreground mb-4">Give your inspection area a descriptive name.</p>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && name.trim() && onSave(name.trim())}
          placeholder="e.g. Mile 2 Axis — Section A"
          className="w-full px-4 py-3 rounded-xl border border-border bg-surface text-foreground text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand/40 mb-4"
          autoFocus
        />
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => name.trim() && onSave(name.trim())}
            disabled={!name.trim()}
            className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors disabled:opacity-40 shadow-md shadow-brand/20"
          >
            Save Area
          </button>
        </div>
      </div>
    </div>
  );
}
