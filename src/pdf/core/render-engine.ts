import { PdfError } from "@/pdf/config/errors";
import { PDF_LIMITS } from "@/pdf/config/limits";
import type { Rotation } from "@/pdf/types";
import { displaySize } from "./coordinates";
import { getPdfDocumentProxy, getPdfjs } from "./pdfjs";

export interface PageSize {
  width: number;
  height: number;
}

export async function getPageDisplaySize(
  cacheKey: string,
  bytes: Uint8Array,
  pageIndex: number,
  rotation: Rotation,
): Promise<PageSize> {
  const proxy = await getPdfDocumentProxy(cacheKey, bytes);
  try {
    const page = await proxy.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1, rotation });
    return { width: viewport.width, height: viewport.height };
  } catch (error) {
    throw new PdfError("RENDER_FAILED", undefined, { cause: error });
  }
}

interface ScaleOptions {
  scale?: number;
  targetWidth?: number;
  maxDimension?: number;
  devicePixelRatio?: number;
}

export interface ComputedScale {
  cssScale: number;
  dpr: number;
  cssWidth: number;
  cssHeight: number;
  pixelWidth: number;
  pixelHeight: number;
}

function computeScale(
  baseWidth: number,
  baseHeight: number,
  options: ScaleOptions,
): ComputedScale {
  const maxDimension = options.maxDimension ?? PDF_LIMITS.render.maxCanvasDimension;
  const maxPixels = PDF_LIMITS.render.maxCanvasPixels;

  let cssScale = options.scale ?? 1;
  if (options.targetWidth && baseWidth > 0) {
    cssScale = options.targetWidth / baseWidth;
  }

  // Clamp by max dimension.
  const longest = Math.max(baseWidth, baseHeight) * cssScale;
  if (longest > maxDimension) cssScale = maxDimension / Math.max(baseWidth, baseHeight);

  // Clamp by max pixel area.
  const dprWanted = options.devicePixelRatio ?? 1;
  let pixelWidth = baseWidth * cssScale * dprWanted;
  let pixelHeight = baseHeight * cssScale * dprWanted;
  if (pixelWidth * pixelHeight > maxPixels) {
    const factor = Math.sqrt(maxPixels / (pixelWidth * pixelHeight));
    cssScale *= factor;
    pixelWidth = baseWidth * cssScale * dprWanted;
    pixelHeight = baseHeight * cssScale * dprWanted;
  }

  return {
    cssScale,
    dpr: dprWanted,
    cssWidth: Math.max(1, Math.round(baseWidth * cssScale)),
    cssHeight: Math.max(1, Math.round(baseHeight * cssScale)),
    pixelWidth: Math.max(1, Math.round(pixelWidth)),
    pixelHeight: Math.max(1, Math.round(pixelHeight)),
  };
}

export interface RenderPageOptions extends ScaleOptions {
  cacheKey: string;
  bytes: Uint8Array;
  pageIndex: number;
  rotation: Rotation;
  signal?: AbortSignal;
  background?: string;
}

export interface RenderPageResult {
  width: number;
  height: number;
  scale: number;
  pageSize: PageSize;
}

export async function renderPageToCanvas(
  canvas: HTMLCanvasElement,
  options: RenderPageOptions,
): Promise<RenderPageResult> {
  const pdfjs = await getPdfjs();
  const proxy = await getPdfDocumentProxy(options.cacheKey, options.bytes);

  let page;
  try {
    page = await proxy.getPage(options.pageIndex + 1);
  } catch (error) {
    throw new PdfError("RENDER_FAILED", undefined, { cause: error });
  }
  if (options.signal?.aborted) throw new PdfError("OPERATION_CANCELLED");

  const base = page.getViewport({ scale: 1, rotation: options.rotation });
  const computed = computeScale(base.width, base.height, options);
  const viewport = page.getViewport({ scale: computed.cssScale, rotation: options.rotation });

  canvas.width = computed.pixelWidth;
  canvas.height = computed.pixelHeight;
  canvas.style.width = `${computed.cssWidth}px`;
  canvas.style.height = `${computed.cssHeight}px`;

  const context = canvas.getContext("2d");
  if (!context) throw new PdfError("RENDER_FAILED", "Canvas is not supported in this browser.");

  context.save();
  context.fillStyle = options.background ?? "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.restore();

  const renderTask = page.render({
    canvas,
    viewport,
    transform: computed.dpr !== 1 ? [computed.dpr, 0, 0, computed.dpr, 0, 0] : undefined,
    background: options.background ?? "#ffffff",
  });

  const onAbort = () => renderTask.cancel();
  options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    await renderTask.promise;
  } catch (error) {
    if (options.signal?.aborted) throw new PdfError("OPERATION_CANCELLED");
    throw new PdfError("RENDER_FAILED", undefined, { cause: error });
  } finally {
    options.signal?.removeEventListener("abort", onAbort);
  }

  return {
    width: computed.cssWidth,
    height: computed.cssHeight,
    scale: computed.cssScale,
    pageSize: { width: base.width, height: base.height },
  };
}

export interface RenderBlobOptions extends ScaleOptions {
  cacheKey: string;
  bytes: Uint8Array;
  pageIndex: number;
  rotation: Rotation;
  type?: "image/png" | "image/jpeg" | "image/webp";
  quality?: number;
  signal?: AbortSignal;
  background?: string;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new PdfError("CONVERSION_FAILED", "The page could not be encoded as an image."));
      },
      type,
      quality,
    );
  });
}

export async function renderPageToBlob(
  options: RenderBlobOptions,
): Promise<{ blob: Blob; width: number; height: number }> {
  const canvas = document.createElement("canvas");
  const result = await renderPageToCanvas(canvas, {
    ...options,
    background: options.background ?? "#ffffff",
  });
  const type = options.type ?? "image/png";
  try {
    const blob = await canvasToBlob(canvas, type, options.quality);
    return { blob, width: result.width, height: result.height };
  } finally {
    // Release the backing store promptly.
    canvas.width = 0;
    canvas.height = 0;
  }
}

export function displayedPageSize(
  width: number,
  height: number,
  rotation: Rotation,
): PageSize {
  return displaySize(width, height, rotation);
}
