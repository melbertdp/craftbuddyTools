const CACHE_NAME = "craftbuddy-v6";
const TOOL_ASSET_BASE_URL = "https://toolassets.craftbuddy.app/tools";
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
const PDF_ROUTES = PDF_TOOLS.map((tool) => `/pdf/${tool}`);
const CACHE_GROUPS = {
  core: ["/"],
  pdf: ["/pdf", ...PDF_ROUTES],
  photo: [
    `${TOOL_ASSET_BASE_URL}/models/movenet-lightning.onnx`,
    `${TOOL_ASSET_BASE_URL}/models/hivision_modnet.onnx`,
    `${TOOL_ASSET_BASE_URL}/ort/ort-wasm-simd-threaded.wasm`,
    `${TOOL_ASSET_BASE_URL}/ort/ort-wasm-simd-threaded.mjs`,
    `${TOOL_ASSET_BASE_URL}/ort/ort-wasm-simd-threaded.jspi.wasm`,
    `${TOOL_ASSET_BASE_URL}/ort/ort-wasm-simd-threaded.jspi.mjs`,
    `${TOOL_ASSET_BASE_URL}/ort/ort-wasm-simd-threaded.jsep.wasm`,
    `${TOOL_ASSET_BASE_URL}/ort/ort-wasm-simd-threaded.jsep.mjs`,
    `${TOOL_ASSET_BASE_URL}/ort/ort-wasm-simd-threaded.asyncify.wasm`,
    `${TOOL_ASSET_BASE_URL}/ort/ort-wasm-simd-threaded.asyncify.mjs`,
  ],
};
const APP_SHELL = [
  "/",
  "/icon-192.png",
  "/icon-512.png",
  "/manifest.webmanifest",
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

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_OFFLINE_MODULES") return;
  const modules = Array.isArray(event.data.modules) ? event.data.modules : [];
  const urls = [...new Set(modules.flatMap((module) => CACHE_GROUPS[module] ?? []))];
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(urls.map(async (url) => {
        try {
          const response = await fetch(url, { credentials: "same-origin" });
          if (response.ok) await cache.put(url, response);
        } catch {
          // The client receives the failure through the message channel.
          throw new Error(`Could not cache ${url}`);
        }
      }));
      event.ports[0]?.postMessage({ ok: true });
    }).catch(() => {
      event.ports[0]?.postMessage({ ok: false });
    }),
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
