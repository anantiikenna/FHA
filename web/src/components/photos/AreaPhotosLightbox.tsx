"use client";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { PhotoLightbox, type LightboxPhoto } from "./PhotoLightbox";

interface AreaPhotoRow {
  id: string;
  file_name: string;
  created_at: string;
  captured_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  uploader?: { display_name: string } | null;
}

/**
 * Opens the shared photo viewer for a map area. Photos are always fetched
 * fresh from the API when opened, so every reviewer inspects the same
 * current evidence set with the same metadata (no stale thumbnails).
 */
export function AreaPhotosLightbox({
  areaId,
  areaName,
  onClose,
}: {
  areaId: string;
  areaName?: string;
  onClose: () => void;
}) {
  const [photos, setPhotos] = useState<LightboxPhoto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/v1/map-areas/${areaId}/photos`)
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          setPhotos(
            (json.data as AreaPhotoRow[]).map((p) => ({
              id: p.id,
              fileName: p.file_name,
              createdAt: p.created_at,
              capturedAt: p.captured_at,
              latitude: p.latitude,
              longitude: p.longitude,
              uploadedByName: p.uploader?.display_name ?? null,
            }))
          );
        } else {
          setFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [areaId]);

  const signUrl = useCallback(async (photoId: string) => {
    const res = await fetch(`/api/v1/map-areas/${areaId}/photos/${photoId}`);
    const json = await res.json();
    if (!json.success || !json.data?.signedUrl) throw new Error("sign failed");
    return json.data.signedUrl as string;
  }, [areaId]);

  // Portal to document.body — the map area panel's backdrop-blur would
  // otherwise capture fixed positioning (see PhotoLightbox).
  if (typeof document === "undefined") return null;

  if (failed) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black px-6 text-center"
      >
        <p className="text-sm text-white/80">
          Photos could not be loaded for this property.
        </p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-light"
        >
          Close
        </button>
      </div>,
      document.body
    );
  }

  if (!photos) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Loading photos"
        className="fixed inset-0 z-[100] flex items-center justify-center bg-black"
      >
        <div className="flex flex-col items-center gap-3 text-white/80">
          <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
          <p className="text-sm">Loading photos…</p>
        </div>
      </div>,
      document.body
    );
  }

  if (photos.length === 0) {
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-black px-6 text-center"
      >
        <p className="text-sm text-white/80">No evidence photos on this property yet.</p>
        <button
          type="button"
          onClick={onClose}
          className="min-h-11 px-5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-light"
        >
          Close
        </button>
      </div>,
      document.body
    );
  }

  return (
    <PhotoLightbox
      photos={photos}
      index={index}
      onIndexChange={setIndex}
      onClose={onClose}
      signUrl={signUrl}
      contextLabel={areaName}
    />
  );
}
