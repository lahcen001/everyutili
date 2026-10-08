"use client";

import { useEffect } from "react";

import { markUpdateReady, startAppMode } from "@/lib/appModeStore";

/**
 * Starts the "app mode" detection and registers the offline service worker (production only).
 * When a new version is waiting it tells the app so a "Reload to update" bar can appear; the page
 * then reloads once the new worker has taken over.
 */
export function AppRuntime() {
  useEffect(() => {
    startAppMode();
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;

    let reloading = false;
    const onControllerChange = () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    };
    // Only reload when we replaced an existing worker (not on the very first install).
    const hadController = !!navigator.serviceWorker.controller;
    if (hadController) navigator.serviceWorker.addEventListener("controllerchange", onControllerChange);

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          if (reg.waiting && navigator.serviceWorker.controller) markUpdateReady(reg.waiting);
          reg.addEventListener("updatefound", () => {
            const worker = reg.installing;
            worker?.addEventListener("statechange", () => {
              if (worker.state === "installed" && navigator.serviceWorker.controller) markUpdateReady(worker);
            });
          });
          // look for a new version when the app comes back to the foreground
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") void reg.update().catch(() => {});
          });
        })
        .catch(() => {});
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onControllerChange);
  }, []);
  return null;
}
