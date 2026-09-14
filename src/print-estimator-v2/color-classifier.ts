import type { V2ColorClass, V2PixelMetrics, V2Thresholds } from "./types";

export interface ColorClassification {
  colorClass: V2ColorClass;
  /** Distance to the nearest threshold boundary, 0..1. Larger = more certain. */
  boundaryDistance: number;
}

/**
 * Primary signal is colorCoverage; saturation, ink coverage and background
 * soften tiny-but-saturated marks (e.g. a small logo on a B&W exam page).
 */
export function classifyColor(metrics: V2PixelMetrics, t: V2Thresholds): ColorClassification {
  const { colorCoverage, averageSaturation, inkCoverage, whiteCoverage } = metrics;

  // Discount tiny saturated specks: effective color must carry some weight
  // relative to total ink, unless saturation is very strong.
  const inkShare = inkCoverage > 0 ? colorCoverage / inkCoverage : 0;
  const tinySpeckPenalty =
    colorCoverage > 0 && colorCoverage < 0.03 && inkShare < 0.25 && averageSaturation < 0.2;
  const effectiveColor = tinySpeckPenalty ? colorCoverage * 0.5 : colorCoverage;

  // Very low saturation overall pushes borderline pages down one tier.
  const desaturated = averageSaturation < 0.04 && whiteCoverage > 0.9;

  // boundaryDistance is 0.0 sitting exactly on a threshold and 1.0 as far
  // from any threshold as the tier allows (tier mid-point, or zero color
  // for B&W). Normalizing by half-span keeps mid-tier pages near 1.0.
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  let colorClass: V2ColorClass;
  let boundaryDistance: number;
  if (effectiveColor < t.bwMaxColorCoverage) {
    colorClass = "BW";
    boundaryDistance = 1 - effectiveColor / t.bwMaxColorCoverage;
  } else if (effectiveColor < t.lightMaxColorCoverage) {
    colorClass = "LIGHT";
    const halfSpan = (t.lightMaxColorCoverage - t.bwMaxColorCoverage) / 2;
    const nearest = Math.min(
      effectiveColor - t.bwMaxColorCoverage,
      t.lightMaxColorCoverage - effectiveColor,
    );
    boundaryDistance = halfSpan > 0 ? nearest / halfSpan : 1;
  } else if (effectiveColor < t.semiMaxColorCoverage) {
    colorClass = "SEMI";
    const halfSpan = (t.semiMaxColorCoverage - t.lightMaxColorCoverage) / 2;
    const nearest = Math.min(
      effectiveColor - t.lightMaxColorCoverage,
      t.semiMaxColorCoverage - effectiveColor,
    );
    boundaryDistance = halfSpan > 0 ? nearest / halfSpan : 1;
  } else {
    colorClass = "FULL";
    // Saturates 20 points of coverage above the Semi threshold.
    boundaryDistance = (effectiveColor - t.semiMaxColorCoverage) / 0.2;
  }

  if (desaturated && (colorClass === "LIGHT" || colorClass === "SEMI")) {
    colorClass = colorClass === "LIGHT" ? "BW" : "LIGHT";
  }

  return { colorClass, boundaryDistance: clamp01(boundaryDistance) };
}
