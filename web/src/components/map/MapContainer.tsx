"use client";

import dynamic from "next/dynamic";
import type { PlotData } from "./MapView";

const MapView = dynamic(() => import("./MapView"), { ssr: false });

export default function MapContainer({
  plots,
  statusMode = "approval",
}: {
  plots?: PlotData[];
  statusMode?: "approval" | "inspection";
}) {
  return <MapView plots={plots} statusMode={statusMode} />;
}
