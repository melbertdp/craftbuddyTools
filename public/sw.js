const CACHE_NAME = "craftbuddy-v5";
const PDF_TOOLS = [
  "edit",
  "sign",
  "organize",
  "merge",
  "split",
  "extract",
  "delete-pages",
  "rotate",
  "pdf-to-jpg",
  "pdf-to-png",
  "pdf-to-webp",
  "jpg-to-pdf",
  "png-to-pdf",
  "images-to-pdf",
  "watermark",
  "page-numbers",
  "metadata",
  "compress",
];
const LOCAL_ASSETS = [
  "/models/movenet-lightning.onnx",
  "/models/hivision_modnet.onnx",
  "/ort/ort-wasm-simd-threaded.wasm",
  "/ort/ort-wasm-simd-threaded.mjs",
  "/ort/ort-wasm-simd-threaded.jspi.wasm",
  "/ort/ort-wasm-simd-threaded.jspi.mjs",
  "/ort/ort-wasm-simd-threaded.jsep.wasm",
  "/ort/ort-wasm-simd-threaded.jsep.mjs",
  "/ort/ort-wasm-simd-threaded.asyncify.wasm",
  "/ort/ort-wasm-simd-threaded.asyncify.mjs",
];
const APP_SHELL = [
  "/",
  "/pdf",
  ...PDF_TOOLS.map((tool) => `/pdf/${tool}`),
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
  ...LOCAL_ASSETS,
];

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
    url.pathname.startsWith("/models/") ||
    url.pathname.startsWith("/ort/") ||
    url.pathname.startsWith("/overlays/") ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png" ||
    url.pathname === "/apple-icon.png"
  ) {
    event.respondWith(networkFirst(request));
  }
});
