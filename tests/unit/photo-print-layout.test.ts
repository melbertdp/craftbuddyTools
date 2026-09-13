import { describe, expect, it } from "vitest";
import { hasOverlaps, orientedPaper, packPhotoItems, PAPER_SIZES } from "@/photo-print/layout";

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
});
