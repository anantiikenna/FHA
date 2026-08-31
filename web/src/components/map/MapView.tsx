"use client";
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function MapView({ onSelectPlot }: { onSelectPlot?: (plotId: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://demotiles.maplibre.org/style.json",
      center: [3.28, 6.45],
      zoom: 13,
    });
    map.addControl(new maplibregl.NavigationControl(), "top-right");
    mapRef.current = map;

    // Demo: clicked point → placeholder plot highlight (replace with real GeoJSON layer)
    map.on("click", (e) => {
      // Future: point-in-polygon → plot_id → onSelectPlot(plotId)
      console.log("Map click", e.lngLat);
    });

    return () => map.remove();
  }, []);

  return <div ref={ref} className="w-full h-[520px] rounded-xl border border-border overflow-hidden" />;
}
