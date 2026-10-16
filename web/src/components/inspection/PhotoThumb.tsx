"use client";
import { useState, useEffect } from "react";

export interface UploadedPhoto {
  id: string;
  file_name: string;
  storage_key: string;
  created_at: string;
  latitude?: number | null;
  longitude?: number | null;
  captured_at?: string | null;
  uploader?: { display_name: string } | null;
  /** Temporary object URL for instant preview before signing */
  previewUrl?: string;
}

export function PhotoThumb({
  endpoint,
  photo,
  onDelete,
  onOpen,
}: {
  /** Base photos path, e.g. /api/v1/map-areas/{areaId}/photos. */
  endpoint: string;
  photo: UploadedPhoto;
  onDelete?: (id: string) => void;
  /** Open this photo in the full-screen viewer. */
  onOpen?: () => void;
}) {
  const [signedUrl, setSignedUrl] = useState<string | null>(photo.previewUrl ?? null);
  const [loading, setLoading] = useState(!photo.previewUrl);
  const base = endpoint;

  useEffect(() => {
    // If we already have a local preview URL, skip the server round-trip
    if (photo.previewUrl) return;
    if (!base) return;

    // loading starts true from useState for non-preview photos
    fetch(`${base}/${photo.id}`)
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data?.signedUrl) setSignedUrl(json.data.signedUrl);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [base, photo.id, photo.previewUrl]);

  const gpsTitle =
    photo.latitude != null && photo.longitude != null
      ? `${photo.latitude.toFixed(6)}, ${photo.longitude.toFixed(6)}`
      : photo.file_name;

  return (
    <div title={gpsTitle} className="relative group rounded-xl overflow-hidden border border-border bg-muted/30 aspect-square w-28 shrink-0">
      <button
        type="button"
        onClick={onOpen}
        disabled={!onOpen}
        aria-label={onOpen ? `View photo ${photo.file_name} in full size` : undefined}
        className={`absolute inset-0 w-full h-full ${onOpen ? "cursor-zoom-in" : "cursor-default"}`}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full border-2 border-brand/30 border-t-brand animate-spin" />
          </div>
        )}
        {signedUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={signedUrl}
            alt={photo.file_name}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
            onLoad={() => setLoading(false)}
          />
        )}
        {!signedUrl && !loading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 p-1">
            <svg className="w-6 h-6 text-muted-foreground/50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm0 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
            </svg>
            <p className="text-[10px] text-muted-foreground text-center leading-tight break-all">{photo.file_name}</p>
          </div>
        )}
        <span className="absolute bottom-0 inset-x-0 bg-black/55 px-1.5 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-between gap-1">
          <span className="text-[10px] text-white truncate">{photo.file_name}</span>
          {onOpen && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-white shrink-0">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              View
            </span>
          )}
        </span>
      </button>
      {onDelete && (
        <button
          type="button"
          onClick={() => onDelete(photo.id)}
          title="Remove this photo"
          aria-label={`Delete ${photo.file_name}`}
          className="absolute top-1 right-1 z-10 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity hover:bg-red-600"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}
