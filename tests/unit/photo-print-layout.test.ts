import { describe, expect, it } from "vitest";
import { fitCropArea, hasOverlaps, orientedPaper, packPhotoItems, PAPER_SIZES } from "@/photo-print/layout";

describe("ID photo layout", () => {
  it("orients paper dimensions", () => {
    expect(orientedPaper(PAPER_SIZES.find((paper) => paper.id === "a4")!, "landscape")).toEqual({ widthMm: 297, heightMm: 210 });
  });

  it("packs mixed quantities without overlap", () => {
    const cells = packPhotoItems(210, 297, [
      { photoTypeId: "2x2in", widthMm: 50.8, heightMm: 50.8, quantity: 4 },
      { photoTypeId: "1x1in", widthMm: 25.4, heightMm: 25.4, quantity: 8 },
    ], 2, 1);
    expect(cells).toHaveLength(12);
    expect(hasOverlaps(cells)).toBe(false);
  });

  it("does not place a photo that cannot fit", () => {
    expect(packPhotoItems(30, 30, [{ photoTypeId: "passport", widthMm: 35, heightMm: 45, quantity: 1 }])).toEqual([]);
  });

  it("fills gaps when mixing sizes on a 5R sheet", () => {
    const cells = packPhotoItems(127, 177.8, [
      { photoTypeId: "2x2in", widthMm: 50.8, heightMm: 50.8, quantity: 3 },
      { photoTypeId: "1x1in", widthMm: 25.4, heightMm: 25.4, quantity: 4 },
    ], 4, 2.5);
    expect(cells).toHaveLength(7);
    expect(hasOverlaps(cells)).toBe(false);
    expect(cells.filter((cell) => cell.photoTypeId === "1x1in")).toHaveLength(4);
    const rows = new Set(cells.map((cell) => cell.yMm));
    expect(rows.size).toBeLessThanOrEqual(3);
  });

  it("re-fits a crop area to a new aspect ratio around its center", () => {
    const square = fitCropArea({ x: 100, y: 100, width: 800, height: 800 }, 0.5, 1000, 1000);
    expect(square.width).toBe(400);
    expect(square.height).toBe(800);
    expect(square.x + square.width / 2).toBe(500);
    expect(square.y + square.height / 2).toBe(500);
  });

  it("clamps the re-fitted crop area inside the image bounds", () => {
    const corner = fitCropArea({ x: 0, y: 0, width: 400, height: 400 }, 1, 1000, 1000);
    expect(corner.x).toBe(0);
    expect(corner.y).toBe(0);
    expect(corner.width).toBe(400);
    expect(corner.height).toBe(400);
  });
});
