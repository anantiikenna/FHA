"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
import { createGeomanInstance, type Geoman } from "@geoman-io/maplibre-geoman-free";
import MapDrawToolbar, { type DrawTool } from "./MapDrawToolbar";
import MapSearch from "./MapSearch";
import { toPolygonGeometry, plotIdsInside, type PolygonGeometry } from "@/lib/geo";

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
  parent_area_id?: string | null;
  plot_ids: string[];
  created_at: string;
}

interface ZoneChild {
  id: string;
  name: string;
  status: string;
  drawn_by: string;
  author_name: string | null;
  created_at: string;
}

interface ZoneAssignment {
  assignment_id: string;
  assignment_number: string;
  status: string;
  assigned_to: string;
  officer_name: string | null;
  created_at: string;
}

interface EngineerOption {
  id: string;
  display_name: string;
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
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow safe #hex colors in setHTML ΓÇö never interpolate raw status keys. */
function safeColor(c: string | undefined): string {
  return typeof c === "string" && /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#94a3b8";
}

const DRAW_SRC = "areas-draw";
const SATELLITE_SOURCE = "satellite";
const SATELLITE_LAYER = "satellite-layer";

export default function MapView({
  plots = [],
  mapAreas = [],
  statusMode: initialStatusMode = "approval",
  userRole = "ENGINEER",
  userId = "",
  assignedAreaIds = [],
  onAreasChange,
}: {
  plots?: PlotData[];
  mapAreas?: MapArea[];
  statusMode?: "approval" | "inspection" | "assignment";
  userRole?: string;
  userId?: string;
  assignedAreaIds?: string[];
  onAreasChange?: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const gmRef = useRef<Geoman | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const router = useRouter();

  const [activeTool, setActiveTool] = useState<DrawTool>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [statusMode, setStatusMode] = useState<"approval" | "inspection" | "assignment">(initialStatusMode);
  const [selectedArea, setSelectedArea] = useState<MapArea | null>(null);
  const [showAreaPanel, setShowAreaPanel] = useState(false);
  const [showAreasList, setShowAreasList] = useState(false);
  const [pickerPlots, setPickerPlots] = useState<string[] | null>(null);
  const [isSatellite, setIsSatellite] = useState(false);
  const [satelliteOpacity, setSatelliteOpacity] = useState(0.95);

  const [showNameModal, setShowNameModal] = useState(false);
  const [drawPoints, setDrawPoints] = useState<number[][]>([]);
  const [zoneChildren, setZoneChildren] = useState<ZoneChild[]>([]);
  const [zoneAssignments, setZoneAssignments] = useState<ZoneAssignment[]>([]);
  const [listsZoneId, setListsZoneId] = useState<string | null>(null);
  const [engineerOptions, setEngineerOptions] = useState<EngineerOption[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");

  const canUpdateArea =
    ["ADMIN", "SUPERVISOR", "GIS_OFFICER"].includes(userRole) ||
    (!!selectedArea && !!userId && selectedArea.drawn_by === userId);
  const canApproveArea = ["APPROVAL_OFFICER", "SUPERVISOR", "ADMIN"].includes(userRole);
  const canDeleteArea =
    ["ADMIN", "SUPERVISOR", "GIS_OFFICER"].includes(userRole) ||
    (!!selectedArea && !!userId && selectedArea.drawn_by === userId);
  const canCreateInspection = ["ADMIN", "SUPERVISOR", "ENGINEER"].includes(userRole);

  const isZoneAdmin = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"].includes(userRole);
  const isChildArea = selectedArea?.area_type === "INSPECTED_AREA";
  const isZoneArea = selectedArea?.area_type === "INSPECTION_ZONE";
  const isOwnArea = !!selectedArea && !!userId && selectedArea.drawn_by === userId;
  const assignedToMe = !!selectedArea && assignedAreaIds.includes(selectedArea.id);
  const childOwnStatuses = ["DRAFT", "IN_PROGRESS", "REINSPECTION_REQUIRED"];

  const statusModeRef = useRef<"approval" | "inspection" | "assignment">(initialStatusMode);
  const mapAreasRef = useRef<MapArea[]>(mapAreas);
  const activeToolRef = useRef<DrawTool>(null);
  const mapLoadedRef = useRef(false);
  const drawPointsRef = useRef<number[][]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingFeatureRef = useRef<{ feature: any; geojson: any } | null>(null);

  function syncDrawPoints(points: number[][]) {
    drawPointsRef.current = points;
    setDrawPoints(points);
  }

  function readDrawPointsFromGeoman(tool: DrawTool): number[][] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gm = gmRef.current as any;
    if (!gm || !tool) return [];
    try {
      if (tool === "polygon") {
        const inst = gm.actionInstances?.["draw__polygon"];
        const pts = inst?.lineDrawer?.shapeLngLats;
        return Array.isArray(pts) ? pts.map((p: number[]) => [...p]) : [];
      }
      if (tool === "rectangle") {
        const inst = gm.actionInstances?.["draw__rectangle"];
        if (inst?.startLngLat) return [[...inst.startLngLat]];
      }
    } catch {
      /* ignore */
    }
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function openNameModalFor(feature: any, fallbackGeom: unknown = null) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let geoJson: any = fallbackGeom ?? null;
    if (!geoJson && feature) {
      try {
        geoJson = feature.getGeoJson();
      } catch {
        geoJson = null;
      }
    }
    if (!geoJson) return;
    pendingFeatureRef.current = { feature, geojson: geoJson };

    syncDrawPoints([]);
    setIsDrawing(false);
    setActiveTool(null);
    activeToolRef.current = null;
    try {
      await gmRef.current?.disableDraw();
    } catch {
      /* ignore */
    }
    const map = mapRef.current;
    if (map) {
      map.getCanvas().style.cursor = "";
      map.dragPan.enable();
      map.dragRotate.disable();
    }
    setShowNameModal(true);
  }

  async function finishDrawing() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gm = gmRef.current as any;
    const tool = activeToolRef.current;
    if (!gm || !tool) return;

    let pts: number[][] = [];
    try {
      if (tool === "polygon") {
        const inst = gm.actionInstances?.["draw__polygon"];
        const ld = inst?.lineDrawer;
        if (!ld || !Array.isArray(ld.shapeLngLats) || ld.shapeLngLats.length < 3) return;
        pts = ld.shapeLngLats.map((p: number[]) => [p[0], p[1]]);
        const data = ld.getMarkerClickEventData(0);
        await inst.polygonFinished(data);
      } else if (tool === "rectangle") {
        const inst = gm.actionInstances?.["draw__rectangle"];
        if (!inst?.startLngLat) return;
        const marker = gm.markerPointer?.marker;
        const end = marker ? marker.getLngLat().toArray() : [...inst.startLngLat];
        const start = inst.startLngLat;
        pts = [
          [start[0], start[1]],
          [end[0], start[1]],
          [end[0], end[1]],
          [start[0], end[1]],
        ];
        await inst.finishShape(end);
      }
    } catch (err) {
      console.error("Failed to finish drawing:", err);
    }

    const openFallback = () => {
      if (pendingFeatureRef.current || pts.length < 3) return;
      const geom = toPolygonGeometry({ type: "LineString", coordinates: pts });
      if (geom) openNameModalFor(null, geom);
    };
    openFallback();
    if (!pendingFeatureRef.current) setTimeout(openFallback, 250);
  }

  function undoDrawPoint() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gm = gmRef.current as any;
    const tool = activeToolRef.current;
    if (!gm || tool !== "polygon") return;

    try {
      const inst = gm.actionInstances?.["draw__polygon"];
      const ld = inst?.lineDrawer;
      if (!ld || !Array.isArray(ld.shapeLngLats) || ld.shapeLngLats.length === 0) return;

      const pts = ld.shapeLngLats;
      pts.pop();

      // Remove the last vertex marker from feature markers
      if (ld.featureData?.markers?.size) {
        const keys = Array.from(ld.featureData.markers.keys()) as string[];
        const lastKey = keys[keys.length - 1];
        if (lastKey != null) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const md: any = ld.featureData.markers.get(lastKey);
          try {
            md?.instance?.remove?.();
          } catch {
            /* ignore */
          }
          ld.featureData.markers.delete(lastKey);
        }
      }

      if (pts.length === 0) {
        // Fully cleared — end the temp shape cleanly
        ld.endShape?.();
        syncDrawPoints([]);
        return;
      }

      ld.updateFeatureSource?.();
      syncDrawPoints(pts.map((p: number[]) => [...p]));
    } catch (err) {
      console.error("Undo failed:", err);
    }
  }

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      // Map may have been cleaned up (StrictMode/HMR teardown) — never touch a removed map.
      if (mapRef.current !== map) return;

      map.addSource(SATELLITE_SOURCE, {
        type: "raster",
        tiles: [
          "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        ],
        tileSize: 256,
        attribution: "Esri, Maxar, Earthstar Geographics",
        maxzoom: 19,
      });

      mapLoadedRef.current = true;
      addAreaLayers(map);
      updateAreaSource(map, mapAreasRef.current);
      addMarkers(map, plots);

      try {
        const gm = await createGeomanInstance(map, {});
        if (mapRef.current !== map) {
          gm.destroy();
          return;
        }
        gmRef.current = gm;

        map.dragPan.enable();
        map.dragRotate.disable();

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("gm:create" as any, (e: any) => {
          try {
            openNameModalFor(e?.featureData || e?.feature);
          } catch (err) {
            console.error("gm:create handler failed:", err);
          }
        });

        // Track in-progress draw points (fired on start/update/finish of line drawer)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("_gm:draw" as any, (e: { action?: string }) => {
          try {
            if (!e || (e.action !== "start" && e.action !== "update" && e.action !== "finish")) return;
            const tool = activeToolRef.current;
            if (tool === "polygon" || tool === "rectangle") {
              syncDrawPoints(readDrawPointsFromGeoman(tool));
            }
          } catch {
            /* ignore */
          }
        });

        // Fallback: some builds forward draw events without the _gm prefix
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        map.on("gm:draw" as any, (e: { action?: string }) => {
          try {
            if (!e || (e.action !== "start" && e.action !== "update" && e.action !== "finish")) return;
            const tool = activeToolRef.current;
            if (tool === "polygon" || tool === "rectangle") {
              syncDrawPoints(readDrawPointsFromGeoman(tool));
            }
          } catch {
            /* ignore */
          }
        });
      } catch (err) {
        if (mapRef.current === map) {
          console.error("Failed to initialize Geoman:", err);
        }
      }
    });

    return () => {
      gmRef.current?.destroy();
      gmRef.current = null;
      map.remove();
      mapRef.current = null;
      mapLoadedRef.current = false;
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

  async function handleToolChange(tool: DrawTool) {
    const gm = gmRef.current;

    // My Location only needs the browser geolocation API — it works even if Geoman is unavailable.
    if (tool === "locate") {
      await gm?.disableDraw();
      restoreMapDrag();
      setActiveTool(null);
      activeToolRef.current = null;
      setIsDrawing(false);
      syncDrawPoints([]);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            mapRef.current?.flyTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 17, duration: 1500 });
          },
          (err) => {
            console.warn("[Map] My Location failed:", err?.code, err?.message);
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }
      return;
    }

    if (!gm) {
      console.warn("[Map] tool ignored - map not ready:", tool);
      return;
    }

    if (tool === "polygon" || tool === "rectangle") {
      await gm.disableDraw();
      await gm.enableDraw(tool);
      setActiveTool(tool);
      activeToolRef.current = tool;
      setIsDrawing(true);
      syncDrawPoints([]);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "crosshair";
    } else if (tool === "select") {
      await gm.disableDraw();
      restoreMapDrag();
      setActiveTool(tool);
      activeToolRef.current = tool;
      setIsDrawing(false);
      syncDrawPoints([]);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
    } else {
      await gm.disableDraw();
      restoreMapDrag();
      setActiveTool(null);
      activeToolRef.current = null;
      setIsDrawing(false);
      syncDrawPoints([]);
      if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
    }
  }

  async function cancelDrawing() {
    const pending = pendingFeatureRef.current;
    if (pending?.feature) {
      try {
        pending.feature.delete?.();
      } catch {
        /* ignore */
      }
    }
    await gmRef.current?.disableDraw();
    restoreMapDrag();
    setActiveTool(null);
    activeToolRef.current = null;
    setIsDrawing(false);

    pendingFeatureRef.current = null;
    setShowNameModal(false);
    syncDrawPoints([]);
    if (mapRef.current) mapRef.current.getCanvas().style.cursor = "";
  }

  async function saveArea(name: string) {
    const pending = pendingFeatureRef.current;
    if (!pending) return;

    try {
      let geojson = pending.geojson;
      if (!geojson && pending.feature) {
        try {
          geojson = pending.feature.getGeoJson();
        } catch {
          geojson = null;
        }
      }
      if (!geojson) {
        window.alert("Could not read the drawn shape. Please try again.");
        return;
      }
      const polygon = toPolygonGeometry(geojson);
      if (!polygon) {
        window.alert("Could not read the drawn shape. Please draw a polygon with at least 3 points.");
        return;
      }
      const plot_ids = plotIdsInside(polygon, plots);

      const res = await fetch("/api/v1/map-areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          area_type: "INSPECTION_ZONE",
          geojson: polygon,
          color: null,
          plot_ids,
          metadata: { drawn_by_role: userRole },
        }),
      });
      const json = await res.json().catch(() => null);

      if (res.ok) {
        try { await pending.feature?.delete?.(); } catch {}

        pendingFeatureRef.current = null;
        setShowNameModal(false);
        restoreMapDrag();
        onAreasChange?.();
      } else {
        window.alert(json?.error?.message ?? "Failed to save area — try again.");
      }
    } catch {
      window.alert("Network error — try again.");
    }
  }

  async function updateAreaStatus(areaId: string, status: string) {
    try {
      const res = await fetch(`/api/v1/map-areas/${areaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        window.alert(json?.error?.message ?? "Failed to update area status.");
        return;
      }
      setShowAreaPanel(false);
      setSelectedArea(null);
      setPickerPlots(null);
      onAreasChange?.();
    } catch {
      window.alert("Network error ΓÇö try again.");
    }
  }

  async function deleteArea(areaId: string) {
    try {
      const res = await fetch(`/api/v1/map-areas/${areaId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        window.alert(json?.error?.message ?? "Failed to delete area.");
        return;
      }
      setShowAreaPanel(false);
      setSelectedArea(null);
      setPickerPlots(null);
      onAreasChange?.();
    } catch {
      window.alert("Network error ΓÇö try again.");
    }
  }

  function areaCenter(area: MapArea): [number, number] | null {
    const ring = area.geojson?.coordinates?.[0];
    if (!ring?.length) return null;
    let lng = 0;
    let lat = 0;
    for (const [x, y] of ring) {
      lng += x;
      lat += y;
    }
    return [lng / ring.length, lat / ring.length];
  }

  function openAreaFromList(area: MapArea) {
    setSelectedArea(area);
    setShowAreaPanel(true);
    setPickerPlots(null);
    const center = areaCenter(area);
    if (center) mapRef.current?.flyTo({ center, zoom: 16, duration: 1200 });
  }

  async function goToInspection(area: MapArea, plotId: string) {
    if (canUpdateArea) {
      try {
        await fetch(`/api/v1/map-areas/${area.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "IN_PROGRESS" }),
        });
      } catch { /* navigate regardless */ }
    }
    router.push(`/inspections/new?plotId=${encodeURIComponent(plotId)}&areaId=${encodeURIComponent(area.id)}`);
  }

  async function startInspectionFromArea(area: MapArea) {
    let ids = (area.plot_ids ?? []).filter(Boolean);
    if (ids.length === 0) {
      ids = plotIdsInside({ type: "Polygon", coordinates: area.geojson.coordinates }, plots);
    }
    if (ids.length === 0) {
      window.alert(
        "No plots are inside this saved area yet. Redraw the area to detect its plots, or start the inspection from a plot page."
      );
      return;
    }
    if (ids.length > 1) {
      setPickerPlots(ids);
      return;
    }
    await goToInspection(area, ids[0]);
  }

  const refreshZoneLists = useCallback(async (zoneId: string) => {
    try {
      const [childrenRes, assignRes] = await Promise.all([
        fetch(`/api/v1/map-areas/${zoneId}/children`),
        fetch(`/api/v1/map-areas/${zoneId}/assign`),
      ]);
      const childrenJson = await childrenRes.json().catch(() => null);
      const assignJson = await assignRes.json().catch(() => null);
      setZoneChildren(childrenJson?.success && Array.isArray(childrenJson.data) ? childrenJson.data : []);
      setZoneAssignments(assignJson?.success && Array.isArray(assignJson.data) ? assignJson.data : []);
      setListsZoneId(zoneId);
    } catch {
      setZoneChildren([]);
      setZoneAssignments([]);
      setListsZoneId(zoneId);
    }
  }, []);

  async function assignOfficer(zoneId: string, officerId: string) {
    if (!officerId || assigning) return;
    setAssigning(true);
    try {
      const res = await fetch(`/api/v1/map-areas/${zoneId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to: officerId }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        window.alert(json?.error?.message ?? "Failed to assign officer.");
        return;
      }
      await refreshZoneLists(zoneId);
      onAreasChange?.();
    } catch {
      window.alert("Network error — try again.");
    } finally {
      setAssigning(false);
    }
  }

  const selectedZoneId = showAreaPanel && isZoneArea ? selectedArea?.id ?? null : null;

  useEffect(() => {
    if (!selectedZoneId) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/v1/map-areas/${selectedZoneId}/children`),
      fetch(`/api/v1/map-areas/${selectedZoneId}/assign`),
    ])
      .then(([childrenRes, assignRes]) =>
        Promise.all([childrenRes.json().catch(() => null), assignRes.json().catch(() => null)])
      )
      .then(([childrenJson, assignJson]) => {
        if (cancelled) return;
        setZoneChildren(childrenJson?.success && Array.isArray(childrenJson.data) ? childrenJson.data : []);
        setZoneAssignments(assignJson?.success && Array.isArray(assignJson.data) ? assignJson.data : []);
        setListsZoneId(selectedZoneId);
      })
      .catch(() => {
        if (cancelled) return;
        setZoneChildren([]);
        setZoneAssignments([]);
        setListsZoneId(selectedZoneId);
      });
    return () => { cancelled = true; };
  }, [selectedZoneId]);

  useEffect(() => {
    if (!isZoneAdmin || engineerOptions !== null) return;
    let cancelled = false;
    fetch("/api/v1/admin/users")
      .then((r) => r.json())
      .then((j) => {
        if (cancelled) return;
        const items: EngineerOption[] = Array.isArray(j?.data?.items)
          ? (j.data.items as Array<{ id: string; display_name: string; role: string; is_active: boolean }>)
              .filter((u) => u.role === "ENGINEER" && u.is_active)
              .map((u) => ({ id: u.id, display_name: u.display_name }))
          : [];
        setEngineerOptions(items);
      })
      .catch(() => { if (!cancelled) setEngineerOptions([]); });
    return () => { cancelled = true; };
  }, [isZoneAdmin, engineerOptions]);

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
        setPickerPlots(null);
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
      .map((a) => ({ area: a, geom: toPolygonGeometry(a.geojson) }))
      .filter((a): a is { area: MapArea; geom: PolygonGeometry } => a.geom !== null)
      .map(({ area, geom }) => ({
        type: "Feature" as const,
        properties: {
          id: area.id,
          name: area.name,
          status: area.status,
          area_type: area.area_type,
          fillColor: AREA_COLORS_FILL[area.status] ?? "rgba(59,130,246,0.18)",
          borderColor: AREA_COLORS[area.status] ?? "#3b82f6",
        },
        geometry: geom as GeoJSON.Polygon,
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
              <span style="color:#64748b">Block ${esc(plot.block)} ΓÇö ${esc(plot.estate)}</span>
              <div style="margin-top:8px;padding:6px;border-radius:6px;background:#f8fafc;border:1px solid #e2e8f0">
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${safeColor(INSPECTION_COLORS[plot.inspectionStatus])}"></span>
                  <span><strong>Inspection:</strong> ${esc(inspLabel)}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px${assignLabel ? ';margin-bottom:4px' : ''}">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${safeColor(APPROVAL_COLORS[plot.approvalStatus])}"></span>
                  <span><strong>Approval:</strong> ${esc(approvLabel)}</span>
                </div>
                ${assignLabel ? `<div style="display:flex;align-items:center;gap:6px">
                  <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${safeColor(ASSIGNMENT_COLORS[plot.assignmentStatus!])}"></span>
                  <span><strong>Assignment:</strong> ${esc(assignLabel)}</span>
                </div>` : ''}
              </div>
              <a href="/plots/${esc(plot.id)}" style="display:inline-block;margin-top:8px;color:#2563eb;text-decoration:underline;font-weight:500">View details ΓåÆ</a>
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
      <div ref={ref} className="w-full h-150 rounded-xl border border-border overflow-hidden" />

      <div className="absolute inset-0 z-40 pointer-events-none">
        <MapSearch
          onSearch={(lat, lng) => {
            mapRef.current?.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });
          }}
        />

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
        {/* Saved areas list */}
        <div className="pointer-events-auto absolute bottom-4 right-4 z-30">
          <button
            onClick={() => setShowAreasList(!showAreasList)}
            className="px-4 py-2.5 rounded-xl border border-slate-700/40 shadow-lg bg-slate-800/80 backdrop-blur-md text-sm font-semibold text-white/90 hover:text-white hover:bg-slate-700/80 transition-all duration-200"
          >
            Saved Areas ({mapAreas.length})
          </button>
          {showAreasList && (
            <div className="absolute bottom-12 right-0 w-80 max-h-80 overflow-y-auto rounded-xl bg-white/95 dark:bg-black/85 backdrop-blur-xl border border-white/40 shadow-2xl p-2 space-y-1">
              {mapAreas.length === 0 && (
                <p className="text-xs text-muted-foreground p-3">
                  No saved areas yet. Draw a shape with the tools above and save it to see it here.
                </p>
              )}
              {mapAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => { setShowAreasList(false); openAreaFromList(area); }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10 text-left transition-colors"
                >
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: AREA_COLORS[area.status] ?? "#94a3b8" }} />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium truncate">{area.name}</span>
                    <span className="block text-[11px] text-muted-foreground">
                      {area.area_type === "INSPECTED_AREA" ? "Field area" : "Zone"} · {getStatusLabel(area.status)}
                      {(area.plot_ids?.length ?? 0) > 0 && ` · ${area.plot_ids.length} plot${area.plot_ids.length > 1 ? "s" : ""}`}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Draw toolbar inside the pointer-events-none overlay */}
        <MapDrawToolbar
          activeTool={activeTool}
          onToolChange={handleToolChange}
          isDrawing={isDrawing}
          drawPoints={drawPoints}
          onUndo={undoDrawPoint}
          onCancel={cancelDrawing}
          onFinish={finishDrawing}
          onSave={saveArea}
          areaCount={mapAreas.length}
          userRole={userRole}
        />
      </div>
      {/* End of pointer-events-none overlay */}

      {showNameModal && (
        <NameInputModal
          onSave={saveArea}
          onCancel={cancelDrawing}
        />
      )}

      {showAreaPanel && selectedArea && (
        <div className="absolute top-20 right-4 z-50 w-75 bg-white/90 dark:bg-black/70 backdrop-blur-xl rounded-2xl border border-white/40 shadow-2xl p-5 animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-bold text-foreground text-base">{selectedArea.name}</h3>
              <p className="text-xs text-muted-foreground mt-0.5">{selectedArea.area_type.replace(/_/g, " ")}</p>
            </div>
            <button onClick={() => { setShowAreaPanel(false); setSelectedArea(null); setPickerPlots(null); }} className="text-muted-foreground hover:text-foreground">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 mb-4">
            <span className="w-3 h-3 rounded-full" style={{ background: AREA_COLORS[selectedArea.status] ?? "#94a3b8" }} />
            <span className="text-sm font-medium">{getStatusLabel(selectedArea.status)}</span>
            {assignedToMe && (
              <span className="ml-auto inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 text-[10px] font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
                Assigned to you
              </span>
            )}
          </div>

          {selectedArea.description && (
            <p className="text-sm text-muted-foreground mb-4">{selectedArea.description}</p>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase">Actions</p>
            {pickerPlots && pickerPlots.length > 1 && (
              <div className="space-y-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-border p-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Choose plot ({pickerPlots.length})</p>
                {pickerPlots.map((pid) => {
                  const p = plots.find((x) => x.id === pid);
                  return (
                    <button
                      key={pid}
                      onClick={() => { setPickerPlots(null); void goToInspection(selectedArea, pid); }}
                      className="w-full px-3 py-2 rounded-lg text-sm font-medium bg-brand/10 text-brand hover:bg-brand/20 transition-colors text-left"
                    >
                      Plot {p?.plotNumber ?? "—"}
                    </button>
                  );
                })}
                <button onClick={() => setPickerPlots(null)} className="w-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground">
                  Cancel
                </button>
              </div>
            )}
            {!isChildArea && selectedArea.status === "MARKED" && canCreateInspection && (
              <button onClick={() => void startInspectionFromArea(selectedArea)} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors shadow-md shadow-brand/20">
                Start Inspection
              </button>
            )}
            {isChildArea && isOwnArea && canCreateInspection && childOwnStatuses.includes(selectedArea.status) && (
              <button onClick={() => void startInspectionFromArea(selectedArea)} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors shadow-md shadow-brand/20">
                Start Inspection
              </button>
            )}
            {isChildArea && isOwnArea && childOwnStatuses.includes(selectedArea.status) && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "AWAITING_REVIEW")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20">
                Submit for Approval
              </button>
            )}
            {!isChildArea && canUpdateArea && !canCreateInspection && selectedArea.status === "MARKED" && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "IN_PROGRESS")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors shadow-md shadow-brand/20">
                Mark In Progress
              </button>
            )}
            {!isChildArea && canUpdateArea && selectedArea.status === "IN_PROGRESS" && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "INSPECTED")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-md shadow-green-600/20">
                Mark Inspected
              </button>
            )}
            {!isChildArea && canUpdateArea && selectedArea.status === "INSPECTED" && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "AWAITING_REVIEW")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20">
                Submit for Review
              </button>
            )}
            {selectedArea.status === "AWAITING_REVIEW" && canApproveArea && (
              <div className="flex gap-2">
                <button onClick={() => updateAreaStatus(selectedArea.id, "APPROVED")} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors">
                  Approve
                </button>
                <button onClick={() => updateAreaStatus(selectedArea.id, "REJECTED")} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors">
                  Reject
                </button>
              </div>
            )}
            {selectedArea.status === "REJECTED" && canApproveArea && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "REINSPECTION_REQUIRED")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-purple-600 text-white hover:bg-purple-700 transition-colors shadow-md shadow-purple-600/20">
                Request Re-inspection
              </button>
            )}
            {isChildArea && isOwnArea && selectedArea.status === "AWAITING_REVIEW" && !canApproveArea && (
              <p className="text-xs text-muted-foreground rounded-lg bg-slate-50 dark:bg-white/5 border border-border px-3 py-2">
                Submitted — an approval officer will review this area.
              </p>
            )}
            {isChildArea && isOwnArea && selectedArea.status === "REJECTED" && !canApproveArea && (
              <p className="text-xs text-muted-foreground rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200/60 px-3 py-2">
                Rejected. A review officer can request re-inspection so you can correct and resubmit.
              </p>
            )}
            {canDeleteArea && (selectedArea.status === "MARKED" || selectedArea.status === "DRAFT" || (isOwnArea && selectedArea.status === "REINSPECTION_REQUIRED")) && (
              <button onClick={() => deleteArea(selectedArea.id)} className="w-full px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                Delete Area
              </button>
            )}

            {isZoneArea && isZoneAdmin && (
              <div className="rounded-xl bg-slate-50 dark:bg-white/5 border border-border p-2 space-y-1.5">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Assign Officer</p>
                {engineerOptions === null ? (
                  <p className="text-xs text-muted-foreground">Loading engineers…</p>
                ) : engineerOptions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No active field engineers found.</p>
                ) : (
                  <div className="flex gap-1.5">
                    <select
                      value={selectedOfficerId}
                      onChange={(e) => setSelectedOfficerId(e.target.value)}
                      className="flex-1 min-w-0 px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground"
                    >
                      <option value="">Choose engineer…</option>
                      {engineerOptions.map((e) => (
                        <option key={e.id} value={e.id}>{e.display_name}</option>
                      ))}
                    </select>
                    <button
                      disabled={assigning || !selectedOfficerId}
                      onClick={() => { if (selectedOfficerId) void assignOfficer(selectedArea.id, selectedOfficerId); }}
                      className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-light disabled:opacity-50 transition-colors"
                    >
                      {assigning ? "Assigning…" : "Assign"}
                    </button>
                  </div>
                )}
              </div>
            )}

            {isZoneArea && listsZoneId === selectedZoneId && zoneAssignments.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Assigned Officers ({zoneAssignments.length})</p>
                {zoneAssignments.map((a) => (
                  <div key={a.assignment_id} className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 text-xs">
                    <span className="font-medium truncate">{a.officer_name ?? "Unknown officer"}</span>
                    <span className="text-muted-foreground shrink-0">{getStatusLabel(a.status)}</span>
                  </div>
                ))}
              </div>
            )}

            {isZoneArea && listsZoneId === selectedZoneId && zoneChildren.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Field Areas ({zoneChildren.length})</p>
                {zoneChildren.map((c) => {
                  const full = mapAreas.find((a) => a.id === c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => { if (full) { setShowAreaPanel(false); openAreaFromList(full); } }}
                      className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 text-xs text-left transition-colors"
                    >
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: AREA_COLORS[c.status] ?? "#94a3b8" }} />
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium truncate">{c.name}</span>
                        <span className="block text-[10px] text-muted-foreground">
                          {getStatusLabel(c.status)}{c.author_name ? ` · ${c.author_name}` : ""}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
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
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-border p-6 w-90 animate-in zoom-in-95 fade-in duration-200">
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
