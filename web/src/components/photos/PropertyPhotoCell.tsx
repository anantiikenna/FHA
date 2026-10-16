"use client";
import { useState } from "react";
import { SafeImg } from "@/components/ui/safe-img";
import { AreaPhotosLightbox } from "./AreaPhotosLightbox";

/**
 * Clickable evidence-photo cell for list rows. Opens the shared full-screen
 * viewer, which fetches the photos fresh from the API so every reviewer
 * inspects the same current evidence.
 */
export function PropertyPhotoCell({
  areaId,
  areaName,
  photoUrl,
  size = "w-20 h-20",
}: {
  areaId: string;
  areaName: string;
  photoUrl?: string;
  size?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`View evidence photos for ${areaName}`}
        title="View photo in full size"
        className={`relative ${size} rounded-lg overflow-hidden bg-muted border border-border shrink-0 group cursor-zoom-in`}
      >
        {photoUrl ? (
          <SafeImg
            src={photoUrl}
            alt={`Photo of ${areaName}`}
            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
          />
        ) : (
          <svg className="w-6 h-6 text-muted-foreground/40 m-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M13.5 12h.008v.008H13.5V12zm0 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
          </svg>
        )}
        <span className="absolute bottom-0 inset-x-0 bg-black/55 px-1.5 py-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-1">
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
          </svg>
          <span className="text-[10px] font-semibold text-white">View</span>
        </span>
      </button>
      {open && (
        <AreaPhotosLightbox
          areaId={areaId}
          areaName={areaName}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
