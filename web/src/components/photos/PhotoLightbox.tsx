"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { GoogleMapsLink } from "@/components/map/GoogleMapsLink";
import {
  isZoomed,
  pinchScale,
  stepScale,
  toggleScale,
} from "@/lib/photo-zoom";

export interface LightboxPhoto {
  id: string;
  fileName: string;
  createdAt: string;
  capturedAt?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  uploadedByName?: string | null;
}

/**
 * Full-screen evidence photo viewer. Every reviewer sees the same
 * source-of-truth photo (signed on demand via signUrl) with the same
 * provenance metadata, so field captures can be judged consistently.
 *
 * Interaction contract (UI/UX baseline):
 * - Close: Esc, backdrop click, or the Close button; focus returns to opener
 * - Navigate: ←/→ keys, Prev/Next buttons (n / N counter)
 * - Zoom: wheel, double-click, pinch, +/− buttons, 0 resets to fit
 * - Pan by dragging while zoomed; background scroll locked while open
 */
export function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
  signUrl,
  contextLabel,
}: {
  photos: LightboxPhoto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  signUrl: (photoId: string) => Promise<string>;
  contextLabel?: string;
}) {
  const photo = photos[index];
  const [urlCache] = useState(() => new Map<string, string>());
  const [signed, setSigned] = useState<{ id: string; url: string } | null>(null);
  const [failed, setFailed] = useState<{ id: string; nonce: number } | null>(null);
  const [signNonce, setSignNonce] = useState(0);

  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dialogRef = useRef<HTMLDivElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const panStateRef = useRef<{ id: number; x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; scale: number } | null>(null);

  // Sign the current photo on demand; cache so prev/next is instant.
  // Keyed on the id — parents may rebuild the photos array each render.
  // loading/error/signedUrl are DERIVED (no setState-in-effect cascades).
  const photoId = photo?.id;
  const cachedUrl = photoId ? urlCache.get(photoId) : undefined;
  const signedUrl =
    photoId == null
      ? null
      : (signed?.id === photoId
          ? signed.url
          : signNonce === 0
            ? cachedUrl
            : undefined) ?? null;
  const hasFailed = failed?.id === photoId && failed.nonce === signNonce;
  const loading = photoId != null && !signedUrl && !hasFailed;
  const error = photoId != null && hasFailed;

  useEffect(() => {
    if (!photoId) return;
    if (signed?.id === photoId) return;
    if (signNonce === 0 && urlCache.has(photoId)) return;
    let cancelled = false;
    signUrl(photoId)
      .then((url) => {
        if (cancelled) return;
        urlCache.set(photoId, url);
        setSigned({ id: photoId, url });
      })
      .catch(() => {
        if (!cancelled) setFailed({ id: photoId, nonce: signNonce });
      });
    return () => {
      cancelled = true;
    };
  }, [photoId, signed, urlCache, signUrl, signNonce]);

  // Reset zoom/pan whenever the photo changes (render-adjustment pattern —
  // avoids a setState-in-effect cascade).
  const [resetForId, setResetForId] = useState<string | undefined>(photoId);
  if (photoId !== resetForId) {
    setResetForId(photoId);
    setScale(1);
    setPan({ x: 0, y: 0 });
  }

  // Preload neighbours so prev/next feels instant.
  useEffect(() => {
    for (const neighbor of [photos[index - 1], photos[index + 1]]) {
      if (neighbor && !urlCache.has(neighbor.id)) {
        signUrl(neighbor.id)
          .then((url) => urlCache.set(neighbor.id, url))
          .catch(() => {});
      }
    }
  }, [index, photos, urlCache, signUrl]);

  // Body scroll lock + focus management.
  useEffect(() => {
    restoreFocusRef.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();
    return () => {
      document.body.style.overflow = prevOverflow;
      restoreFocusRef.current?.focus?.();
    };
  }, []);

  const go = useCallback(
    (next: number) => {
      if (next < 0 || next >= photos.length) return;
      onIndexChange(next);
    },
    [onIndexChange, photos.length]
  );

  const zoomBy = useCallback((dir: 1 | -1) => {
    setScale((s) => {
      const next = stepScale(s, dir);
      if (!isZoomed(next)) setPan({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Non-passive wheel listener so the page does not scroll behind the zoom.
  const imageAreaRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = imageAreaRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => {
        const next = stepScale(s, e.deltaY < 0 ? 1 : -1);
        if (!isZoomed(next)) setPan({ x: 0, y: 0 });
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    } else if (e.key === "ArrowLeft") go(index - 1);
    else if (e.key === "ArrowRight") go(index + 1);
    else if (e.key === "+" || e.key === "=") zoomBy(1);
    else if (e.key === "-") zoomBy(-1);
    else if (e.key === "0") resetZoom();
    else if (e.key === "Tab" && dialogRef.current) {
      // Focus trap: keep Tab cycling inside the dialog.
      const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, [tabindex]:not([tabindex="-1"])'
      );
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }

  // Drag to pan while zoomed (pointer events cover mouse + touch).
  function onPointerDown(e: React.PointerEvent) {
    if (!isZoomed(scale)) return;
    panStateRef.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function onPointerMove(e: React.PointerEvent) {
    const st = panStateRef.current;
    if (!st || st.id !== e.pointerId) return;
    setPan((p) => ({
      x: p.x + (e.clientX - st.x),
      y: p.y + (e.clientY - st.y),
    }));
    st.x = e.clientX;
    st.y = e.clientY;
  }
  function onPointerUp(e: React.PointerEvent) {
    if (panStateRef.current?.id === e.pointerId) panStateRef.current = null;
  }

  // Pinch zoom (two fingers) on touch devices.
  function touchDistance(touches: React.TouchList): number {
    const a = touches[0];
    const b = touches[1];
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function onTouchStart(e: React.TouchEvent) {
    if (e.touches.length === 2) {
      panStateRef.current = null;
      pinchRef.current = { dist: touchDistance(e.touches), scale };
    }
  }
  function onTouchMove(e: React.TouchEvent) {
    if (e.touches.length === 2 && pinchRef.current) {
      e.preventDefault();
      const ratio = touchDistance(e.touches) / pinchRef.current.dist;
      setScale(pinchScale(pinchRef.current.scale, ratio));
    } else if (
      e.touches.length === 1 &&
      isZoomed(scale) &&
      panStateRef.current
    ) {
      const t = e.touches[0];
      setPan((p) => ({
        x: p.x + (t.clientX - panStateRef.current!.x),
        y: p.y + (t.clientY - panStateRef.current!.y),
      }));
      panStateRef.current.x = t.clientX;
      panStateRef.current.y = t.clientY;
    }
  }
  function onTouchStartPan(e: React.TouchEvent) {
    if (e.touches.length === 1 && isZoomed(scale)) {
      const t = e.touches[0];
      panStateRef.current = { id: -1, x: t.clientX, y: t.clientY };
    } else {
      onTouchStart(e);
    }
  }
  function onTouchEnd() {
    pinchRef.current = null;
    panStateRef.current = null;
  }

  if (!photo) return null;

  const captured = photo.capturedAt ? new Date(photo.capturedAt) : null;
  const uploaded = photo.createdAt ? new Date(photo.createdAt) : null;
  const hasGps =
    photo.latitude != null && photo.longitude != null && !Number.isNaN(photo.latitude);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Evidence photo viewer"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 outline-none"
      data-testid="photo-lightbox"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 shrink-0">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white truncate">
            {contextLabel ? `${contextLabel} — evidence` : "Evidence photo"}
          </p>
          <p className="text-xs text-white/60 truncate">
            {index + 1} / {photos.length} · {photo.fileName}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close photo viewer"
          className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl border border-white/20 text-sm font-semibold text-white hover:bg-white/10 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
          Close
        </button>
      </div>

      {/* Body: image + metadata */}
      <div className="flex-1 min-h-0 flex flex-col md:flex-row">
        <div
          ref={imageAreaRef}
          className="relative flex-1 min-h-0 flex items-center justify-center overflow-hidden select-none"
          style={{ touchAction: isZoomed(scale) ? "none" : "auto" }}
          onDoubleClick={() => setScale((s) => toggleScale(s))}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onTouchStart={onTouchStartPan}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {loading && !signedUrl && !error && (
            <div className="flex flex-col items-center gap-3 text-white/80">
              <div className="w-8 h-8 rounded-full border-2 border-white/25 border-t-white animate-spin" />
              <p className="text-sm">Loading photo…</p>
            </div>
          )}
          {error && (
            <div className="flex flex-col items-center gap-3 px-6 text-center">
              <p className="text-sm text-white/80">
                This photo could not be loaded. The secure link may have expired.
              </p>
              <button
                type="button"
                onClick={() => {
                  urlCache.delete(photo.id);
                  setSignNonce((n) => n + 1);
                }}
                className="min-h-11 px-5 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand-light"
              >
                Try again
              </button>
            </div>
          )}
          {signedUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={signedUrl}
              alt={`Evidence photo ${index + 1} of ${photos.length}${contextLabel ? ` — ${contextLabel}` : ""}`}
              draggable={false}
              className={`max-h-full max-w-full object-contain transition-none ${
                isZoomed(scale) ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"
              }`}
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
                transformOrigin: "center center",
              }}
            />
          )}

          {/* Prev / Next */}
          {photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => go(index - 1)}
                disabled={index === 0}
                aria-label="Previous photo"
                className="absolute left-3 top-1/2 -translate-y-1/2 min-w-11 min-h-11 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-30 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => go(index + 1)}
                disabled={index === photos.length - 1}
                aria-label="Next photo"
                className="absolute right-3 top-1/2 -translate-y-1/2 min-w-11 min-h-11 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center hover:bg-black/80 disabled:opacity-30 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </>
          )}

          {/* Zoom toolbar */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-full bg-black/70 border border-white/15 p-1.5">
            <button
              type="button"
              onClick={() => zoomBy(-1)}
              aria-label="Zoom out"
              title="Zoom out"
              className="min-w-11 min-h-11 rounded-full text-white flex items-center justify-center hover:bg-white/10 text-xl font-bold"
            >
              −
            </button>
            <button
              type="button"
              onClick={resetZoom}
              aria-label="Reset zoom to fit"
              title="Reset zoom"
              className="min-h-11 px-3 rounded-full text-white text-xs font-semibold tabular-nums hover:bg-white/10"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1)}
              aria-label="Zoom in"
              title="Zoom in"
              className="min-w-11 min-h-11 rounded-full text-white flex items-center justify-center hover:bg-white/10 text-xl font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Metadata — provenance so every reviewer judges the same evidence */}
        <aside className="w-full md:w-80 shrink-0 border-t md:border-t-0 md:border-l border-white/10 overflow-y-auto max-h-[40vh] md:max-h-full p-4 space-y-3 text-sm text-white/85 bg-black/40">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-white/50">
            Photo details
          </h4>
          <dl className="space-y-2.5">
            <div>
              <dt className="text-[11px] text-white/50">File</dt>
              <dd className="break-all text-white">{photo.fileName}</dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/50">Captured</dt>
              <dd className="text-white">
                {captured ? captured.toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/50">Uploaded</dt>
              <dd className="text-white">
                {uploaded ? uploaded.toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] text-white/50">Uploaded by</dt>
              <dd className="text-white">{photo.uploadedByName ?? "—"}</dd>
            </div>
            {hasGps && (
              <div>
                <dt className="text-[11px] text-white/50">GPS location</dt>
                <dd className="text-white">
                  <span className="tabular-nums">
                    {photo.latitude!.toFixed(5)}, {photo.longitude!.toFixed(5)}
                  </span>
                  <span className="block text-[11px] text-white/50 mt-0.5">
                    Field GPS — not a cadastral survey
                  </span>
                  <GoogleMapsLink
                    latitude={photo.latitude}
                    longitude={photo.longitude}
                    label="View in Google Maps"
                    className="inline-block mt-1 text-xs font-semibold text-brand underline-offset-2 hover:underline"
                  />
                </dd>
              </div>
            )}
          </dl>
          {signedUrl && (
            <a
              href={signedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 min-h-11 px-4 rounded-xl border border-white/20 text-xs font-semibold text-white hover:bg-white/10 transition-colors"
            >
              Open original
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
              </svg>
            </a>
          )}
          <p className="text-[11px] text-white/40 leading-relaxed pt-1 border-t border-white/10">
            Keyboard: Esc closes · ←/→ switch photos · +/− zoom · 0 resets.
          </p>
        </aside>
      </div>
    </div>
  );
}
