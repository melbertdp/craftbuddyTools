import type { V2PixelMetrics, V2Thresholds } from "./types";

export interface PixelAnalyzerOptions {
  backgroundLevel: number;
  colorChromaThreshold: number;
  colorSaturationThreshold: number;
}

export function optionsFromThresholds(t: V2Thresholds): PixelAnalyzerOptions {
  return {
    backgroundLevel: t.backgroundLevel,
    colorChromaThreshold: t.colorChromaThreshold,
    colorSaturationThreshold: t.colorSaturationThreshold,
  };
}

/** Analyze raw RGBA pixels. Pure function: no DOM, unit-testable. */
export function analyzePixels(
  data: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number,
  options: PixelAnalyzerOptions,
): V2PixelMetrics {
  const total = Math.max(1, width * height);
  let ink = 0;
  let colored = 0;
  let bw = 0;
  let dark = 0;
  let saturationSum = 0;
  let brightnessSum = 0;

  const bg = options.backgroundLevel;
  const chromaThreshold = options.colorChromaThreshold;
  const saturationThreshold = options.colorSaturationThreshold;

  for (let i = 0; i + 3 < data.length + 1 && i / 4 < total; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const chroma = max - min;
    const saturation = max === 0 ? 0 : chroma / max;
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    saturationSum += saturation;
    brightnessSum += brightness;

    const isBackground = r >= bg && g >= bg && b >= bg;
    if (isBackground) continue;

    ink += 1;
    const isColored = chroma > chromaThreshold && saturation > saturationThreshold;
    if (isColored) {
      colored += 1;
    } else {
      bw += 1;
    }
    if (brightness < 0.25) dark += 1;
  }

  const inkCoverage = ink / total;
  const colorCoverage = colored / total;
  const bwCoverage = bw / total;
  return {
    inkCoverage,
    colorCoverage,
    bwCoverage,
    whiteCoverage: Math.max(0, Math.min(1, 1 - inkCoverage)),
    averageSaturation: saturationSum / total,
    averageBrightness: brightnessSum / total,
    darkPixelCoverage: dark / total,
    coloredInkCoverage: ink > 0 ? colored / ink : 0,
  };
}

/** Analyze an ImageData-like object without touching the DOM. */
export function analyzeImageData(
  image: { data: Uint8ClampedArray | Uint8Array; width: number; height: number },
  options: PixelAnalyzerOptions,
): V2PixelMetrics {
  return analyzePixels(image.data, image.width, image.height, options);
}
