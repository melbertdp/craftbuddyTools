import type { Rotation } from "@/pdf/types";

/**
 * Centralized coordinate conversions between:
 * - PDF user space (points, bottom-left origin, unrotated media box)
 * - normalized display space (0..1, top-left origin, page rotation applied)
 * - viewport/canvas pixels (top-left origin, rotation applied)
 *
 * Only this module may implement these transforms.
 */

export interface DisplaySize {
  width: number;
  height: number;
}

/** Size of the page as displayed after applying its rotation. */
export function displaySize(width: number, height: number, rotation: Rotation): DisplaySize {
  return rotation === 90 || rotation === 270
    ? { width: height, height: width }
    : { width, height };
}

export function normalizeRotation(value: number): Rotation {
  const mod = ((value % 360) + 360) % 360;
  const snapped = (Math.round(mod / 90) * 90) % 360;
  if (snapped === 90) return 90;
  if (snapped === 180) return 180;
  if (snapped === 270) return 270;
  return 0;
}

/** normalized (0..1, top-left) -> viewport pixels. */
export function normalizedToViewport(
  nx: number,
  ny: number,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  return { x: nx * viewWidth, y: ny * viewHeight };
}

/** viewport pixels -> normalized (0..1, top-left). */
export function viewportToNormalized(
  px: number,
  py: number,
  viewWidth: number,
  viewHeight: number,
): { x: number; y: number } {
  return { x: viewWidth === 0 ? 0 : px / viewWidth, y: viewHeight === 0 ? 0 : py / viewHeight };
}

/**
 * normalized display point -> PDF user space point (unrotated media box).
 * `width`/`height` are the unrotated page dimensions in points.
 */
export function normalizedToPdf(
  nx: number,
  ny: number,
  width: number,
  height: number,
  rotation: Rotation,
): { x: number; y: number } {
  const display = displaySize(width, height, rotation);
  const dx = nx * display.width;
  // normalized y is top-down; convert to displayed bottom-up.
  const dy = display.height - ny * display.height;
  return displayedToPdf(dx, dy, width, height, rotation);
}

/** PDF user space point -> normalized display point. */
export function pdfToNormalized(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: Rotation,
): { x: number; y: number } {
  const display = displaySize(width, height, rotation);
  const { dx, dy } = pdfToDisplayed(x, y, width, height, rotation);
  return {
    x: display.width === 0 ? 0 : dx / display.width,
    y: display.height === 0 ? 0 : (display.height - dy) / display.height,
  };
}

/**
 * displayed point (bottom-left origin) -> PDF user space (unrotated, bottom-left origin).
 * Assumes media box origin is (0,0).
 */
export function displayedToPdf(
  dx: number,
  dy: number,
  width: number,
  height: number,
  rotation: Rotation,
): { x: number; y: number } {
  switch (rotation) {
    case 0:
      return { x: dx, y: dy };
    case 90:
      return { x: width - dy, y: dx };
    case 180:
      return { x: width - dx, y: height - dy };
    case 270:
      return { x: dy, y: height - dx };
  }
}

/** PDF user space -> displayed point (bottom-left origin). */
export function pdfToDisplayed(
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: Rotation,
): { dx: number; dy: number } {
  switch (rotation) {
    case 0:
      return { dx: x, dy: y };
    case 90:
      return { dx: y, dy: width - x };
    case 180:
      return { dx: width - x, dy: height - y };
    case 270:
      return { dx: height - y, dy: x };
  }
}

/**
 * Concat transformation matrix `[a, b, c, d, e, f]` mapping displayed points
 * (bottom-left origin) to PDF user space, for use with pdf-lib pushOperators.
 */
export function displayToPdfMatrix(
  width: number,
  height: number,
  rotation: Rotation,
): [number, number, number, number, number, number] {
  switch (rotation) {
    case 0:
      return [1, 0, 0, 1, 0, 0];
    case 90:
      return [0, 1, -1, 0, width, 0];
    case 180:
      return [-1, 0, 0, -1, width, height];
    case 270:
      return [0, -1, 1, 0, 0, height];
  }
}

export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
