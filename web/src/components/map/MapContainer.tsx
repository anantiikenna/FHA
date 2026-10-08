"use client";

import dynamic from "next/dynamic";
import type { PlotData, MapArea } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function MapContainer({
  plots,
  mapAreas = [],
  statusMode = "approval",
  userRole = "ENGINEER",
  userId = "",
  onAreasChange,
}: {
  plots?: PlotData[];
  mapAreas?: MapArea[];
  statusMode?: "approval" | "inspection";
  userRole?: string;
  userId?: string;
  onAreasChange?: () => void;
}) {
  return (
    <MapView
      plots={plots}
      mapAreas={mapAreas}
      statusMode={statusMode}
      userRole={userRole}
      userId={userId}
      onAreasChange={onAreasChange}
    />
  );
}
