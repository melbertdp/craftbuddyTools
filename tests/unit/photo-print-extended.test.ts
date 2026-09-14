import { describe, expect, it } from "vitest";
import {
  fitCropArea,
  hasOverlaps,
  orientedPaper,
  packPhotoItems,
  PAPER_SIZES,
  PHOTO_SIZES,
} from "@/photo-print/layout";
import {
  computeAutoFit,
  MIN_KEYPOINT_SCORE,
  NECK_RAISE,
  rotateKeypoints,
  SHOULDER_FACTOR,
  type Keypoint,
} from "@/photo-print/autofit";

const kp = (x: number, y: number, score = 1): Keypoint => ({ x, y, score });
const blankKeys = () => Array.from({ length: 17 }, () => kp(0, 0, 0));

describe("fitCropArea", () => {
  it("narrows wide areas and shortens tall areas to the aspect", () => {
    const wide = fitCropArea({ x: 0, y: 0, width: 400, height: 100 }, 1, 800, 600);
    expect(wide.width / wide.height).toBeCloseTo(1, 6);
    const tall = fitCropArea({ x: 0, y: 0, width: 100, height: 400 }, 2, 800, 600);
    expect(tall.width / tall.height).toBeCloseTo(2, 6);
  });

  it("clamps to image bounds and centers", () => {
    const out = fitCropArea({ x: 700, y: 500, width: 200, height: 200 }, 1, 800, 600);
    expect(out.x + out.width).toBeLessThanOrEqual(800);
    expect(out.y + out.height).toBeLessThanOrEqual(600);
    expect(out.x).toBeGreaterThanOrEqual(0);
    const centered = fitCropArea({ x: 0, y: 0, width: 800, height: 600 }, 1, 800, 600);
    expect(centered.width).toBe(centered.height);
  });

  it("handles oversized crop requests", () => {
    const out = fitCropArea({ x: 0, y: 0, width: 2000, height: 2000 }, 1, 100, 100);
    expect(out.width).toBeLessThanOrEqual(100);
    expect(out.height).toBeLessThanOrEqual(100);
  });
});

describe("orientedPaper", () => {
  it("keeps portrait and swaps landscape for every preset", () => {
    for (const paper of PAPER_SIZES) {
      expect(orientedPaper(paper, "portrait")).toEqual({ widthMm: paper.widthMm, heightMm: paper.heightMm });
      expect(orientedPaper(paper, "landscape")).toEqual({ widthMm: paper.heightMm, heightMm: paper.widthMm });
    }
    expect(PHOTO_SIZES.length).toBeGreaterThan(0);
  });
});

describe("packPhotoItems", () => {
  it("packs a single exact-fit item", () => {
    const cells = packPhotoItems(100, 100, [{ photoTypeId: "a", widthMm: 100, heightMm: 100, quantity: 1 }]);
    expect(cells).toHaveLength(1);
    expect(cells[0].id).toBe("a-0");
  });

  it("floors fractional quantities and ignores non-positive", () => {
    expect(packPhotoItems(200, 200, [{ photoTypeId: "a", widthMm: 10, heightMm: 10, quantity: 2.9 }])).toHaveLength(2);
    expect(packPhotoItems(200, 200, [{ photoTypeId: "a", widthMm: 10, heightMm: 10, quantity: 0 }])).toEqual([]);
    expect(packPhotoItems(200, 200, [{ photoTypeId: "a", widthMm: 10, heightMm: 10, quantity: -3 }])).toEqual([]);
  });

  it("skips impossible items but packs possible ones", () => {
    const cells = packPhotoItems(50, 50, [
      { photoTypeId: "big", widthMm: 500, heightMm: 500, quantity: 1 },
      { photoTypeId: "ok", widthMm: 10, heightMm: 10, quantity: 2 },
    ]);
    expect(cells.every((c) => c.photoTypeId === "ok")).toBe(true);
    expect(cells).toHaveLength(2);
  });

  it("returns empty for empty requests and never overlaps", () => {
    expect(packPhotoItems(100, 100, [])).toEqual([]);
    const cells = packPhotoItems(
      210,
      297,
      [
        { photoTypeId: "p", widthMm: 35, heightMm: 45, quantity: 8 },
        { photoTypeId: "s", widthMm: 25.4, heightMm: 25.4, quantity: 6 },
      ],
      5,
      2,
    );
    expect(hasOverlaps(cells)).toBe(false);
  });

  it("orders deterministically (tallest first)", () => {
    const a = packPhotoItems(500, 500, [
      { photoTypeId: "short", widthMm: 50, heightMm: 10, quantity: 1 },
      { photoTypeId: "tall", widthMm: 10, heightMm: 50, quantity: 1 },
    ]);
    expect(a[0].photoTypeId).toBe("tall");
  });

  it("respects margins that consume the sheet", () => {
    expect(packPhotoItems(100, 100, [{ photoTypeId: "a", widthMm: 10, heightMm: 10, quantity: 1 }], 60)).toEqual([]);
  });
});

describe("hasOverlaps", () => {
  const cell = (x: number, y: number, w = 10, h = 10, id = "a") => ({ id, photoTypeId: "a", xMm: x, yMm: y, widthMm: w, heightMm: h });
  it("detects overlap, containment and identity", () => {
    expect(hasOverlaps([cell(0, 0), cell(5, 5)])).toBe(true);
    expect(hasOverlaps([cell(0, 0, 20, 20), cell(2, 2, 5, 5)])).toBe(true);
    expect(hasOverlaps([cell(0, 0), cell(0, 0)])).toBe(true);
  });
  it("touching edges do not overlap; empty/singleton safe", () => {
    expect(hasOverlaps([cell(0, 0), cell(10, 0)])).toBe(false);
    expect(hasOverlaps([cell(0, 0), cell(0, 10)])).toBe(false);
    expect(hasOverlaps([])).toBe(false);
    expect(hasOverlaps([cell(0, 0)])).toBe(false);
    expect(hasOverlaps([cell(-20, -20), cell(0, 0)])).toBe(false);
  });
});

describe("computeAutoFit", () => {
  const garment = { anchor: { x: 0.5, y: 0.2 }, shoulderFraction: 0.85 };

  it("returns null for invalid dimensions", () => {
    expect(computeAutoFit({ keypoints: blankKeys(), width: 0, height: 100, garment })).toBeNull();
    expect(computeAutoFit({ keypoints: blankKeys(), width: 100, height: -1, garment })).toBeNull();
  });

  it("fits from the shoulder line", () => {
    const keys = blankKeys();
    keys[0] = kp(100, 40, 1); // nose
    // person's left appears on viewer's right (larger x) for 0-degree rotation
    keys[5] = kp(140, 120, 1); // left shoulder
    keys[6] = kp(60, 120, 1); // right shoulder
    const out = computeAutoFit({ keypoints: keys, width: 200, height: 200, garment });
    expect(out).not.toBeNull();
    expect(out!.approximate).toBeUndefined();
    expect(out!.rotation).toBeCloseTo(0, 3);
    expect(out!.scale).toBeGreaterThanOrEqual(0.15);
    expect(out!.scale).toBeLessThanOrEqual(3);
  });

  it("falls back to ears when shoulders are missing", () => {
    const keys = blankKeys();
    keys[0] = kp(100, 60, 1);
    keys[3] = kp(80, 50, 1);
    keys[4] = kp(120, 50, 1);
    const out = computeAutoFit({ keypoints: keys, width: 200, height: 200, garment });
    expect(out?.approximate).toBe(true);
  });

  it("falls back to eyes when ears are unavailable", () => {
    const keys = blankKeys();
    keys[1] = kp(90, 50, 1);
    keys[2] = kp(110, 50, 1);
    keys[0] = kp(100, 70, 1);
    const out = computeAutoFit({ keypoints: keys, width: 200, height: 200, garment });
    expect(out?.approximate).toBe(true);
  });

  it("returns null when no head landmarks are usable", () => {
    expect(computeAutoFit({ keypoints: blankKeys(), width: 200, height: 200, garment })).toBeNull();
  });

  it("respects custom shoulderFactor/neckRaise/minScore and clamps scale", () => {
    const keys = blankKeys();
    keys[5] = kp(0, 100, 1);
    keys[6] = kp(1000, 100, 1);
    const big = computeAutoFit({ keypoints: keys, width: 10, height: 10, garment, shoulderFactor: 99 });
    expect(big!.scale).toBe(3);
    const small = computeAutoFit({ keypoints: keys, width: 10000, height: 10000, garment, shoulderFactor: 0.001 });
    expect(small!.scale).toBe(0.15);
    expect(
      computeAutoFit({ keypoints: keys, width: 200, height: 200, garment, neckRaise: 0.5 })!.anchorY,
    ).toBeDefined();
    // low-confidence nose is ignored without crashing
    keys[0] = kp(500, 10, 0.01);
    expect(computeAutoFit({ keypoints: keys, width: 200, height: 200, garment, minScore: 0.9 })).not.toBeNull();
  });

  it("rejects tiny shoulder spans and bad garment fractions", () => {
    const keys = blankKeys();
    keys[5] = kp(100, 100, 1);
    keys[6] = kp(101, 100, 1);
    expect(computeAutoFit({ keypoints: keys, width: 200, height: 200, garment })).toBeNull();
    const ok = blankKeys();
    ok[5] = kp(60, 120, 1);
    ok[6] = kp(140, 120, 1);
    const out = computeAutoFit({
      keypoints: ok,
      width: 200,
      height: 200,
      garment: { anchor: { x: 0.5, y: 0.5 }, shoulderFraction: 0 },
    });
    expect(out).not.toBeNull();
  });

  it("exposes default constants", () => {
    expect(SHOULDER_FACTOR).toBe(1.3);
    expect(NECK_RAISE).toBe(0);
    expect(MIN_KEYPOINT_SCORE).toBe(0.2);
  });
});

describe("rotateKeypoints", () => {
  const keys = [kp(10, 20, 0.9), kp(30, 40, 0.5)];
  it("is identity at 0/360 degrees", () => {
    expect(rotateKeypoints(keys, 100, 100, 0)).toBe(keys);
    expect(rotateKeypoints(keys, 100, 100, 360)).toBe(keys);
  });
  it("rotates 90/180/270 preserving scores", () => {
    for (const deg of [90, 180, 270, -90, 450]) {
      const out = rotateKeypoints(keys, 100, 200, deg);
      expect(out).toHaveLength(2);
      expect(out[0].score).toBe(0.9);
      expect(out.every((k) => Number.isFinite(k.x) && Number.isFinite(k.y))).toBe(true);
    }
    const r90 = rotateKeypoints([kp(0, 0, 1)], 100, 100, 90);
    expect(r90[0].x).toBeCloseTo(100, 3);
  });
  it("handles non-square canvases", () => {
    const out = rotateKeypoints(keys, 200, 100, 90);
    expect(out[0].x).toBeGreaterThanOrEqual(0);
    expect(out[0].x).toBeLessThanOrEqual(100);
  });
});
