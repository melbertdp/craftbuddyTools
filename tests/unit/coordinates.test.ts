import { describe, expect, it } from "vitest";
import {
  displaySize,
  displayToPdfMatrix,
  displayedToPdf,
  normalizeRotation,
  normalizedToPdf,
  pdfToDisplayed,
  pdfToNormalized,
  viewportToNormalized,
} from "@/pdf/core/coordinates";
import type { Rotation } from "@/pdf/types";

const ROTATIONS: Rotation[] = [0, 90, 180, 270];

describe("coordinates", () => {
  it("computes displayed sizes", () => {
    expect(displaySize(600, 800, 0)).toEqual({ width: 600, height: 800 });
    expect(displaySize(600, 800, 180)).toEqual({ width: 600, height: 800 });
    expect(displaySize(600, 800, 90)).toEqual({ width: 800, height: 600 });
    expect(displaySize(600, 800, 270)).toEqual({ width: 800, height: 600 });
  });

  it("round-trips normalized <-> pdf for every rotation", () => {
    const points = [
      [0, 0],
      [1, 1],
      [0.25, 0.75],
      [0.5, 0.5],
    ];
    for (const rotation of ROTATIONS) {
      for (const [nx, ny] of points) {
        const pdf = normalizedToPdf(nx, ny, 600, 800, rotation);
        const back = pdfToNormalized(pdf.x, pdf.y, 600, 800, rotation);
        expect(back.x).toBeCloseTo(nx, 6);
        expect(back.y).toBeCloseTo(ny, 6);
      }
    }
  });

  it("maps corners to expected PDF space", () => {
    expect(normalizedToPdf(0, 0, 600, 800, 0)).toEqual({ x: 0, y: 800 });
    expect(normalizedToPdf(1, 1, 600, 800, 0)).toEqual({ x: 600, y: 0 });
    expect(displayedToPdf(0, 400, 600, 800, 90)).toEqual({ x: 200, y: 0 });
  });

  it("produces invertible matrices", () => {
    for (const rotation of ROTATIONS) {
      const matrix = displayToPdfMatrix(600, 800, rotation);
      const [a, b, c, d, e, f] = matrix;
      const determinant = a * d - b * c;
      expect(Math.abs(determinant)).toBeCloseTo(1, 6);
      expect(Number.isFinite(e + f)).toBe(true);
    }
  });

  it("normalizes arbitrary rotations", () => {
    expect(normalizeRotation(0)).toBe(0);
    expect(normalizeRotation(359)).toBe(0);
    expect(normalizeRotation(-90)).toBe(270);
    expect(normalizeRotation(450)).toBe(90);
    expect(normalizeRotation(180)).toBe(180);
  });

  it("converts between viewport pixels and normalized coordinates", () => {
    const normalized = viewportToNormalized(50, 100, 200, 400);
    expect(normalized).toEqual({ x: 0.25, y: 0.25 });
  });

  it("matches pdfToDisplayed inverse", () => {
    const displayed = pdfToDisplayed(200, 300, 600, 800, 90);
    expect(displayed).toEqual({ dx: 300, dy: 400 });
  });
});
