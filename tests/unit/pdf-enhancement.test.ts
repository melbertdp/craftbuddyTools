import { describe, expect, it } from "vitest";
import {
  buildPageNumberObjects,
  buildWatermarkObjects,
  formatPageNumber,
  POSITIONS,
  updatePdfMetadata,
} from "@/pdf/core/enhancement-engine";
import { hexToRgb } from "@/pdf/core/export-engine";
import type { PdfPageModel } from "@/pdf/types";

const mkPages = (n: number): PdfPageModel[] =>
  Array.from({ length: n }, (_, i) => ({
    id: `pg${i + 1}`,
    sourceDocumentId: "doc",
    sourcePageIndex: i,
    rotation: i === 1 ? 90 : 0,
    width: 600,
    height: 800,
  }));

const wmBase = {
  kind: "text" as const,
  text: "CONFIDENTIAL",
  fontFamily: "Helvetica",
  fontSize: 24,
  color: "#ff0000",
  opacity: 0.5,
  rotation: 0,
  scale: 1,
  position: "center" as const,
  tiled: false,
  pageNumbers: [] as number[],
  margin: 36,
};

describe("formatPageNumber", () => {
  it("formats every variant", () => {
    expect(formatPageNumber("n", 3, 10)).toBe("3");
    expect(formatPageNumber("page-n", 3, 10)).toBe("Page 3");
    expect(formatPageNumber("n-of-total", 3, 10)).toBe("3 of 10");
    expect(formatPageNumber("page-n-of-total", 3, 10)).toBe("Page 3 of 10");
  });
});

describe("buildWatermarkObjects", () => {
  it("creates one text stamp per page when no filter", () => {
    const out = buildWatermarkObjects(mkPages(2), wmBase);
    expect(Object.keys(out)).toHaveLength(2);
    expect(out["pg1"]).toHaveLength(1);
    expect(out["pg1"][0].type).toBe("text");
  });

  it("supports every position", () => {
    for (const position of POSITIONS) {
      const out = buildWatermarkObjects(mkPages(1), { ...wmBase, position });
      expect(out["pg1"]).toHaveLength(1);
    }
  });

  it("tiles text into 12 stamps", () => {
    const out = buildWatermarkObjects(mkPages(1), { ...wmBase, tiled: true });
    expect(out["pg1"]).toHaveLength(12);
  });

  it("filters by 1-based page numbers", () => {
    const out = buildWatermarkObjects(mkPages(3), { ...wmBase, pageNumbers: [2] });
    expect(Object.keys(out)).toEqual(["pg2"]);
  });

  it("builds image watermarks and skips missing dataUrl", () => {
    const withImg = buildWatermarkObjects(mkPages(1), {
      ...wmBase,
      kind: "image",
      dataUrl: "data:image/png;base64,x",
      format: "png",
      position: "bottom-right",
    });
    expect(withImg["pg1"][0].type).toBe("image");
    const missing = buildWatermarkObjects(mkPages(1), { ...wmBase, kind: "image" });
    expect(missing["pg1"]).toEqual([]);
    for (const position of POSITIONS) {
      const out = buildWatermarkObjects(mkPages(1), {
        ...wmBase,
        kind: "image",
        dataUrl: "data:image/png;base64,x",
        position,
      });
      expect(out["pg1"]).toHaveLength(1);
    }
  });

  it("handles rotated pages", () => {
    const out = buildWatermarkObjects(mkPages(2), { ...wmBase, tiled: false });
    expect(out["pg2"]).toHaveLength(1);
  });
});

describe("buildPageNumberObjects", () => {
  const base = {
    format: "n" as const,
    startNumber: 5,
    prefix: "[",
    suffix: "]",
    fontFamily: "Helvetica",
    fontSize: 12,
    color: "#000",
    position: "bottom-center" as const,
    margin: 24,
    pageNumbers: [] as number[],
  };

  it("numbers sequentially across pages with prefix/suffix", () => {
    const out = buildPageNumberObjects(mkPages(3), base);
    expect(Object.keys(out)).toHaveLength(3);
    expect((out["pg1"][0] as { text: string }).text).toBe("[5]");
    expect((out["pg3"][0] as { text: string }).text).toBe("[7]");
  });

  it("filters pages but keeps a continuous counter", () => {
    const out = buildPageNumberObjects(mkPages(3), { ...base, pageNumbers: [1, 3], prefix: "", suffix: "" });
    expect(Object.keys(out)).toEqual(["pg1", "pg3"]);
    expect((out["pg3"][0] as { text: string }).text).toBe("6");
  });

  it("supports all formats and positions", () => {
    for (const format of ["n", "page-n", "n-of-total", "page-n-of-total"] as const) {
      const out = buildPageNumberObjects(mkPages(1), { ...base, format, prefix: "", suffix: "" });
      expect((out["pg1"][0] as { text: string }).text.length).toBeGreaterThan(0);
    }
    for (const position of POSITIONS) {
      const out = buildPageNumberObjects(mkPages(1), { ...base, position });
      expect(out["pg1"]).toHaveLength(1);
    }
  });
});

describe("hexToRgb", () => {
  it("parses 6-digit, 3-digit, hashless and uppercase", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 1, g: 0, b: 0 });
    expect(hexToRgb("00ff00")).toEqual({ r: 0, g: 1, b: 0 });
    expect(hexToRgb("#0f0")).toEqual({ r: 0, g: 1, b: 0 });
    expect(hexToRgb("  #0000FF  ")).toEqual({ r: 0, g: 0, b: 1 });
  });

  it("falls back to black on malformed input", () => {
    expect(hexToRgb("not-a-color")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("")).toEqual({ r: 0, g: 0, b: 0 });
    expect(hexToRgb("#")).toEqual({ r: 0, g: 0, b: 0 });
  });

  it("clamps oversized strings to first 6 digits", () => {
    expect(hexToRgb("#ff0000ff")).toEqual({ r: 1, g: 0, b: 0 });
  });
});

describe("updatePdfMetadata", () => {
  it("writes partial metadata and splits keywords", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.create();
    src.addPage([600, 800]);
    const bytes = await src.save();
    const out = await updatePdfMetadata(bytes, {
      metadata: { title: "T", keywords: "a, b;c,, d", author: "me" },
    });
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getTitle()).toBe("T");
    expect(reloaded.getAuthor()).toBe("me");
    expect(reloaded.getKeywords().split(" ")).toContain("a");
  });

  it("removes metadata in removal mode", async () => {
    const { PDFDocument } = await import("pdf-lib");
    const src = await PDFDocument.create();
    src.addPage([100, 100]);
    src.setTitle("Keep?");
    const bytes = await src.save();
    const out = await updatePdfMetadata(bytes, { metadata: {}, remove: true });
    const reloaded = await PDFDocument.load(out);
    expect(reloaded.getTitle() ?? "").toBe("");
  });
});
