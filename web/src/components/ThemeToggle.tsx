"use client";

import { useSyncExternalStore } from "react";

const CHANGE_EVENT = "fha:theme-change";

function subscribe(callback: () => void) {
  // Same-tab toggles notify via CHANGE_EVENT; other tabs via the storage event.
  window.addEventListener(CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

function getSnapshot() {
  return document.documentElement.classList.contains("dark");
}

function getServerSnapshot() {
  return false;
}

/**
 * Light/Dark theme switch. Toggles the `dark` class on <html> (class-based
 * dark mode in globals.css) and persists the choice in localStorage
 * (`fha:theme`). Initial state comes from the no-flash inline script in the
 * root layout (stored value, else OS preference).
 */
export function ThemeToggle({ className = "", showLabel = false }: { className?: string; showLabel?: boolean }) {
  const dark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function toggle() {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("fha:theme", next ? "dark" : "light");
    } catch {
      /* storage blocked — theme still applies for this page view */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }

  const label = dark ? "Switch to light theme" : "Switch to dark theme";
  const base = showLabel
    ? "w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-150"
    : "w-9 h-9 rounded-lg flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`${base} ${className}`}
    >
      {dark ? (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      ) : (
        <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      )}
      {showLabel && <span>{dark ? "Light theme" : "Dark theme"}</span>}
    </button>
  );
}
