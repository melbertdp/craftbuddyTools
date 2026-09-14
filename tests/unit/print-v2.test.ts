import { describe, expect, it } from "vitest";
import { analyzePixels } from "@/print-estimator-v2/pixel-analyzer";
import { classifyColor } from "@/print-estimator-v2/color-classifier";
import {
  classifyContentFromCoverage,
  heuristicCoverage,
  unionArea,
} from "@/print-estimator-v2/content-classifier";
import { scoreConfidence } from "@/print-estimator-v2/confidence";
import { applyOverride, calculateV2Total } from "@/print-estimator-v2/pricing";
import { docLayoutKindForClassId, PP_DOCLAYOUT_LABELS } from "@/print-estimator-v2/layout-detector";
import { V2_DEFAULT_RATES, V2_DEFAULT_THRESHOLDS } from "@/print-estimator-v2/settings";
import type { V2ClassifiedPage } from "@/print-estimator-v2/types";

function solidPixels(r: number, g: number, b: number, count: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(count * 4);
  for (let i = 0; i < count; i += 1) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = 255;
  }
  return data;
}

const basePage = (overrides: Partial<V2ClassifiedPage> = {}): V2ClassifiedPage => ({
  pageNumber: 1,
  inkCoverage: 0.1,
  colorCoverage: 0.01,
  bwCoverage: 0.09,
  whiteCoverage: 0.9,
  averageSaturation: 0.05,
  averageBrightness: 0.9,
  darkPixelCoverage: 0.05,
  coloredInkCoverage: 0.1,
  colorClass: "BW",
  contentClass: "TEXT",
  detectedCategory: "BW",
  overrideCategory: null,
  finalCategory: "BW",
  confidence: 0.9,
  reviewRecommended: false,
  textCoverage: 0.08,
  imageCoverage: 0.01,
  layoutModel: "heuristic-fallback",
  status: "complete",
  ...overrides,
});

describe("v2 pixel analyzer", () => {
  it("treats white pages as blank", () => {
    const metrics = analyzePixels(solidPixels(255, 255, 255, 100), 10, 10, {
      backgroundLevel: 245,
      colorChromaThreshold: 18,
      colorSaturationThreshold: 0.12,
    });
    expect(metrics.inkCoverage).toBe(0);
    expect(metrics.whiteCoverage).toBe(1);
  });

  it("detects black text as B&W ink", () => {
    const metrics = analyzePixels(solidPixels(0, 0, 0, 100), 10, 10, {
      backgroundLevel: 245,
      colorChromaThreshold: 18,
      colorSaturationThreshold: 0.12,
    });
    expect(metrics.inkCoverage).toBe(1);
    expect(metrics.colorCoverage).toBe(0);
    expect(metrics.bwCoverage).toBe(1);
  });

  it("detects saturated red as color", () => {
    const metrics = analyzePixels(solidPixels(220, 20, 20, 100), 10, 10, {
      backgroundLevel: 245,
      colorChromaThreshold: 18,
      colorSaturationThreshold: 0.12,
    });
    expect(metrics.colorCoverage).toBe(1);
    expect(metrics.bwCoverage).toBe(0);
  });
});

describe("v2 color classifier", () => {
  it("classifies coverage tiers", () => {
    const t = V2_DEFAULT_THRESHOLDS;
    const at = (colorCoverage: number) =>
      classifyColor(
        {
          inkCoverage: 0.2,
          colorCoverage,
          bwCoverage: 0.1,
          whiteCoverage: 0.8,
          averageSaturation: 0.2,
          averageBrightness: 0.8,
          darkPixelCoverage: 0.05,
          coloredInkCoverage: 0.5,
        },
        t,
      ).colorClass;
    expect(at(0.005)).toBe("BW");
    expect(at(0.07)).toBe("LIGHT");
    expect(at(0.29)).toBe("SEMI");
    expect(at(0.84)).toBe("FULL");
  });
});

describe("v2 content classifier", () => {
  it("uses image-share thresholds and union area", () => {
    const t = V2_DEFAULT_THRESHOLDS;
    const metrics = basePage();
    expect(classifyContentFromCoverage(0.74, 0.08, metrics, t).contentClass).toBe("TEXT");
    expect(classifyContentFromCoverage(0.43, 0.41, metrics, t).contentClass).toBe("MIXED");
    expect(
      classifyContentFromCoverage(
        0.05,
        0.88,
        { ...metrics, colorCoverage: 0.5, inkCoverage: 0.9, whiteCoverage: 0.1 },
        t,
      ).contentClass,
    ).toBe("IMAGE");
    expect(unionArea([], 100)).toBe(0);
    expect(
      unionArea(
        [
          { x: 0, y: 0, width: 10, height: 10, kind: "text" },
          { x: 5, y: 5, width: 10, height: 10, kind: "text" },
        ],
        1000,
      ),
    ).toBe(175);
  });

  it("flags B&W scans without pricing them as images", () => {
    const scanned = classifyContentFromCoverage(
      0.02,
      0.9,
      { ...basePage(), colorCoverage: 0.005, inkCoverage: 0.2, whiteCoverage: 0.8 },
      V2_DEFAULT_THRESHOLDS,
    );
    expect(scanned.contentClass).toBe("SCANNED");
  });

  it("heuristic fallback stays bounded", () => {
    const out = heuristicCoverage(basePage());
    expect(out.textCoverage).toBeGreaterThanOrEqual(0);
    expect(out.imageCoverage).toBeGreaterThanOrEqual(0);
    expect(out.textCoverage + out.imageCoverage).toBeLessThanOrEqual(0.11);
  });
});

describe("v2 layout labels", () => {
  it("maps PP-DocLayout-S classes to text/image buckets", () => {
    expect(PP_DOCLAYOUT_LABELS.length).toBe(23);
    expect(docLayoutKindForClassId(PP_DOCLAYOUT_LABELS.indexOf("image"))).toBe("image");
    expect(docLayoutKindForClassId(PP_DOCLAYOUT_LABELS.indexOf("chart"))).toBe("image");
    expect(docLayoutKindForClassId(PP_DOCLAYOUT_LABELS.indexOf("header_image"))).toBe("image");
    expect(docLayoutKindForClassId(PP_DOCLAYOUT_LABELS.indexOf("footer_image"))).toBe("image");
    expect(docLayoutKindForClassId(PP_DOCLAYOUT_LABELS.indexOf("text"))).toBe("text");
    expect(docLayoutKindForClassId(PP_DOCLAYOUT_LABELS.indexOf("table"))).toBe("text");
    expect(docLayoutKindForClassId(999)).toBe("text");
  });
});

describe("v2 confidence and pricing", () => {
  it("scores boundary distance instead of copying model confidence", () => {
    const high = scoreConfidence({
      colorBoundaryDistance: 0.9,
      contentBoundaryDistance: 0.9,
      modelConfidence: 0.9,
      detectedCoverage: 0.5,
      conflictingSignals: false,
    });
    const low = scoreConfidence({
      colorBoundaryDistance: 0.02,
      contentBoundaryDistance: 0.02,
      modelConfidence: 0.9,
      detectedCoverage: 0.5,
      conflictingSignals: true,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("keeps detected category after override and restores on clear", () => {
    const overridden = applyOverride(basePage(), "SEMI");
    expect(overridden.detectedCategory).toBe("BW");
    expect(overridden.finalCategory).toBe("SEMI");
    expect(applyOverride(overridden, null).finalCategory).toBe("BW");
  });

  it("prices categories and multiplies by copies", () => {
    const pages = [
      basePage({ pageNumber: 1, finalCategory: "BW" }),
      basePage({ pageNumber: 2, finalCategory: "LIGHT", detectedCategory: "LIGHT" }),
      basePage({ pageNumber: 3, finalCategory: "FULL", detectedCategory: "FULL" }),
    ];
    const total = calculateV2Total(pages, V2_DEFAULT_RATES, {
      copies: 2,
      paperAdjustmentPerPage: 0,
      addons: 0,
      discount: 0,
      otherCharges: 0,
    });
    expect(total.counts.BW).toBe(1);
    expect(total.printedPages).toBe(6);
    expect(total.grandTotal).toBe((3 + 4 + 10) * 2);
  });
});
