import type { Metadata } from "next";
import { PublicMapView } from "@/components/public/PublicMapView";

export const metadata: Metadata = {
  title: "FHA Property Map — Public View",
  description:
    "Read-only public view of FHA estate areas: availability, recorded outcomes and building photos. Sample data — not an official FHA record.",
};

export default function PublicMapPage() {
  return <PublicMapView />;
}
