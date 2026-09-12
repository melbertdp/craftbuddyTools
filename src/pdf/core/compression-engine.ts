import { PdfError } from "@/pdf/config/errors";
import type { PdfMetadata } from "@/pdf/types";
import { normalizeRotation } from "./coordinates";
import { renderPageToBlob } from "./render-engine";
import { applyMetadata, stripDocumentMetadata } from "./structure";

export type CompressionLevel = "low" | "recommended" | "high";

export interface CompressionOptions {
  level: CompressionLevel;
  removeMetadata?: boolean;
  downsampling?: boolean;
  jpegQuality?: number;
  targetDpi?: number;
  metadata?: PdfMetadata;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export interface CompressionResult {
  bytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  reductionRatio: number;
  method: "lossless" | "rasterized" | "none";
  message?: string;
}

export interface CompressionEngine {
  readonly id: string;
  readonly label: string;
  compress(bytes: Uint8Array, options: CompressionOptions): Promise<CompressionResult>;
}

const LEVEL_PRESETS: Record<
  CompressionLevel,
  { dpi: number; quality: number; attemptRaster: boolean }
> = {
  low: { dpi: 150, quality: 0.85, attemptRaster: false },
  recommended: { dpi: 120, quality: 0.72, attemptRaster: true },
  high: { dpi: 96, quality: 0.55, attemptRaster: true },
};

const MIN_MEANINGFUL_REDUCTION = 0.05;

async function losslessPass(
  bytes: Uint8Array,
  options: CompressionOptions,
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (options.removeMetadata) stripDocumentMetadata(pdf);
  else if (options.metadata) applyMetadata(pdf, options.metadata);
  return pdf.save({ useObjectStreams: true });
}

async function rasterizePass(
  bytes: Uint8Array,
  options: CompressionOptions,
  dpi: number,
  quality: number,
): Promise<Uint8Array | undefined> {
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  const pdfjs = await import("pdfjs-dist");
  const loadingTask = pdfjs.getDocument({ data: bytes.slice() });
  const proxy = await loadingTask.promise;
  const scale = dpi / 72;
  try {
    for (let index = 0; index < proxy.numPages; index += 1) {
      if (options.signal?.aborted) throw new PdfError("OPERATION_CANCELLED");
      // Render in the page's natural rotation at the requested resolution.
      const pageInfo = await proxy.getPage(index + 1);
      const rotation = normalizeRotation(pageInfo.rotate);
      const viewport = pageInfo.getViewport({ scale, rotation });
      const rendered = await renderPageToBlob({
        cacheKey: `compress-${dpi}-${index}`,
        bytes,
        pageIndex: index,
        rotation,
        scale,
        type: "image/jpeg",
        quality,
        signal: options.signal,
        background: "#ffffff",
      });
      const image = await out.embedJpg(new Uint8Array(await rendered.blob.arrayBuffer()));
      const page = out.addPage([viewport.width, viewport.height]);
      page.drawImage(image, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      options.onProgress?.(index + 1, proxy.numPages);
    }
    if (options.removeMetadata) stripDocumentMetadata(out);
    else if (options.metadata) applyMetadata(out, options.metadata);
    return await out.save({ useObjectStreams: true });
  } finally {
    await loadingTask.destroy();
  }
}

class PdfLibCompressionEngine implements CompressionEngine {
  readonly id = "pdf-lib-structural";
  readonly label = "Structural optimization";

  async compress(bytes: Uint8Array, options: CompressionOptions): Promise<CompressionResult> {
    const originalSize = bytes.byteLength;
    const preset = LEVEL_PRESETS[options.level];

    let best = await losslessPass(bytes, options);
    let method: CompressionResult["method"] = "lossless";

    const desiredDpi = options.targetDpi ?? preset.dpi;
    const desiredQuality = options.jpegQuality ?? preset.quality;
    const shouldRaster =
      (preset.attemptRaster || options.downsampling === true) && options.downsampling !== false;

    let rasterBytes: Uint8Array | undefined;
    if (shouldRaster) {
      rasterBytes = await rasterizePass(bytes, options, desiredDpi, desiredQuality);
      if (rasterBytes && rasterBytes.byteLength < best.byteLength) {
        best = rasterBytes;
        method = "rasterized";
      }
    }

    const compressedSize = best.byteLength;
    const reductionRatio = originalSize > 0 ? 1 - compressedSize / originalSize : 0;

    if (reductionRatio < MIN_MEANINGFUL_REDUCTION) {
      // Never hand back a larger file; prefer the smaller of original/best.
      const fallback = compressedSize < originalSize ? best : bytes;
      return {
        bytes: fallback,
        originalSize,
        compressedSize: fallback.byteLength,
        reductionRatio: originalSize > 0 ? 1 - fallback.byteLength / originalSize : 0,
        method: fallback === bytes ? "none" : method,
        message:
          "This document is already optimized. Compressing further would noticeably reduce quality, so the original is kept.",
      };
    }

    return {
      bytes: best,
      originalSize,
      compressedSize,
      reductionRatio,
      method,
    };
  }
}

export function createCompressionEngine(): CompressionEngine {
  return new PdfLibCompressionEngine();
}

export const compressionEngine: CompressionEngine = createCompressionEngine();
