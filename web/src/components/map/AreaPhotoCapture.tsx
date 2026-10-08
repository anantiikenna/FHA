"use client";
import { useState, useEffect, useCallback } from "react";
import { PhotoThumb, type UploadedPhoto } from "@/components/inspection/PhotoThumb";

interface FreshGps {
  latitude: number;
  longitude: number;
  capturedAt: string;
}

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

/**
 * Evidence photos for a map area. At least one photo is required before a
 * property outcome can be recorded (owner decision). Photos are editable
 * (upload/delete) until an outcome is recorded — afterwards they lock.
 */
export function AreaPhotoCapture({
  areaId,
  onCountChange,
}: {
  areaId: string;
  onCountChange?: (count: number) => void;
}) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [locked, setLocked] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endpoint = `/api/v1/map-areas/${areaId}/photos`;

  const fetchPhotos = useCallback(() => {
    fetch(endpoint)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data) {
          setPhotos(json.data);
          setLocked(Boolean(json.meta?.locked));
          onCountChange?.(json.data.length);
        }
      })
      .catch(() => {});
  }, [endpoint, onCountChange]);

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

    const localPreview = URL.createObjectURL(file);
    setUploading(true);
    setError(null);

    try {
      const fresh = await currentPosition();
      const formData = new FormData();
      formData.append("file", file);
      formData.append(
        "capturedAt",
        fresh?.capturedAt ?? new Date(file.lastModified || Date.now()).toISOString()
      );
      if (fresh) {
        formData.append("latitude", String(fresh.latitude));
        formData.append("longitude", String(fresh.longitude));
      }

      const res = await fetch(endpoint, { method: "POST", body: formData });
      const json = await res.json();
      if (!json.success) {
        URL.revokeObjectURL(localPreview);
        setError(json.error?.message ?? "Upload failed.");
        return;
      }

      setPhotos((prev) => {
        const next = [{ ...json.data, previewUrl: localPreview }, ...prev];
        onCountChange?.(next.length);
        return next;
      });
      e.target.value = "";
    } catch {
      URL.revokeObjectURL(localPreview);
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  }

  async function onDelete(id: string) {
    setError(null);
    try {
      const res = await fetch(`${endpoint}/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.success) {
        setError(json.error?.message ?? "Could not delete the photo.");
        return;
      }
      setPhotos((prev) => {
        const next = prev.filter((p) => p.id !== id);
        onCountChange?.(next.length);
        return next;
      });
    } catch {
      setError("Network error — please try again.");
    }
  }

  return (
    <div className="rounded-xl border border-border bg-white p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold">Property Photos</h3>
        <span className="text-xs text-muted-foreground">
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
          {locked && " · locked"}
        </span>
      </div>

      {!locked && (
        <label className="inline-flex items-center gap-2 rounded-lg bg-brand px-3 py-1.5 text-xs text-white cursor-pointer hover:bg-brand-light transition-colors">
          {uploading ? (
            <>
              <div className="w-3 h-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              Uploading…
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
              </svg>
              Add Photo
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
      )}

      {locked && (
        <p className="text-xs text-muted-foreground mb-2">
          An outcome has been recorded — photos are now read-only.
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {photos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((p) => (
            <PhotoThumb
              key={p.id}
              endpoint={endpoint}
              photo={p}
              onDelete={locked ? undefined : onDelete}
            />
          ))}
        </div>
      ) : (
        !uploading && (
          <p className="text-xs text-muted-foreground mt-2">
            No photos yet. At least one photo is required before recording a property outcome.
          </p>
        )
      )}
    </div>
  );
}
