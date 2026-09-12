"use client";

import * as React from "react";

export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;
    const timer = window.setTimeout(() => {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, []);
  return null;
}
