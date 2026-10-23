"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { PhotoLightbox, type LightboxPhoto } from "@/components/photos/PhotoLightbox";
import { SafeImg } from "@/components/ui/safe-img";
import type { PublicArea } from "@/lib/public-area";

// MapLibre v6 worker fix (same as the dashboard map) — must run before the
// first Map or the worker URL resolves to "" and labels never render.
maplibregl.setWorkerUrl(
  new URL("maplibre-gl/dist/maplibre-gl-worker.mjs", import.meta.url).href
);

interface PublicPhoto {
  id: string;
  file_name: string;
  mime_type: string;
  captured_at: string | null;
  created_at: string;
  url: string | null;
}

const KIND_LABELS: Record<string, string> = {
  ZONE: "Zone",
  PLOT: "Plot",
  PROPERTY: "Property",
};

function fillColorFor(area: PublicArea): string {
  if (area.availability?.kind === "FOR_SALE") return "#d97706";
  if (area.availability?.kind === "UNOWNED") return "#059669";
  if (area.area_type === "ZONE") return "#94a3b8";
  switch (area.status) {
    case "APPROVED_PROPERTY":
      return "#0284c7";
    case "EMPTY_UNOCCUPIED":
      return "#64748b";
    case "UNAPPROVED_PROPERTY":
      return "#ea580c";
    case "SET_FOR_DEMOLITION":
      return "#dc2626";
    default:
      return "#7c3aed";
  }
}

function centroidOf(area: PublicArea): [number, number] | null {
  const g = area.geojson as { type?: string; coordinates?: number[][][] } | null;
  const ring = g?.coordinates?.[0];
  if (!ring || ring.length === 0) return null;
  let lng = 0;
  let lat = 0;
  for (const pt of ring) {
    lng += pt[0];
    lat += pt[1];
  }
  return [lng / ring.length, lat / ring.length];
}

function availabilityChip(area: PublicArea) {
  if (area.availability?.kind === "FOR_SALE") {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-500/15 border border-amber-300 dark:border-amber-500/40 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:text-amber-300">
        For sale
      </span>
    );
  }
  if (area.availability?.kind === "UNOWNED") {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-500/15 border border-emerald-300 dark:border-emerald-500/40 px-2 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
        Available to enquire
      </span>
    );
  }
  return null;
}

/**
 * Public read-only property map (owner decision, Oct 2026): shared via a
 * link with owners / complainers / enquirers. Renders only whitelisted
 * fields from /api/v1/public/map-areas — no draw, upload, delete or
 * outcome controls exist on this page at all.
 */
export function PublicMapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [areas, setAreas] = useState<PublicArea[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<Record<string, PublicPhoto[]>>({});
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [listOpen, setListOpen] = useState(true);
  const [mapReady, setMapReady] = useState(false);

  const selected = useMemo(
    () => (selectedId ? (areas?.find((a) => a.id === selectedId) ?? null) : null),
    [areas, selectedId]
  );
  const visibleAreas = useMemo(() => {
    if (!areas) return [];
    const q = query.trim().toLowerCase();
    return q ? areas.filter((a) => a.name.toLowerCase().includes(q)) : areas;
  }, [areas, query]);
  const availableCount = useMemo(
    () => (areas ?? []).filter((a) => a.availability).length,
    [areas]
  );

  // Public area list (client-side deep link resolution happens with the data).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/public/map-areas")
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (!json?.success || !Array.isArray(json.data)) {
          setLoadError(true);
          return;
        }
        setAreas(json.data as PublicArea[]);
        const link = new URLSearchParams(window.location.search).get("area");
        if (link && (json.data as PublicArea[]).some((a) => a.id === link)) {
          setSelectedId(link);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Read-only MapLibre instance (no draw controls, no Geoman).
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "/map-style.json",
      center: [3.2833, 6.4667],
      zoom: 15,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    map.on("load", () => {
      if (mapRef.current !== map) return;
      map.addSource("public-areas", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addLayer({
        id: "public-areas-fill",
        type: "fill",
        source: "public-areas",
        paint: { "fill-color": ["get", "fill"], "fill-opacity": 0.35 },
      });
      map.addLayer({
        id: "public-areas-line",
        type: "line",
        source: "public-areas",
        paint: { "line-color": ["get", "fill"], "line-width": 2 },
      });
      map.addLayer({
        id: "public-areas-label",
        type: "symbol",
        source: "public-areas",
        layout: {
          "text-field": ["get", "name"],
          "text-size": 12,
          "text-anchor": "center",
        },
        paint: { "text-color": "#0f172a", "text-halo-color": "#ffffff", "text-halo-width": 1.5 },
      });
      map.on("mouseenter", "public-areas-fill", () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", "public-areas-fill", () => {
        map.getCanvas().style.cursor = "";
      });
      map.on("click", "public-areas-fill", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (id) setSelectedId(String(id));
      });
      setMapReady(true);
    });
  }, []);

  // Feed fetched areas into the map source.
  useEffect(() => {
    if (!mapReady || !areas) return;
    const source = mapRef.current?.getSource("public-areas") as
      | maplibregl.GeoJSONSource
      | undefined;
    source?.setData({
      type: "FeatureCollection",
      features: areas.map((a) => ({
        type: "Feature",
        geometry: a.geojson as GeoJSON.Geometry,
        properties: { id: a.id, name: a.name, fill: fillColorFor(a) },
      })),
    });
  }, [mapReady, areas]);

  // Fly to the selected area (no state writes — effect only moves the map).
  useEffect(() => {
    if (!mapReady || !selected) return;
    const center = centroidOf(selected);
    if (center) {
      mapRef.current?.flyTo({ center, zoom: 16, duration: 900 });
    }
  }, [mapReady, selected]);

  // Load photos on first selection of an area that has any.
  useEffect(() => {
    if (!selected || selected.photo_count === 0 || photos[selected.id]) return;
    let cancelled = false;
    fetch(`/api/v1/public/map-areas/${selected.id}/photos`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json?.success && Array.isArray(json.data)) {
          setPhotos((prev) => ({ ...prev, [selected.id]: json.data as PublicPhoto[] }));
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [selected, photos]);

  const currentPhotos = selected ? (photos[selected.id] ?? []) : [];

  // Lightbox signing: use the prefetched short-lived URL; refetch when a
  // previous one has expired.
  const signUrl = useCallback(
    async (photoId: string): Promise<string> => {
      const areaId = selected?.id;
      if (!areaId) throw new Error("no area");
      const hit = (photos[areaId] ?? []).find((p) => p.id === photoId);
      if (hit?.url) return hit.url;
      const res = await fetch(`/api/v1/public/map-areas/${areaId}/photos`);
      const json = await res.json();
      const fresh = (json?.data ?? []).find((p: PublicPhoto) => p.id === photoId);
      if (fresh?.url) {
        setPhotos((prev) => ({ ...prev, [areaId]: json.data as PublicPhoto[] }));
        return fresh.url as string;
      }
      throw new Error("sign failed");
    },
    [selected, photos]
  );

  const lightboxPhotos: LightboxPhoto[] = currentPhotos.map((p) => ({
    id: p.id,
    fileName: p.file_name,
    createdAt: p.created_at,
    capturedAt: p.captured_at,
  }));

  function selectFromList(area: PublicArea) {
    setSelectedId(area.id);
    const center = centroidOf(area);
    if (center && mapRef.current) {
      mapRef.current.flyTo({ center, zoom: 16, duration: 900 });
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2.25rem)] min-h-[480px]">
      <header className="border-b border-border bg-surface px-4 py-2.5 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-brand text-white shrink-0">
            <svg className="w-4.5 h-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h1.5c.621 0 1.125.504 1.125 1.125V21" />
            </svg>
          </span>
          <div className="min-w-0">
            <h1 className="text-sm font-bold truncate">FHA Property Map</h1>
            <p className="text-[11px] text-muted-foreground">Public read-only view</p>
          </div>
        </div>
        <button
          onClick={() => setListOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold hover:bg-muted transition-colors"
          aria-expanded={listOpen}
        >
          {listOpen ? "Hide list" : `Areas${areas ? ` (${areas.length})` : ""}`}
        </button>
      </header>

      <div className="relative flex-1 overflow-hidden">
        {/* Map */}
        <div ref={containerRef} className="absolute inset-0" aria-label="Public property map" />

        {loadError && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/90">
            <div className="text-center max-w-xs px-6">
              <p className="text-sm font-semibold mb-1">We couldn&apos;t load the public map.</p>
              <p className="text-xs text-muted-foreground mb-3">Please try again in a moment.</p>
              <button
                onClick={() => window.location.reload()}
                className="rounded-lg bg-brand px-4 py-2 text-xs font-semibold text-white hover:bg-brand-light"
              >
                Reload
              </button>
            </div>
          </div>
        )}

        {/* Area list */}
        {listOpen && (
          <aside className="absolute inset-y-0 left-0 z-20 w-full sm:w-80 bg-surface/95 dark:bg-background/95 backdrop-blur border-r border-border flex flex-col">
            <div className="p-3 border-b border-border">
              <label className="block text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
                Search areas
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Property or plot name…"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {areas === null
                  ? "Loading…"
                  : `${visibleAreas.length} of ${areas.length} areas${
                      availableCount ? ` · ${availableCount} available` : ""
                    }`}
              </p>
            </div>
            <div className="flex-1 overflow-y-auto">
              {areas === null && !loadError && (
                <p className="p-3 text-xs text-muted-foreground">Loading areas…</p>
              )}
              {visibleAreas.map((area) => (
                <button
                  key={area.id}
                  onClick={() => selectFromList(area)}
                  className={`w-full text-left px-3 py-2.5 border-b border-border/60 hover:bg-muted/70 transition-colors ${
                    selectedId === area.id ? "bg-muted" : ""
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium truncate">{area.name}</span>
                    {availabilityChip(area)}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {KIND_LABELS[area.area_type] ?? area.area_type} · {area.status_label}
                    {area.photo_count > 0 ? ` · ${area.photo_count} photo${area.photo_count === 1 ? "" : "s"}` : ""}
                  </span>
                </button>
              ))}
              {areas !== null && visibleAreas.length === 0 && (
                <p className="p-3 text-xs text-muted-foreground">No areas match your search.</p>
              )}
            </div>
            <p className="p-3 text-[11px] leading-relaxed text-muted-foreground border-t border-border">
              Colors mark availability and recorded outcomes. Availability is a
              system observation from stored records — not an official FHA
              clearance or sales guarantee.
            </p>
          </aside>
        )}

        {/* Details card */}
        {selected && (
          <aside className="absolute top-4 right-4 z-20 w-[19rem] max-h-[calc(100%-2rem)] overflow-y-auto rounded-2xl border border-border bg-surface shadow-2xl p-4">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="min-w-0">
                <h2 className="text-sm font-bold truncate">{selected.name}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {KIND_LABELS[selected.area_type] ?? selected.area_type}
                </p>
              </div>
              <button
                onClick={() => setSelectedId(null)}
                aria-label="Close area details"
                className="text-muted-foreground hover:text-foreground"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {availabilityChip(selected)}
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium">
                <span className="w-2 h-2 rounded-full" style={{ background: fillColorFor(selected) }} />
                {selected.status_label}
              </span>
            </div>

            {selected.availability && (
              <p className="text-xs text-foreground mb-3 rounded-lg bg-muted border border-border px-2.5 py-2">
                {selected.availability.label}
              </p>
            )}

            <dl className="space-y-2 text-xs mb-3">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Owner</dt>
                <dd className="font-medium text-right truncate">
                  {selected.owner_name ?? <span className="text-muted-foreground">Not recorded</span>}
                </dd>
              </div>
              {selected.outcome && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Recorded outcome</dt>
                  <dd className="font-medium text-right">{selected.outcome.label}</dd>
                </div>
              )}
              {selected.outcome?.recorded_at && (
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Recorded on</dt>
                  <dd className="font-medium text-right">
                    {new Date(selected.outcome.recorded_at).toLocaleDateString()}
                  </dd>
                </div>
              )}
            </dl>

            {selected.photo_count > 0 && (
              <div className="mb-3">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase mb-1.5">
                  Building photos ({currentPhotos.length || selected.photo_count})
                </p>
                {currentPhotos.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {currentPhotos.map((p, i) => (
                      <button
                        key={p.id}
                        onClick={() => setViewerIndex(i)}
                        className="w-16 h-16 rounded-lg overflow-hidden border border-border hover:ring-2 hover:ring-brand/50 transition-shadow"
                        aria-label={`View photo ${p.file_name}`}
                      >
                        {p.url ? (
                          <SafeImg src={p.url} alt={p.file_name} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted" />
                        )}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-muted-foreground">Loading photos…</p>
                )}
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-muted-foreground border-t border-border pt-2">
              Field observation recorded in the FHA system — not a legal title,
              survey or enforcement decision. DEMO / SAMPLE DATA.
            </p>
          </aside>
        )}

        {viewerIndex != null && selected && (
          <PhotoLightbox
            photos={lightboxPhotos}
            index={viewerIndex}
            onIndexChange={setViewerIndex}
            onClose={() => setViewerIndex(null)}
            signUrl={signUrl}
            contextLabel={selected.name}
          />
        )}
      </div>
    </div>
  );
}
