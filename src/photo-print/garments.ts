export type { GarmentMeta } from "./autofit";
import type { GarmentMeta } from "./autofit";

export const DEFAULT_GARMENT_META: GarmentMeta = {
  anchor: { x: 0.5, y: 0.5 },
  shoulderFraction: 0.85,
};

const OPAQUE = 16;
const CACHE_SIZE = 256;
const SHOULDER_WIDTH_RATIO = 0.85;

const cache = new Map<string, GarmentMeta>();

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

/**
 * Reads the garment's alpha channel to find the shoulder line: the point in
 * the bitmap where the garment is wide enough to be the shoulders. Auto Fit
 * places this point on the person's shoulder line, which keeps the collar at
 * the neck. Measuring the shoulder line (rather than the collar tips) matters
 * because collar points sit well above the shoulders on collared shirts.
 */
function analyze(image: HTMLImageElement): GarmentMeta | null {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  if (!naturalWidth || !naturalHeight) return null;
  const scale = Math.min(
    1,
    CACHE_SIZE / Math.max(naturalWidth, naturalHeight),
  );
  const width = Math.max(1, Math.round(naturalWidth * scale));
  const height = Math.max(1, Math.round(naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(image, 0, 0, width, height);
  const { data } = context.getImageData(0, 0, width, height);
  const alphaAt = (x: number, y: number) => data[(y * width + x) * 4 + 3];

  let top = -1;
  let bottom = -1;
  for (let y = 0; y < height && top < 0; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) > OPAQUE) {
        top = y;
        break;
      }
    }
  }
  if (top < 0) return null;
  for (let y = height - 1; y >= 0 && bottom < 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) > OPAQUE) {
        bottom = y;
        break;
      }
    }
  }
  if (bottom < top) return null;

  const garmentHeight = Math.max(1, bottom - top);
  const upperEnd = Math.min(
    bottom,
    top + Math.round(garmentHeight * 0.6),
  );
  const rowBounds = (y: number) => {
    let first = -1;
    let last = -1;
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) > OPAQUE) {
        if (first < 0) first = x;
        last = x;
      }
    }
    return first < 0 ? null : { first, last, rowWidth: last - first + 1 };
  };

  let widest = 0;
  for (let y = top; y <= upperEnd; y += 1) {
    const bounds = rowBounds(y);
    if (bounds && bounds.rowWidth > widest) widest = bounds.rowWidth;
  }
  if (widest <= 0) return null;

  let shoulderY = top;
  let shoulderRow = rowBounds(top);
  for (let y = top; y <= upperEnd; y += 1) {
    const bounds = rowBounds(y);
    if (bounds && bounds.rowWidth >= SHOULDER_WIDTH_RATIO * widest) {
      shoulderY = y;
      shoulderRow = bounds;
      break;
    }
  }
  if (!shoulderRow) return null;

  return {
    anchor: {
      x: clamp01((shoulderRow.first + shoulderRow.last) / 2 / width),
      y: clamp01(shoulderY / height),
    },
    shoulderFraction: Math.min(1.25, shoulderRow.rowWidth / width),
  };
}

export function deriveGarmentMeta(image: HTMLImageElement): GarmentMeta {
  const key = image.currentSrc || image.src;
  const cached = cache.get(key);
  if (cached) return cached;
  const meta = analyze(image) ?? DEFAULT_GARMENT_META;
  cache.set(key, meta);
  return meta;
}

export function isTransparent(image: HTMLImageElement): boolean {
  const naturalWidth = image.naturalWidth;
  const naturalHeight = image.naturalHeight;
  if (!naturalWidth || !naturalHeight) return false;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return true;
  context.drawImage(image, 0, 0, 32, 32);
  const { data } = context.getImageData(0, 0, 32, 32);
  for (let index = 3; index < data.length; index += 4) {
    if (data[index] < 250) return true;
  }
  return false;
}
