import type { PDFDocumentProxy, PDFDocumentLoadingTask } from "pdfjs-dist";

type PdfjsModule = typeof import("pdfjs-dist");

let pdfjsPromise: Promise<PdfjsModule> | undefined;
let workerConfigured = false;

export async function getPdfjs(): Promise<PdfjsModule> {
  pdfjsPromise ??= import("pdfjs-dist").then((module) => {
    if (!workerConfigured) {
      module.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString();
      workerConfigured = true;
    }
    return module;
  });
  return pdfjsPromise;
}

interface CachedDocument {
  proxy: PDFDocumentProxy;
  loadingTask: PDFDocumentLoadingTask;
}

const documentCache = new Map<string, CachedDocument>();
const loadingPromises = new Map<string, Promise<PDFDocumentProxy>>();

export async function getPdfDocumentProxy(
  cacheKey: string,
  bytes: Uint8Array,
): Promise<PDFDocumentProxy> {
  const cached = documentCache.get(cacheKey);
  if (cached) return cached.proxy;

  const existing = loadingPromises.get(cacheKey);
  if (existing) return existing;

  const promise = (async () => {
    const pdfjs = await getPdfjs();
    const loadingTask = pdfjs.getDocument({
      data: bytes.slice(),
      useSystemFonts: true,
      disableFontFace: false,
    });
    const proxy = await loadingTask.promise;
    documentCache.set(cacheKey, { proxy, loadingTask });
    loadingPromises.delete(cacheKey);
    return proxy;
  })();

  loadingPromises.set(cacheKey, promise);
  try {
    return await promise;
  } catch (error) {
    loadingPromises.delete(cacheKey);
    throw error;
  }
}

export async function disposePdfDocument(cacheKey: string): Promise<void> {
  const cached = documentCache.get(cacheKey);
  documentCache.delete(cacheKey);
  if (cached) {
    try {
      await cached.loadingTask.destroy();
    } catch {
      // already destroyed
    }
  }
}

export async function disposeAllPdfDocuments(): Promise<void> {
  const keys = [...documentCache.keys()];
  await Promise.all(keys.map((key) => disposePdfDocument(key)));
}
