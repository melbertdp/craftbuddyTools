const CACHE_NAME = "craftbuddy-v4";
const APP_SHELL = ["/", "/pdf", "/icon-192.png", "/icon-512.png", "/manifest.webmanifest"];

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone()).catch(() => undefined);
    }
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    throw error;
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL).catch(() => undefined)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Never cache API responses or document-processing endpoints.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      networkFirst(request).catch(() => caches.match("/").then((cached) => cached ?? caches.match("/pdf"))),
    );
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png" ||
    url.pathname === "/apple-icon.png"
  ) {
    event.respondWith(networkFirst(request));
  }
});
