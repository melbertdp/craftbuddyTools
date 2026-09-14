import type { V2ContentClass, V2PixelMetrics, V2Thresholds } from "./types";

export interface LayoutBox {
  x: number;
  y: number;
  width: number;
  height: number;
  kind: "text" | "image";
  confidence?: number;
}

export interface ContentClassification {
  contentClass: V2ContentClass;
  textCoverage: number;
  imageCoverage: number;
  imageShare: number;
  boundaryDistance: number;
}

/** Union area of boxes via inclusion with pairwise overlap subtraction approximation. */
export function unionArea(boxes: LayoutBox[], pageArea: number): number {
  if (boxes.length === 0 || pageArea <= 0) return 0;
  const clamped = boxes
    .map((b) => ({ ...b, width: Math.max(0, b.width), height: Math.max(0, b.height) }))
    .filter((b) => b.width > 0 && b.height > 0);
  let total = clamped.reduce((sum, b) => sum + b.width * b.height, 0);
  // Subtract pairwise overlaps (first-order correction; avoids double counting).
  for (let i = 0; i < clamped.length; i += 1) {
    for (let j = i + 1; j < clamped.length; j += 1) {
      const a = clamped[i];
      const b = clamped[j];
      const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
      const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
      total -= xOverlap * yOverlap;
    }
  }
  return Math.max(0, Math.min(pageArea, total));
}

export function classifyContentFromCoverage(
  textCoverage: number,
  imageCoverage: number,
  metrics: V2PixelMetrics,
  t: V2Thresholds,
): ContentClassification {
  const detected = textCoverage + imageCoverage;
  const imageShare = detected > 0 ? imageCoverage / detected : 0;

  // Scanned-document heuristic: one giant gray "image" that is really B&W text.
  const isScanned =
    imageCoverage > t.scannedImageCoverage &&
    metrics.colorCoverage < t.scannedMaxColorCoverage &&
    metrics.inkCoverage < t.scannedMaxInkCoverage &&
    metrics.whiteCoverage > 0.5;
  if (isScanned) {
    return { contentClass: "SCANNED", textCoverage, imageCoverage, imageShare, boundaryDistance: 0.4 };
  }

  let contentClass: V2ContentClass;
  let boundary: number;
  if (imageShare < t.textMaxImageShare) {
    contentClass = "TEXT";
    boundary = t.textMaxImageShare - imageShare;
  } else if (imageShare > t.imageMinImageShare) {
    contentClass = "IMAGE";
    boundary = imageShare - t.imageMinImageShare;
  } else {
    contentClass = "MIXED";
    boundary = Math.min(imageShare - t.textMaxImageShare, t.imageMinImageShare - imageShare);
  }
  const span =
    contentClass === "MIXED"
      ? (t.imageMinImageShare - t.textMaxImageShare) / 2
      : contentClass === "TEXT"
        ? t.textMaxImageShare
        : 1 - t.imageMinImageShare;
  return {
    contentClass,
    textCoverage,
    imageCoverage,
    imageShare,
    boundaryDistance: span > 0 ? Math.max(0, Math.min(1, boundary / span)) : 1,
  };
}

/**
 * Fallback when the layout model asset is unavailable. Uses pixel signals to
 * estimate an image share; clearly approximate and flagged as heuristic.
 */
export function heuristicCoverage(metrics: V2PixelMetrics): { textCoverage: number; imageCoverage: number } {
  const ink = metrics.inkCoverage;
  if (ink <= 0.005) return { textCoverage: 0, imageCoverage: 0 };
  // Dense, dark, low-saturation ink reads as text; saturated spread reads as image.
  const imageLikelihood = Math.max(
    0,
    Math.min(
      1,
      metrics.coloredInkCoverage * 0.9 + Math.max(0, ink - 0.25) * 1.4 - metrics.darkPixelCoverage * 0.4,
    ),
  );
  const imageCoverage = ink * imageLikelihood;
  const textCoverage = Math.max(0, ink - imageCoverage);
  return { textCoverage, imageCoverage };
}
