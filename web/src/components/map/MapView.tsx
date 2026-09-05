"use client";
import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface PlotData {
  id: string;
  plotNumber: string;
  status: string;
  lat: number | null;
  lng: number | null;
  block: string;
  estate: string;
}

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "#10b981",
  PENDING: "#facc15",
  UNDER_CONSTRUCTION: "#60a5fa",
  COMPLETED: "#10b981",
  INSPECTION_REQUIRED: "#f59e0b",
  REVIEW_REQUIRED: "#ef4444",
};

export default function MapView({ plots = [] }: { plots?: PlotData[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const router = useRouter();

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
      plots.forEach((plot) => {
        if (plot.lat == null || plot.lng == null) return;

        const color = STATUS_COLORS[plot.status] ?? "#94a3b8";
        const marker = new maplibregl.Marker({ color })
          .setLngLat([plot.lng, plot.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              `<div style="font-size:13px;padding:4px">
                <strong>Plot ${plot.plotNumber}</strong><br/>
                Block ${plot.block} — ${plot.estate}<br/>
                <span style="color:${color}">${plot.status}</span><br/>
                <a href="/plots/${plot.id}" style="color:#2563eb;text-decoration:underline">View details →</a>
              </div>`
            )
          )
          .addTo(map);

        marker.getElement().addEventListener("click", () => {
          router.push(`/plots/${plot.id}`);
        });
      });
    });

    return () => map.remove();
  }, [plots, router]);

  return <div ref={ref} className="w-full h-[600px] rounded-xl border border-border overflow-hidden" />;
}
