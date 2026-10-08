"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

const SEEN_KEY = "fha:map-help-dismissed";
const CHANGE_EVENT = "fha:map-help-seen-change";

function subscribe(onStoreChange: () => void) {
  const local = () => onStoreChange();
  window.addEventListener("storage", local);
  window.addEventListener(CHANGE_EVENT, local);
  return () => {
    window.removeEventListener("storage", local);
    window.removeEventListener(CHANGE_EVENT, local);
  };
}

function getDismissedSnapshot() {
  try {
    return localStorage.getItem(SEEN_KEY) === "1";
  } catch {
    return false;
  }
}

function getServerSnapshot() {
  return true;
}

function markSeen() {
  try {
    localStorage.setItem(SEEN_KEY, "1");
  } catch { /* storage unavailable */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "1 — Explore",
    items: [
      "Search (top): type a plot number (2+ characters) or a place (3+ characters), then pick a result to fly there — click the marker to open its details.",
      "Color by (left card): switch markers between Approval and Inspection status. Outer ring = current mode, inner dot = the other status.",
      "Satellite / Street (bottom-left): toggle imagery; an opacity slider appears in satellite view.",
      "My Location: flies the map to your GPS position (browser will ask for permission).",
      "Saved Areas (bottom-right): every drawn area — click a row to open it.",
    ],
  },
  {
    title: "2 — Mark an area",
    items: [
      "Draw Polygon (click 3+ points, close on the first) or Draw Box (2 corners). While drawing: Undo, Cancel, Done.",
      "Done opens Save This Area — pick a type and a name, then Save Area.",
      "Zone: an active container. Properties and plots drawn inside it link to it automatically.",
      "Property: leaf area — an outcome requires at least one photo. Plot: leaf area — photo optional.",
      "After saving, the area panel opens automatically. Press Select (toolbar) to return to normal browsing.",
    ],
  },
  {
    title: "3 — Record an outcome",
    items: [
      "Open a Property or Plot area, then Add Photo (JPG/PNG up to 10 MB; GPS is stamped automatically).",
      "Pick one of four outcomes: Approved, Unoccupied, Unapproved, or Set for Demolition.",
      "The status updates immediately and photos lock — pick another option to re-record.",
      "Activity in the panel shows who recorded what and when.",
      "Outcomes are field observations / recommendations — not enforcement decisions.",
    ],
  },
  {
    title: "4 — Who can do what",
    items: [
      "Draw an area: any active account.",
      "Record an outcome: ADMIN / SUPERVISOR / GIS_OFFICER anywhere; other roles only on areas they drew.",
      "Delete: ADMIN / SUPERVISOR / GIS_OFFICER (cascades to nested areas); owners only while the area still has no outcome.",
    ],
  },
];

export default function MapHelp() {
  const [open, setOpen] = useState(false);
  const dismissed = useSyncExternalStore(subscribe, getDismissedSnapshot, getServerSnapshot);
  const hintVisible = !dismissed && !open;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className="relative shrink-0 text-right">
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="How to use this map"
        aria-label="How to use this map"
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-surface text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shadow-sm"
      >
        <span className="w-4 h-4 rounded-full border border-current text-[10px] leading-none inline-flex items-center justify-center">?</span>
        How to use this map
      </button>

      {hintVisible && (
        <div className="ml-auto mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-brand/30 bg-surface shadow-xl p-4 text-left animate-in fade-in slide-in-from-top-2 duration-300">
          <p className="text-xs font-semibold text-foreground mb-1">New to this map?</p>
          <p className="text-xs text-muted-foreground leading-relaxed mb-3">
            Take the quick tour: search plots, draw and name an area, attach a photo and record a
            property outcome — about one minute.
          </p>
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={markSeen}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              Got it
            </button>
            <button
              type="button"
              onClick={() => {
                markSeen();
                setOpen(true);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-light transition-colors shadow-sm shadow-brand/20"
            >
              Show me
            </button>
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="map-help-title"
            className="bg-white dark:bg-surface rounded-2xl shadow-2xl border border-border w-full max-w-xl max-h-[85vh] flex flex-col animate-in zoom-in-95 fade-in duration-200"
          >
            <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-border shrink-0">
              <div className="text-left">
                <h3 id="map-help-title" className="text-lg font-bold text-foreground">
                  Using the Estate Map
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Drawing, photos and property outcomes — the short version.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close help"
                className="w-8 h-8 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors text-lg leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-4 overflow-y-auto space-y-5 text-left">
              {SECTIONS.map((section) => (
                <div key={section.title}>
                  <p className="text-xs font-semibold uppercase text-muted-foreground mb-2">
                    {section.title}
                  </p>
                  <ul className="space-y-1.5">
                    {section.items.map((item) => (
                      <li key={item} className="text-sm text-foreground/90 leading-relaxed flex gap-2">
                        <span className="mt-2 w-1.5 h-1.5 rounded-full bg-brand/60 shrink-0" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground border-t border-border pt-3">
                Demo / sample data — not an official FHA record. Outcomes are field observations,
                never enforcement decisions.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-brand text-white hover:bg-brand-light transition-colors shadow-md shadow-brand/20"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
