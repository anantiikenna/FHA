"use client";

import { useEffect } from "react";

/**
 * Keeps the `dark` class on <html> consistent with the stored choice (or OS
 * preference). The no-flash inline script in the root layout applies the theme
 * before paint, but on hosts where pages are client-rendered instead of
 * hydrated (e.g. Netlify's BAILOUT_TO_CLIENT_SIDE_RENDERING), React recreates
 * <html> and wipes the script-applied class. This component re-applies it
 * after React renders and watches for further wipes.
 */
export function ThemeSync() {
  useEffect(() => {
    const apply = () => {
      try {
        const stored = localStorage.getItem("fha:theme");
        const dark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
        document.documentElement.classList.toggle("dark", dark);
      } catch {
        /* storage blocked — leave class as-is */
      }
    };

    apply();

    const observer = new MutationObserver(() => {
      const stored = localStorage.getItem("fha:theme");
      const shouldBeDark = stored ? stored === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = document.documentElement.classList.contains("dark");
      if (shouldBeDark !== isDark) apply();
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["className", "class"] });

    return () => observer.disconnect();
  }, []);

  return null;
}
