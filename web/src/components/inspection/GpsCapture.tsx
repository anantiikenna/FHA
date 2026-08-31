"use client";
import { useState } from "react";

export function GpsCapture({ onCapture }: { onCapture?: (coords: { latitude: number; longitude: number; accuracy: number | null }) => void }) {
  const [status, setStatus] = useState<"idle" | "capturing" | "captured" | "denied" | "unavailable">("idle");
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number | null } | null>(null);

  function capture() {
    if (!navigator.geolocation) {
      setStatus("unavailable");
      return;
    }
    setStatus("capturing");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        setCoords(c);
        setStatus("captured");
        onCapture?.({ latitude: c.lat, longitude: c.lng, accuracy: c.acc });
      },
      (err) => {
        if (err.code === 1) setStatus("denied");
        else setStatus("unavailable");
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <h3 className="font-semibold mb-2">GPS — inspection evidence, not survey (AGENTS.md:10)</h3>
      <button onClick={capture} disabled={status === "capturing"} className="rounded-lg bg-brand px-4 py-2 text-sm text-white disabled:opacity-50">
        {status === "capturing" ? "Capturing..." : "Capture Current Location"}
      </button>
      <div className="text-sm mt-2">
        {status === "captured" && coords && <p>Captured: {coords.lat.toFixed(6)}, {coords.lng.toFixed(6)} ±{coords.acc?.toFixed(0)}m</p>}
        {status === "denied" && <p className="text-amber-700">Permission denied — enable location and retry. (UI_UX.md:26)</p>}
        {status === "unavailable" && <p className="text-red-600">Location unavailable.</p>}
        {status === "idle" && <p className="text-slate-500">Waiting for location.</p>}
      </div>
    </div>
  );
}
