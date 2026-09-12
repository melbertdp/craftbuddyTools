import { describe, expect, it } from "vitest";
import { computePlacement } from "@/pdf/core/layout";
import { formatPageNumber } from "@/pdf/core/enhancement-engine";
import { History } from "@/pdf/core/editor/history";

describe("layout placement", () => {
  it("fits an image inside the margins preserving aspect", () => {
    const placed = computePlacement({
      pageWidth: 600,
      pageHeight: 800,
      imageWidth: 1000,
      imageHeight: 500,
      placement: "fit",
      margin: 20,
    });
    expect(placed.width / placed.height).toBeCloseTo(2, 3);
    expect(placed.width).toBeLessThanOrEqual(560);
    expect(placed.x).toBeCloseTo((600 - placed.width) / 2, 3);
  });

  it("fills the page and may overflow", () => {
    const placed = computePlacement({
      pageWidth: 600,
      pageHeight: 800,
      imageWidth: 100,
      imageHeight: 100,
      placement: "fill",
      margin: 0,
    });
    expect(placed.width).toBeGreaterThanOrEqual(600);
    expect(placed.height).toBeGreaterThanOrEqual(800);
  });

  it("stretches to the available area", () => {
    const placed = computePlacement({
      pageWidth: 600,
      pageHeight: 800,
      imageWidth: 100,
      imageHeight: 100,
      placement: "stretch",
      margin: 10,
    });
    expect(placed).toEqual({ x: 10, y: 10, width: 580, height: 780 });
  });

  it("centers original size without upscaling", () => {
    const placed = computePlacement({
      pageWidth: 600,
      pageHeight: 800,
      imageWidth: 200,
      imageHeight: 100,
      placement: "original",
      margin: 0,
    });
    expect(placed.width).toBe(200);
    expect(placed.height).toBe(100);
    expect(placed.x).toBe(200);
    expect(placed.y).toBe(350);
  });
});

describe("page number formats", () => {
  it("formats each preset", () => {
    expect(formatPageNumber("n", 3, 10)).toBe("3");
    expect(formatPageNumber("page-n", 3, 10)).toBe("Page 3");
    expect(formatPageNumber("n-of-total", 3, 10)).toBe("3 of 10");
    expect(formatPageNumber("page-n-of-total", 3, 10)).toBe("Page 3 of 10");
  });
});

describe("history", () => {
  it("supports undo and redo", () => {
    const history = new History<number>(0);
    history.commit(1);
    history.commit(2);
    expect(history.canUndo).toBe(true);
    expect(history.undo()).toBe(1);
    expect(history.undo()).toBe(0);
    expect(history.canUndo).toBe(false);
    expect(history.redo()).toBe(1);
  });

  it("clears redo after a new commit", () => {
    const history = new History<number>(0);
    history.commit(1);
    history.undo();
    history.commit(5);
    expect(history.canRedo).toBe(false);
  });
});
