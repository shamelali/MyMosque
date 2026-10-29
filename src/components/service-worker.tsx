"use client";

import { useEffect } from "react";

export function ServiceWorker() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Registration is best-effort; the app works fully without it.
      });
    }, 1200);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
