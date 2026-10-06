"use client";
import { useState, useEffect, useCallback } from "react";
import { PhotoThumb, type UploadedPhoto } from "./PhotoThumb";
import type { SiteGps } from "@/lib/photo-gps";

interface FreshGps {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

/** Fresh position at photo time (fast timeout); null if unavailable/denied. */
function currentPosition(timeoutMs = 4000): Promise<FreshGps | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          capturedAt: new Date(pos.timestamp).toISOString(),
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: timeoutMs }
    );
  });
}

export function PhotoUpload({
  inspectionId,
  siteGps,
}: {
  inspectionId: string;
  siteGps?: SiteGps | null;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);

  const fetchPhotos = useCallback(() => {
    fetch(`/api/v1/inspections/${inspectionId}/photos`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) setPhotos(json.data);
      })
      .catch(() => {});
  }, [inspectionId]);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/jpeg", "image/png", "image/jpg"].includes(file.type)) {
      setError("Only JPG/PNG files are allowed.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large (max 10 MB).");
      return;
    }

    // Create an object URL for instant preview while the upload happens
    const localPreview = URL.createObjectURL(file);

    setUploading(true);
    setError(null);

    // Per-photo location: fresh fix at capture time, else fall back to the
    // inspection's captured site GPS. Photo timestamp = file.lastModified.
    const fresh = await currentPosition();
    const gps: FreshGps | null =
      fresh ??
      (siteGps
        ? {
            latitude: siteGps.latitude,
            longitude: siteGps.longitude,
            capturedAt: new Date(file.lastModified || Date.now()).toISOString(),
          }
        : null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("capturedAt", gps?.capturedAt ?? new Date(file.lastModified || Date.now()).toISOString());
      if (gps) {
        formData.append("latitude", String(gps.latitude));
        formData.append("longitude", String(gps.longitude));
      }

      const res = await fetch(`/api/v1/inspections/${inspectionId}/photos`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!json.success) {
        URL.revokeObjectURL(localPreview);
        setError(json.error?.message ?? "Upload failed.");
        return;
      }

      // Prepend the new photo with the local preview URL for immediate display
      setPhotos((prev) => [{ ...json.data, previewUrl: localPreview }, ...prev]);
      e.target.value = "";
    } catch {
      URL.revokeObjectURL(localPreview);
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">Site Photos</h3>
        {photos.length > 0 && (
          <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
        )}
      </div>

      <label className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm text-white cursor-pointer hover:bg-brand-light transition-colors disabled:opacity-50">
        {uploading ? (
          <>
            <div className="w-3.5 h-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            Uploading…
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
            </svg>
            Take / Upload Photo
          </>
        )}
        <input
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="hidden"
          onChange={onChange}
          disabled={uploading}
        />
      </label>

      {!siteGps && (
        <p className="text-xs text-amber-600 mt-2">
          Tip: capture GPS first — each photo is stamped with its location when GPS is available.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-3 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <svg className="w-4 h-4 text-red-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5-.217 3.374 1.947 3.374h14.71c1.727 0 3.182-1.874 2.497-3.374L13.949 3.378c-.866-1.5-.317-3.374 1.154-3.374 1.153 0 1.154.848 1.154 2.175L22.697 16.126zM12 15.75h.007v.008H12v-.008z" />
          </svg>
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {photos.length > 0 ? (
        <div className="mt-4 flex flex-wrap gap-3">
          {photos.map((p) => (
            <PhotoThumb key={p.id} inspectionId={inspectionId} photo={p} />
          ))}
        </div>
      ) : (
        !uploading && (
          <p className="text-sm text-muted-foreground mt-3">No photos yet. Use the button above to capture or upload site photos.</p>
        )
      )}

      <p className="text-xs text-slate-400 mt-3">
        Photos are stored securely and only accessible to authorised staff.
      </p>
    </div>
  );
}
