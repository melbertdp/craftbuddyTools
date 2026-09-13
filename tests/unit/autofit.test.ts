import { describe, expect, it } from "vitest";
import {
  computeAutoFit,
  rotateKeypoints,
  type GarmentMeta,
  type Keypoint,
} from "@/photo-print/autofit";

const garment: GarmentMeta = { anchor: { x: 0.5, y: 0.1 }, shoulderFraction: 0.8 };

function keypoints(overrides: Partial<Record<number, Keypoint>> = {}): Keypoint[] {
  const base: Keypoint[] = Array.from({ length: 17 }, () => ({
    x: 0,
    y: 0,
    score: 0,
  }));
  base[0] = { x: 200, y: 100, score: 0.9 }; // nose
  base[5] = { x: 280, y: 200, score: 0.9 }; // left shoulder (viewer's right)
  base[6] = { x: 120, y: 200, score: 0.9 }; // right shoulder (viewer's left)
  for (const [index, value] of Object.entries(overrides)) {
    base[Number(index)] = value as Keypoint;
  }
  return base;
}

describe("computeAutoFit", () => {
  it("centres the collar between the shoulders and scales to shoulder width", () => {
    const result = computeAutoFit({
      keypoints: keypoints(),
      width: 400,
      height: 500,
      garment,
      neckRaise: 0,
    });
    expect(result).not.toBeNull();
    expect(result!.anchorX).toBeCloseTo(0.5, 3);
    expect(result!.anchorY).toBeCloseTo(0.4, 3);
    // scale = k * shoulderWidth / (fraction * width) = 1.3*160/(0.8*400)
    expect(result!.scale).toBeCloseTo(0.65, 3);
    expect(result!.rotation).toBeCloseTo(0, 3);
  });

  it("derives garment rotation from the shoulder roll", () => {
    const result = computeAutoFit({
      keypoints: keypoints({
        5: { x: 280, y: 220, score: 0.9 },
        6: { x: 120, y: 180, score: 0.9 },
      }),
      width: 400,
      height: 500,
      garment,
    });
    expect(result).not.toBeNull();
    // Right shoulder is lower, so the garment tilts to match the body.
    expect(result!.rotation).toBeCloseTo(14.04, 1);
  });

  it("returns null when shoulders are low confidence", () => {
    const result = computeAutoFit({
      keypoints: keypoints({ 5: { x: 120, y: 200, score: 0.05 } }),
      width: 400,
      height: 500,
      garment,
    });
    expect(result).toBeNull();
  });

  it("falls back to head landmarks when the shoulders are cropped", () => {
    const result = computeAutoFit({
      keypoints: keypoints({
        5: { x: 0, y: 0, score: 0 },
        6: { x: 0, y: 0, score: 0 },
        3: { x: 260, y: 120, score: 0.8 },
        4: { x: 140, y: 120, score: 0.8 },
      }),
      width: 400,
      height: 500,
      garment,
    });
    expect(result).not.toBeNull();
    expect(result!.approximate).toBe(true);
    // ear width 120 -> shoulder 288 -> 1.3*288/(0.8*400)
    expect(result!.scale).toBeCloseTo(1.17, 2);
    expect(result!.rotation).toBeCloseTo(0, 3);
  });

  it("returns null when the shoulders overlap", () => {
    const result = computeAutoFit({
      keypoints: keypoints({
        5: { x: 200, y: 200, score: 0.9 },
        6: { x: 201, y: 200, score: 0.9 },
      }),
      width: 400,
      height: 500,
      garment,
    });
    expect(result).toBeNull();
  });

  it("clamps extreme scales", () => {
    const result = computeAutoFit({
      keypoints: keypoints({
        5: { x: 0, y: 200, score: 0.9 },
        6: { x: 399, y: 200, score: 0.9 },
      }),
      width: 400,
      height: 500,
      garment,
      shoulderFactor: 6,
    });
    expect(result).not.toBeNull();
    expect(result!.scale).toBeLessThanOrEqual(3);
    expect(result!.scale).toBeGreaterThanOrEqual(0.15);
  });
});

describe("rotateKeypoints", () => {
  it("swaps the canvas axes for a 90 degree rotation", () => {
    const [point] = rotateKeypoints(
      [{ x: 0, y: 0, score: 1 }],
      100,
      200,
      90,
    );
    // Centre of a 100x200 crop maps to the centre of the rotated 200x100 canvas.
    expect(point.x).toBeCloseTo(200, 5);
    expect(point.y).toBeCloseTo(0, 5);
  });

  it("is a no-op at zero degrees", () => {
    const input = [{ x: 12, y: 34, score: 0.5 }];
    expect(rotateKeypoints(input, 100, 200, 0)).toBe(input);
  });
});
