import type { V2ClassifiedPage, V2Thresholds } from "./types";
import { analyzeImageData, optionsFromThresholds } from "./pixel-analyzer";
import { classifyColor } from "./color-classifier";
import {
  classifyContentFromCoverage,
  heuristicCoverage,
  unionArea,
  type LayoutBox,
} from "./content-classifier";
import { scoreConfidence } from "./confidence";
import { detectLayout } from "./layout-detector";
import { V2_RENDER_DPI } from "./settings";

export interface V2Progress {
  completed: number;
  total: number;
}

async function getPdfjs(): Promise<typeof import("pdfjs-dist")> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  return pdfjs;
}

function renderScaleForDpi(): number {
  return V2_RENDER_DPI / 72;
}

function clampCanvasSize(width: number, height: number): { width: number; height: number } {
  const maxSide = 2400;
  const longest = Math.max(width, height);
  if (longest <= maxSide) return { width, height };
  const factor = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * factor)),
    height: Math.max(1, Math.round(height * factor)),
  };
}

async function canvasFromPdfPage(
  pdf: { getPage(index: number): Promise<unknown> },
  pageIndex: number,
): Promise<{ canvas: HTMLCanvasElement; pageWidth: number; pageHeight: number }> {
  const page = (await pdf.getPage(pageIndex)) as {
    getViewport(params: { scale: number }): { width: number; height: number };
    render(params: { canvas: HTMLCanvasElement; viewport: unknown }): { promise: Promise<void> };
  };
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: renderScaleForDpi() });
  const clamped = clampCanvasSize(Math.round(viewport.width), Math.round(viewport.height));
  const scaleX = clamped.width / viewport.width;
  const scaledViewport = page.getViewport({ scale: renderScaleForDpi() * scaleX });
  const canvas = document.createElement("canvas");
  canvas.width = clamped.width;
  canvas.height = clamped.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported by this browser.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, viewport: scaledViewport }).promise;
  return { canvas, pageWidth: clamped.width, pageHeight: clamped.height };
}

function canvasFromImageElement(image: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, 2000 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported by this browser.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function previewFromCanvas(canvas: HTMLCanvasElement): string {
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  if (scale >= 1) return canvas.toDataURL("image/jpeg", 0.72);
  const small = document.createElement("canvas");
  small.width = Math.max(1, Math.round(canvas.width * scale));
  small.height = Math.max(1, Math.round(canvas.height * scale));
  const ctx = small.getContext("2d");
  if (!ctx) return canvas.toDataURL("image/jpeg", 0.72);
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, small.width, small.height);
  ctx.drawImage(canvas, 0, 0, small.width, small.height);
  return small.toDataURL("image/jpeg", 0.72);
}

async function classifyCanvas(
  pageNumber: number,
  canvas: HTMLCanvasElement,
  thresholds: V2Thresholds,
): Promise<V2ClassifiedPage> {
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported by this browser.");
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const metrics = analyzeImageData(
    { data: imageData.data, width: canvas.width, height: canvas.height },
    optionsFromThresholds(thresholds),
  );
  const color = classifyColor(metrics, thresholds);

  const detection = await detectLayout(canvas, canvas.width, canvas.height);
  let textCoverage = 0;
  let imageCoverage = 0;
  let modelConfidence: number | null = detection.modelConfidence;
  let layoutModel = detection.model;
  if (detection.boxes.length > 0) {
    const pageArea = Math.max(1, canvas.width * canvas.height);
    const textBoxes: LayoutBox[] = detection.boxes.filter((b) => b.kind === "text");
    const imageBoxes: LayoutBox[] = detection.boxes.filter((b) => b.kind === "image");
    textCoverage = unionArea(textBoxes, pageArea) / pageArea;
    imageCoverage = unionArea(imageBoxes, pageArea) / pageArea;
    if (textCoverage + imageCoverage < 0.01) {
      const fallback = heuristicCoverage(metrics);
      textCoverage = fallback.textCoverage;
      imageCoverage = fallback.imageCoverage;
      layoutModel = "heuristic-fallback";
      modelConfidence = null;
    }
  } else {
    const fallback = heuristicCoverage(metrics);
    textCoverage = fallback.textCoverage;
    imageCoverage = fallback.imageCoverage;
  }

  const content = classifyContentFromCoverage(textCoverage, imageCoverage, metrics, thresholds);
  const detectedCoverage = Math.min(1, textCoverage + imageCoverage);
  const conflictingSignals =
    (color.colorClass === "BW" && content.contentClass === "IMAGE" && metrics.colorCoverage > 0.05) ||
    (color.colorClass === "FULL" && content.contentClass === "TEXT" && metrics.colorCoverage < 0.03);
  const confidence = scoreConfidence({
    colorBoundaryDistance: color.boundaryDistance,
    contentBoundaryDistance: content.boundaryDistance,
    modelConfidence,
    detectedCoverage,
    conflictingSignals,
  });

  // Scanned pages price as B&W even though content is tracked as SCANNED.
  const detectedCategory = content.contentClass === "SCANNED" ? "BW" : color.colorClass;
  const reviewRecommended =
    confidence < thresholds.reviewConfidenceThreshold || content.contentClass === "SCANNED";

  return {
    pageNumber,
    ...metrics,
    colorClass: color.colorClass,
    contentClass: content.contentClass,
    detectedCategory,
    overrideCategory: null,
    finalCategory: detectedCategory,
    confidence,
    reviewRecommended,
    textCoverage,
    imageCoverage,
    layoutModel,
    previewUrl: previewFromCanvas(canvas),
    status: "complete",
  };
}

export function validateV2File(file: File): void {
  const name = file.name.toLowerCase();
  const isPdf = file.type === "application/pdf" || name.endsWith(".pdf");
  const isImage =
    file.type.startsWith("image/") ||
    name.endsWith(".png") ||
    name.endsWith(".jpg") ||
    name.endsWith(".jpeg") ||
    name.endsWith(".webp");
  if (!isPdf && !isImage) throw new Error("Upload a PDF, PNG, JPG, or WEBP file.");
  if (isPdf && file.size > 100 * 1024 * 1024) throw new Error("PDF files must be 100 MB or smaller.");
  if (!isPdf && file.size > 50 * 1024 * 1024) throw new Error("Image files must be 50 MB or smaller.");
}

export async function analyzeV2Image(
  file: File,
  thresholds: V2Thresholds,
): Promise<V2ClassifiedPage[]> {
  validateV2File(file);
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("Could not read this image."));
      value.src = url;
    });
    const canvas = canvasFromImageElement(image);
    return [await classifyCanvas(1, canvas, thresholds)];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function analyzeV2Pdf(
  file: File,
  thresholds: V2Thresholds,
  onPage?: (page: V2ClassifiedPage, progress: V2Progress) => void,
  signal?: AbortSignal,
): Promise<V2ClassifiedPage[]> {
  validateV2File(file);
  const pdfjs = await getPdfjs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const pdfDocument = await pdfjs.getDocument({ data: bytes }).promise;
  const total = pdfDocument.numPages;
  if (total < 1) throw new Error("This PDF has no pages.");
  if (total > 500) throw new Error("This PDF has too many pages for V2 (maximum 500).");
  const pages: V2ClassifiedPage[] = [];
  for (let index = 1; index <= total; index += 1) {
    if (signal?.aborted) throw new Error("Analysis was cancelled.");
    try {
      const { canvas } = await canvasFromPdfPage(pdfDocument, index);
      const classified = await classifyCanvas(index, canvas, thresholds);
      pages.push(classified);
      onPage?.(classified, { completed: index, total });
    } catch (error) {
      const failed: V2ClassifiedPage = {
        pageNumber: index,
        inkCoverage: 0,
        colorCoverage: 0,
        bwCoverage: 0,
        whiteCoverage: 1,
        averageSaturation: 0,
        averageBrightness: 1,
        darkPixelCoverage: 0,
        coloredInkCoverage: 0,
        colorClass: "BW",
        contentClass: "TEXT",
        detectedCategory: "BW",
        overrideCategory: null,
        finalCategory: "BW",
        confidence: 0.05,
        reviewRecommended: true,
        textCoverage: 0,
        imageCoverage: 0,
        layoutModel: "none",
        status: "failed",
        error: error instanceof Error ? error.message : "Page analysis failed.",
      };
      pages.push(failed);
      onPage?.(failed, { completed: index, total });
    }
    // Yield so the React UI stays responsive between pages.
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  try {
    await pdfDocument.destroy();
  } catch {
    // ignore cleanup errors
  }
  return pages;
}
