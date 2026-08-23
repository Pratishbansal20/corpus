"use client";

import { useEffect } from "react";

// Production only, on purpose: a service worker registered under `next dev`
// tends to outlive the dev server that registered it (browsers keep it
// active across restarts), which then intercepts navigations against a
// server that's since moved on. Registering nothing in dev means there is
// nothing to unregister by hand after every restart.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Best-effort: a failed registration should never block the app.
    });
  }, []);

  return null;
}
