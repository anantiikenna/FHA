"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "@geoman-io/maplibre-geoman-free/dist/maplibre-geoman.css";
import { createGeomanInstance, type Geoman } from "@geoman-io/maplibre-geoman-free";
import MapDrawToolbar, { type DrawTool } from "./MapDrawToolbar";
import MapSearch from "./MapSearch";
import { toPolygonGeometry, plotIdsInside, findInnermostArea, areaDepthMap, type PolygonGeometry } from "@/lib/geo";
import { PROPERTY_OUTCOMES, readPropertyOutcome, type PropertyOutcomeType } from "@/lib/property-outcome";

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
  metadata?: Record<string, unknown> | null;
  created_at: string;
}

interface ZoneChild {
  id: string;
  name: string;
  status: string;
  drawn_by: string;
  author_name: string | null;
  created_at: string;
  depth?: number;
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
  NON_COMPLIANT_OBSERVED: "#dc2626",
  AWAITING_OWNER: "#0ea5e9",
  EMPTY_UNOCCUPIED: "#64748b",
  UNAPPROVED_PROPERTY: "#f97316",
  SET_FOR_DEMOLITION: "#b91c1c",
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
  NON_COMPLIANT_OBSERVED: "rgba(220,38,38,0.18)",
  AWAITING_OWNER: "rgba(14,165,233,0.18)",
  EMPTY_UNOCCUPIED: "rgba(100,116,139,0.18)",
  UNAPPROVED_PROPERTY: "rgba(249,115,22,0.18)",
  SET_FOR_DEMOLITION: "rgba(185,28,28,0.18)",
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

// Correct display wording for workflow statuses (keys stay machine-readable)
const STATUS_LABELS: Record<string, string> = {
  NON_COMPLIANT_OBSERVED: "Non-Compliant (Observed)",
  AWAITING_OWNER: "Awaiting Property Owner",
  EMPTY_UNOCCUPIED: "Empty / Unoccupied",
  UNAPPROVED_PROPERTY: "Unapproved Property",
  SET_FOR_DEMOLITION: "Set for Demolition",
};

function getStatusLabel(status: string) {
  if (STATUS_LABELS[status]) return STATUS_LABELS[status];
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
  // Where the drawn shape will be stored (innermost containing area, or a new
  // top-level zone) — previewed in the name modal before saving.
  const [containerPreview, setContainerPreview] = useState<{ text: string; tone: "info" | "warn" } | null>(null);
  const [drawPoints, setDrawPoints] = useState<number[][]>([]);
  const [zoneChildren, setZoneChildren] = useState<ZoneChild[]>([]);
  const [zoneAssignments, setZoneAssignments] = useState<ZoneAssignment[]>([]);
  const [listsZoneId, setListsZoneId] = useState<string | null>(null);
  // Which area the children (descendant sub-areas) list belongs to — any area
  // type, not just zones.
  const [listsChildrenId, setListsChildrenId] = useState<string | null>(null);
  const [engineerOptions, setEngineerOptions] = useState<EngineerOption[] | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [selectedOfficerId, setSelectedOfficerId] = useState("");
  // Scope picker state is keyed to the zone it was set for — selecting another
  // zone automatically falls back to the defaults (no effect-side setState).
  const [scopeForZone, setScopeForZone] = useState<string | null>(null);
  const [rawScopeMode, setRawScopeMode] = useState<"remaining" | "all" | "custom">("remaining");
  const [rawScopePlotIds, setRawScopePlotIds] = useState<string[]>([]);

  const canUpdateArea =
    ["ADMIN", "SUPERVISOR", "GIS_OFFICER"].includes(userRole) ||
    (!!selectedArea && !!userId && selectedArea.drawn_by === userId);
  const canApproveArea = ["APPROVAL_OFFICER", "SUPERVISOR", "ADMIN"].includes(userRole);
  const canDeleteArea =
    ["ADMIN", "SUPERVISOR", "GIS_OFFICER"].includes(userRole) ||
    (!!selectedArea && !!userId && selectedArea.drawn_by === userId);
  const canCreateInspection = ["ADMIN", "SUPERVISOR", "ENGINEER"].includes(userRole);

  const isEngineerRole = userRole === "ENGINEER";
  const isZoneAdmin = ["ADMIN", "SUPERVISOR", "GIS_OFFICER"].includes(userRole);
  const isChildArea = selectedArea?.area_type === "INSPECTED_AREA";
  const isZoneArea = selectedArea?.area_type === "INSPECTION_ZONE";
  const isOwnArea = !!selectedArea && !!userId && selectedArea.drawn_by === userId;
  const assignedToMe = !!selectedArea && assignedAreaIds.includes(selectedArea.id);
  // Depth labels for the saved-areas list (Zone / Field area / Sub-area).
  const areaDepths = showAreasList ? areaDepthMap(mapAreas) : null;
  // Statuses where the owning engineer may act (start/submit/resume + field outcome)
  const childOwnStatuses = ["DRAFT", "IN_PROGRESS", "REINSPECTION_REQUIRED", "NON_COMPLIANT_OBSERVED", "AWAITING_OWNER", "EMPTY_UNOCCUPIED", "UNAPPROVED_PROPERTY", "SET_FOR_DEMOLITION"];

  // Property outcome (propose / agree) derived state for the open area panel.
  const propertyOutcome = selectedArea ? readPropertyOutcome(selectedArea.metadata) : null;
  const selectedRootZoneId = selectedArea && selectedArea.area_type === "INSPECTED_AREA" ? rootZoneIdOf(selectedArea) : null;
  const outcomeOfficerEligible =
    !!selectedArea &&
    (isOwnArea || (!!selectedRootZoneId && assignedAreaIds.includes(selectedRootZoneId)));
  const outcomeLockedForOfficer =
    !!selectedArea && (selectedArea.status === "AWAITING_REVIEW" || selectedArea.status === "APPROVED");
  // Higher roles (canApproveArea) always see the record buttons and their
  // proposal is accepted immediately; officers propose only while eligible.
  const showOutcomePropose =
    !!selectedArea &&
    selectedArea.area_type === "INSPECTED_AREA" &&
    (canApproveArea
      ? true
      : outcomeOfficerEligible && !outcomeLockedForOfficer && propertyOutcome?.state !== "ACCEPTED");

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

  // Mirrors the server's innermost-parent rule so the name modal can show
  // where the shape will be stored before it is saved.
  function computeContainerPreview(geoJson: unknown): { text: string; tone: "info" | "warn" } | null {
    const ring = toPolygonGeometry(geoJson)?.coordinates?.[0];
    if (!ring) return null;

    if (isEngineerRole) {
      const byId = new Map(mapAreas.map((a) => [a.id, a]));
      const rootIdOf = (start: MapArea): string => {
        let cur = start;
        const seen = new Set<string>();
        while (cur.parent_area_id && byId.has(cur.parent_area_id) && !seen.has(cur.id)) {
          seen.add(cur.id);
          cur = byId.get(cur.parent_area_id) as MapArea;
        }
        return cur.id;
      };
      const allowed = mapAreas.filter((a) => assignedAreaIds.includes(rootIdOf(a)));
      const container = findInnermostArea(ring, allowed);
      return container
        ? { text: `Will be saved as a field area inside "${container.name}".`, tone: "info" }
        : { text: "Not inside your assigned zone — saving will be rejected.", tone: "warn" };
    }

    const container = findInnermostArea(ring, mapAreas);
    return container
      ? { text: `Will be saved as a sub-area inside "${container.name}".`, tone: "info" }
      : { text: "Will be saved as a new top-level zone.", tone: "info" };
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

    // Preview where this shape will be stored: the innermost saved area that
    // fully contains it (any depth), or a new top-level zone. Engineers are
    // restricted to their assigned zone subtree (mirrors the server rule).
    setContainerPreview(computeContainerPreview(geoJson));

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
      window.alert("Network error - try again.");
    }
  }

  async function deleteArea(areaId: string) {
    const deletingZone =
      !!selectedArea && selectedArea.id === areaId && selectedArea.area_type === "INSPECTION_ZONE";
    // Deleting an area cascades to its whole subtree (any depth, DB-level) —
    // warn with the descendant count whenever the loaded list has children.
    const descendantCount = listsChildrenId === areaId ? zoneChildren.length : 0;
    const confirmMsg =
      descendantCount > 0
        ? deletingZone
          ? `Delete this zone? All ${descendantCount} field area(s) inside it will be deleted too. This cannot be undone.`
          : `Delete this area? All ${descendantCount} sub-area(s) inside it will be deleted too. This cannot be undone.`
        : deletingZone
          ? "Delete this zone? Any field areas inside it will be deleted too. This cannot be undone."
          : "Delete this area? This cannot be undone.";
    if (!window.confirm(confirmMsg)) return;
    try {
      const res = await fetch(`/api/v1/map-areas/${areaId}`, { method: "DELETE" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        window.alert(json?.error?.message ?? "Failed to delete area.");
        return;
      }
      const removed = Number(json?.data?.removedDescendants ?? 0);
      if (removed > 0) {
        window.alert(
          `${deletingZone ? "Zone" : "Area"} deleted - ${removed} nested sub-area(s) inside were also removed.`
        );
      }
      setShowAreaPanel(false);
      setSelectedArea(null);
      setPickerPlots(null);
      onAreasChange?.();
    } catch {
      window.alert("Network error - try again.");
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

  // Top-most ancestor of an area (follows parent_area_id chains); returns the
  // root's id only when that root is an inspection zone.
  function rootZoneIdOf(area: MapArea): string | null {
    const byId = new Map(mapAreas.map((a) => [a.id, a]));
    let cur = area;
    const seen = new Set<string>();
    while (cur.parent_area_id && byId.has(cur.parent_area_id) && !seen.has(cur.id)) {
      seen.add(cur.id);
      cur = byId.get(cur.parent_area_id) as MapArea;
    }
    return cur.area_type === "INSPECTION_ZONE" ? cur.id : null;
  }

  // Record a property outcome: officers propose (reviewed by a higher role);
  // higher roles are recorded as accepted immediately (server-enforced).
  async function patchPropertyOutcome(type: PropertyOutcomeType, action: "propose" | "agree" | "reject") {
    if (!selectedArea) return;
    const body: Record<string, unknown> = { property_outcome: { type, action } };
    // Proposing also marks the area with the paired outcome status — unless it
    // is already with a reviewer or decided (then only the record changes).
    if (action === "propose" && !["AWAITING_REVIEW", "APPROVED", "REJECTED"].includes(selectedArea.status)) {
      body.status = PROPERTY_OUTCOMES[type].status;
    }
    try {
      const res = await fetch(`/api/v1/map-areas/${selectedArea.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        window.alert(json?.error?.message ?? "Failed to record the property outcome.");
        return;
      }
      setSelectedArea({
        ...selectedArea,
        status: json?.data?.status ?? selectedArea.status,
        metadata: json?.data?.metadata ?? selectedArea.metadata,
      });
      onAreasChange?.();
    } catch {
      window.alert("Network error — try again.");
    }
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
      setListsChildrenId(zoneId);
    } catch {
      setZoneChildren([]);
      setZoneAssignments([]);
      setListsZoneId(zoneId);
      setListsChildrenId(zoneId);
    }
  }, []);

  async function assignOfficer(zoneId: string, officerId: string) {
    if (!officerId || assigning) return;
    setAssigning(true);
    try {
      // Partitioned scope (WORKFLOWS v0.2 §5): remaining = server default
      // (plots not yet claimed), all = whole zone, custom = chosen plots.
      const zonePlots =
        selectedArea && selectedArea.id === zoneId ? (selectedArea.plot_ids ?? []) : [];
      const body: Record<string, unknown> = { assigned_to: officerId };
      if (scopeMode === "all" && zonePlots.length > 0) body.plot_ids = zonePlots;
      else if (scopeMode === "custom") body.plot_ids = scopePlotIds;
      const res = await fetch(`/api/v1/map-areas/${zoneId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        window.alert(json?.error?.message ?? "Failed to assign officer.");
        return;
      }
      setScopeForZone(null);
      setRawScopeMode("remaining");
      setRawScopePlotIds([]);
      await refreshZoneLists(zoneId);
      onAreasChange?.();
    } catch {
      window.alert("Network error — try again.");
    } finally {
      setAssigning(false);
    }
  }

  const selectedZoneId = showAreaPanel && isZoneArea ? selectedArea?.id ?? null : null;

  const scopeActive = scopeForZone === selectedZoneId;
  const scopeMode: "remaining" | "all" | "custom" = scopeActive ? rawScopeMode : "remaining";
  const scopePlotIds: string[] = scopeActive ? rawScopePlotIds : [];
  const setScopeMode = (mode: "remaining" | "all" | "custom") => {
    setScopeForZone(selectedZoneId);
    setRawScopeMode(mode);
  };
  const setScopePlotIds = (next: string[] | ((prev: string[]) => string[])) => {
    setScopeForZone(selectedZoneId);
    setRawScopePlotIds((prev) => {
      const base = scopeForZone === selectedZoneId ? prev : [];
      return typeof next === "function" ? next(base) : next;
    });
  };

  // Descendant sub-areas (any depth) for whatever area panel is open.
  const selectedChildrenId = showAreaPanel && selectedArea ? selectedArea.id : null;

  useEffect(() => {
    if (!selectedChildrenId) return;
    let cancelled = false;
    fetch(`/api/v1/map-areas/${selectedChildrenId}/children`)
      .then((r) => r.json().catch(() => null))
      .then((json) => {
        if (cancelled) return;
        setZoneChildren(json?.success && Array.isArray(json.data) ? json.data : []);
        setListsChildrenId(selectedChildrenId);
      })
      .catch(() => {
        if (cancelled) return;
        setZoneChildren([]);
        setListsChildrenId(selectedChildrenId);
      });
    return () => { cancelled = true; };
  }, [selectedChildrenId]);

  // Officer assignments apply to zones only.
  useEffect(() => {
    if (!selectedZoneId) return;
    let cancelled = false;
    fetch(`/api/v1/map-areas/${selectedZoneId}/assign`)
      .then((r) => r.json().catch(() => null))
      .then((json) => {
        if (cancelled) return;
        setZoneAssignments(json?.success && Array.isArray(json.data) ? json.data : []);
        setListsZoneId(selectedZoneId);
      })
      .catch(() => {
        if (cancelled) return;
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
                      {(() => {
                        const depth = areaDepths?.get(area.id) ?? 0;
                        if (depth >= 2) return "Sub-area";
                        return area.area_type === "INSPECTED_AREA" ? "Field area" : "Zone";
                      })()} · {getStatusLabel(area.status)}
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
          preview={containerPreview}
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

          {isZoneArea && isEngineerRole && assignedToMe && (
            <p className="text-xs text-muted-foreground mb-4 rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200/60 px-3 py-2">
              Draw a field area inside this zone with the polygon or box tool - it will appear under &ldquo;Field Areas&rdquo; for review.
            </p>
          )}
          {isZoneArea && isEngineerRole && !assignedToMe && (
            <p className="text-xs text-muted-foreground mb-4 rounded-lg bg-slate-50 dark:bg-white/5 border border-border px-3 py-2">
              This zone is not assigned to you. Ask your supervisor to assign you before drawing here.
            </p>
          )}
          {isZoneArea && isZoneAdmin && listsZoneId === selectedZoneId && zoneAssignments.length === 0 && (
            <p className="text-xs text-muted-foreground mb-4 rounded-lg bg-slate-50 dark:bg-white/5 border border-border px-3 py-2">
              No officer assigned yet - choose an engineer below to start field work. Multiple officers can be assigned.
            </p>
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
            {isChildArea && selectedArea.status === "MARKED" && canCreateInspection && isZoneAdmin && (
              <button onClick={() => void startInspectionFromArea(selectedArea)} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors shadow-md shadow-brand/20">
                Start Inspection
              </button>
            )}
            {isChildArea && isOwnArea && childOwnStatuses.includes(selectedArea.status) && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "AWAITING_REVIEW")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors shadow-md shadow-amber-500/20">
                Submit for Approval
              </button>
            )}
            {isChildArea && isOwnArea && childOwnStatuses.includes(selectedArea.status) && (
              <div className="space-y-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-border p-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Field Outcome</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedArea.status !== "NON_COMPLIANT_OBSERVED" && (
                    <button
                      onClick={() => updateAreaStatus(selectedArea.id, "NON_COMPLIANT_OBSERVED")}
                      className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs font-semibold border border-red-200/60 text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                    >
                      Non-Compliant (Observed)
                    </button>
                  )}
                  {selectedArea.status !== "AWAITING_OWNER" && (
                    <button
                      onClick={() => updateAreaStatus(selectedArea.id, "AWAITING_OWNER")}
                      className="flex-1 min-w-[140px] px-3 py-2 rounded-lg text-xs font-semibold border border-sky-200/60 text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10 transition-colors"
                    >
                      Awaiting Property Owner
                    </button>
                  )}
                </div>
                {selectedArea.status === "NON_COMPLIANT_OBSERVED" && (
                  <p className="text-[10px] text-muted-foreground">
                    Non-compliance observed on site - a field observation, not an enforcement decision. Submit for approval when ready.
                  </p>
                )}
                {selectedArea.status === "AWAITING_OWNER" && (
                  <p className="text-[10px] text-muted-foreground">
                    Field work paused until the property owner is available on site. Start inspection once they arrive, or submit for approval.
                  </p>
                )}
                {selectedArea.status === "EMPTY_UNOCCUPIED" && (
                  <p className="text-[10px] text-muted-foreground">
                    Marked area recorded as empty / unoccupied - a field observation, not an enforcement decision. Submit for approval when ready.
                  </p>
                )}
              </div>
            )}
            {selectedArea.area_type === "INSPECTED_AREA" && (
              <div className="space-y-1.5 rounded-xl bg-slate-50 dark:bg-white/5 border border-border p-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Property Outcome</p>
                {propertyOutcome && (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      propertyOutcome.state === "ACCEPTED"
                        ? "bg-green-500/15 text-green-600"
                        : propertyOutcome.state === "REJECTED"
                          ? "bg-red-500/15 text-red-600"
                          : "bg-amber-500/15 text-amber-600"
                    }`}
                  >
                    {propertyOutcome.label} &middot;{" "}
                    {propertyOutcome.state === "PROPOSED" ? "Proposed (awaiting review)" : propertyOutcome.state === "ACCEPTED" ? "Accepted" : "Rejected"}
                  </span>
                )}
                {propertyOutcome?.state === "PROPOSED" && canApproveArea && (
                  <div className="flex gap-1.5">
                    <button
                      onClick={() => propertyOutcome && void patchPropertyOutcome(propertyOutcome.type, "agree")}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors"
                    >
                      Agree
                    </button>
                    <button
                      onClick={() => propertyOutcome && void patchPropertyOutcome(propertyOutcome.type, "reject")}
                      className="flex-1 px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      Reject
                    </button>
                  </div>
                )}
                {propertyOutcome?.state === "PROPOSED" && !canApproveArea && (
                  <p className="text-[10px] text-muted-foreground">
                    Proposed - only a review officer (approval officer, supervisor or admin) can agree after submission.
                  </p>
                )}
                {showOutcomePropose && (
                  <div className="flex flex-wrap gap-1.5">
                    {(Object.keys(PROPERTY_OUTCOMES) as PropertyOutcomeType[]).map((key) => (
                      <button
                        key={key}
                        onClick={() => void patchPropertyOutcome(key, "propose")}
                        className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border border-border bg-background hover:bg-muted transition-colors"
                      >
                        {PROPERTY_OUTCOMES[key].label}
                      </button>
                    ))}
                  </div>
                )}
                {showOutcomePropose && canApproveArea && (
                  <p className="text-[10px] text-muted-foreground">
                    As a higher role your record is accepted immediately.
                  </p>
                )}
                {!showOutcomePropose && !propertyOutcome && !canApproveArea && outcomeLockedForOfficer && (
                  <p className="text-[10px] text-muted-foreground">
                    This area is with a review officer - only a review officer can record the outcome now.
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground/70">
                  Field observation / recommendation requiring review - not an enforcement decision.
                </p>
              </div>
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
            {isChildArea && isZoneAdmin && canUpdateArea && selectedArea.status === "IN_PROGRESS" && (
              <button onClick={() => updateAreaStatus(selectedArea.id, "INSPECTED")} className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-green-600 text-white hover:bg-green-700 transition-colors shadow-md shadow-green-600/20">
                Mark Inspected
              </button>
            )}
            {isChildArea && isZoneAdmin && canUpdateArea && selectedArea.status === "INSPECTED" && (
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
            {canDeleteArea && (isZoneArea || selectedArea.status === "MARKED" || selectedArea.status === "DRAFT" || (isOwnArea && selectedArea.status === "REINSPECTION_REQUIRED")) && (
              <button onClick={() => deleteArea(selectedArea.id)} className="w-full px-4 py-2 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                Delete {isZoneArea ? "Zone" : "Area"}
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
                  <>
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
                        disabled={assigning || !selectedOfficerId || (scopeMode === "custom" && scopePlotIds.length === 0)}
                        onClick={() => { if (selectedOfficerId) void assignOfficer(selectedArea.id, selectedOfficerId); }}
                        className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand text-white hover:bg-brand-light disabled:opacity-50 transition-colors"
                      >
                        {assigning ? "Assigning…" : "Assign"}
                      </button>
                    </div>
                    <select
                      value={scopeMode}
                      onChange={(e) => setScopeMode(e.target.value as "remaining" | "all" | "custom")}
                      className="w-full px-2 py-1.5 text-xs rounded-lg border border-border bg-background text-foreground"
                    >
                      <option value="remaining">Scope: remaining plots (recommended)</option>
                      <option value="all">Scope: entire zone ({(selectedArea.plot_ids ?? []).length} plots)</option>
                      <option value="custom">Scope: choose plots…</option>
                    </select>
                    {scopeMode === "custom" && (
                      <div className="max-h-36 overflow-y-auto rounded-lg border border-border bg-background p-1 space-y-0.5">
                        {(selectedArea.plot_ids ?? []).length === 0 ? (
                          <p className="text-xs text-muted-foreground px-2 py-1">No plots in this zone yet.</p>
                        ) : (
                          (selectedArea.plot_ids ?? []).map((pid) => {
                            const p = plots.find((x) => x.id === pid);
                            const checked = scopePlotIds.includes(pid);
                            return (
                              <label key={pid} className="flex items-center gap-2 px-2 py-1 text-xs rounded hover:bg-muted cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() =>
                                    setScopePlotIds((prev) =>
                                      checked ? prev.filter((x) => x !== pid) : [...prev, pid]
                                    )
                                  }
                                />
                                <span>Plot {p?.plotNumber ?? "—"}</span>
                              </label>
                            );
                          })
                        )}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Each officer gets their own scope and progress bar.
                    </p>
                  </>
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

            {showAreaPanel && selectedArea && listsChildrenId === selectedArea.id && zoneChildren.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase">
                  {isZoneArea ? "Field Areas" : "Sub-areas"} ({zoneChildren.length})
                </p>
                {zoneChildren.map((c) => {
                  const full = mapAreas.find((a) => a.id === c.id);
                  return (
                    <button
                      key={c.id}
                      style={{ marginLeft: (c.depth ?? 0) * 12 }}
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

function NameInputModal({
  onSave,
  onCancel,
  preview = null,
}: {
  onSave: (name: string) => void;
  onCancel: () => void;
  preview?: { text: string; tone: "info" | "warn" } | null;
}) {
  const [name, setName] = useState("");

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl border border-border p-6 w-90 animate-in zoom-in-95 fade-in duration-200">
        <h3 className="text-lg font-bold text-foreground mb-1">Name This Area</h3>
        <p className={`text-sm text-muted-foreground ${preview ? "mb-2" : "mb-4"}`}>Give your inspection area a descriptive name.</p>
        {preview && (
          <p
            className={`text-xs mb-4 rounded-lg px-3 py-2 border ${
              preview.tone === "warn"
                ? "bg-amber-50 border-amber-200/70 text-amber-700"
                : "bg-blue-50 dark:bg-blue-500/10 border-blue-200/60 text-blue-700 dark:text-blue-300"
            }`}
          >
            {preview.text}
          </p>
        )}
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
