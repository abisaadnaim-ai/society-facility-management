"use client";

import { useEffect } from "react";

/**
 * Registers the PWA service worker and keeps installed apps current.
 *
 * Update behavior: when a new Vercel deployment ships a new service worker, we
 * tell it to activate immediately (SKIP_WAITING) and reload once it takes
 * control, so staff are never left on a stale operational build. Live data still
 * comes straight from Supabase (the SW never caches API/auth calls).
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    let reloading = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });

    const promptActivate = (reg: ServiceWorkerRegistration) => {
      const sw = reg.waiting;
      if (sw) sw.postMessage("SKIP_WAITING");
    };

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        if (reg.waiting) promptActivate(reg);
        reg.addEventListener("updatefound", () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener("statechange", () => {
            if (installing.state === "installed" && navigator.serviceWorker.controller) {
              promptActivate(reg);
            }
          });
        });
        // Check for a new deployment when the app regains focus.
        const onFocus = () => reg.update().catch(() => {});
        window.addEventListener("focus", onFocus);
      })
      .catch(() => {
        // Registration failures are non-fatal; the app works as a normal website.
      });
  }, []);

  return null;
}
