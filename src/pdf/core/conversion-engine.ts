import { PdfError } from "@/pdf/config/errors";
import type { PdfPageModel } from "@/pdf/types";
import { dataUrlToBytes, type ImageFormat } from "./image";
import { computePlacement, getPageSizePreset, type ImagePlacement, type PageOrientation, type PageSizePreset } from "./layout";
import { renderPageToBlob } from "./render-engine";

export type ImageOutputFormat = "png" | "jpeg" | "webp";
export type QualityPreset = "standard" | "high" | "very-high";

export const QUALITY_PRESETS: Record<QualityPreset, { dpi: number; label: string }> = {
  standard: { dpi: 96, label: "Standard (96 DPI)" },
  high: { dpi: 150, label: "High (150 DPI)" },
  "very-high": { dpi: 300, label: "Very high (300 DPI)" },
};

export interface ConvertedPage {
  pageNumber: number;
  blob: Blob;
  width: number;
  height: number;
}

export interface PdfToImagesOptions {
  cacheKey: string;
  bytes: Uint8Array;
  pages: PdfPageModel[];
  format: ImageOutputFormat;
  qualityPreset: QualityPreset;
  dpi?: number;
  jpegQuality?: number;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export async function convertPdfToImages(options: PdfToImagesOptions): Promise<ConvertedPage[]> {
  const dpi = options.dpi ?? QUALITY_PRESETS[options.qualityPreset].dpi;
  const scale = dpi / 72;
  const quality =
    options.format === "png" ? undefined : (options.jpegQuality ?? (options.format === "webp" ? 0.8 : 0.85));
  const results: ConvertedPage[] = [];

  for (let index = 0; index < options.pages.length; index += 1) {
    if (options.signal?.aborted) throw new PdfError("OPERATION_CANCELLED");
    const page = options.pages[index];
    try {
      const rendered = await renderPageToBlob({
        cacheKey: `${options.cacheKey}:convert:${page.id}`,
        bytes: options.bytes,
        pageIndex: page.sourcePageIndex,
        rotation: page.rotation,
        scale,
        type: `image/${options.format}` as const,
        quality,
        signal: options.signal,
        background: "#ffffff",
      });
      results.push({
        pageNumber: index + 1,
        blob: rendered.blob,
        width: rendered.width,
        height: rendered.height,
      });
    } catch (error) {
      if (error instanceof PdfError) throw error;
      throw new PdfError("CONVERSION_FAILED", `Page ${index + 1} could not be converted.`, {
        cause: error,
      });
    }
    options.onProgress?.(index + 1, options.pages.length);
  }
  return results;
}

export interface SourceImage {
  dataUrl: string;
  format: ImageFormat;
  width: number;
  height: number;
}

export interface ImageToPdfOptions {
  images: SourceImage[];
  pageSize: PageSizePreset["id"];
  orientation: PageOrientation | "auto";
  placement: ImagePlacement;
  margin: number;
  background: string;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
}

export async function imagesToPdf(options: ImageToPdfOptions): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");
  const out = await PDFDocument.create();

  for (let index = 0; index < options.images.length; index += 1) {
    if (options.signal?.aborted) throw new PdfError("OPERATION_CANCELLED");
    const source = options.images[index];
    let pageWidth: number;
    let pageHeight: number;

    if (options.pageSize === "original") {
      pageWidth = Math.max(1, source.width * 0.75);
      pageHeight = Math.max(1, source.height * 0.75);
    } else {
      const preset = getPageSizePreset(options.pageSize);
      const landscape =
        options.orientation === "auto"
          ? source.width > source.height
          : options.orientation === "landscape";
      pageWidth = landscape ? preset.height : preset.width;
      pageHeight = landscape ? preset.width : preset.height;
    }

    const page = out.addPage([pageWidth, pageHeight]);
    const background = options.background;
    const bg = parseHex(background);
    if (bg) page.drawRectangle({ x: 0, y: 0, width: pageWidth, height: pageHeight, color: rgb(bg.r, bg.g, bg.b) });

    const bytes = dataUrlToBytes(source.dataUrl);
    const image =
      source.format === "jpeg" ? await out.embedJpg(bytes) : await out.embedPng(bytes);
    const placement = computePlacement({
      pageWidth,
      pageHeight,
      imageWidth: source.width,
      imageHeight: source.height,
      placement: options.placement,
      margin: options.margin,
    });
    page.drawImage(image, {
      x: placement.x,
      y: placement.y,
      width: placement.width,
      height: placement.height,
    });
    options.onProgress?.(index + 1, options.images.length);
  }

  return out.save({ useObjectStreams: true });
}

function parseHex(hex: string): { r: number; g: number; b: number } | undefined {
  const normalized = hex.replace("#", "").trim();
  if (!/^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(normalized)) return undefined;
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const value = Number.parseInt(expanded, 16);
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}
