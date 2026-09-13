"use client";

import * as React from "react";

export function ServiceWorkerRegistrar() {
  React.useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // Only reload for service worker *updates*, never on the first install.
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    const handleControllerChange = () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener("controllerchange", handleControllerChange);

    const timer = window.setTimeout(() => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => registration.update())
        .catch(() => undefined);
    }, 1500);

    return () => {
      window.clearTimeout(timer);
      navigator.serviceWorker.removeEventListener("controllerchange", handleControllerChange);
    };
  }, []);
  return null;
}
