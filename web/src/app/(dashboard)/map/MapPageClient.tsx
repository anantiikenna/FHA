"use client";

import { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import type { PlotData, MapArea } from "@/components/map/MapView";

const MapContainer = dynamic(() => import("@/components/map/MapContainer"), { ssr: false });

export default function MapPageClient({
  plotData,
  areaData,
  userRole,
  userId,
  assignedAreaIds = [],
}: {
  plotData: PlotData[];
  areaData: MapArea[];
  userRole: string;
  userId: string;
  assignedAreaIds?: string[];
}) {
  const [areas, setAreas] = useState<MapArea[]>(areaData);

  const refreshAreas = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/map-areas");
      const json = await res.json();
      if (json.success) setAreas(json.data);
    } catch { /* */ }
  }, []);

  return (
    <MapContainer
      plots={plotData}
      mapAreas={areas}
      userRole={userRole}
      userId={userId}
      assignedAreaIds={assignedAreaIds}
      onAreasChange={refreshAreas}
    />
  );
}
