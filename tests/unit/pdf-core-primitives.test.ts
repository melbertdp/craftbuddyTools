import { describe, expect, it } from "vitest";
import {
  clamp,
  degreesToRadians,
  displaySize,
  displayToPdfMatrix,
  displayedToPdf,
  normalizeRotation,
  normalizedToPdf,
  normalizedToViewport,
  pdfToDisplayed,
  pdfToNormalized,
  viewportToNormalized,
} from "@/pdf/core/coordinates";
import {
  computePlacement,
  getPageSizePreset,
  PAGE_SIZE_PRESETS,
} from "@/pdf/core/layout";
import {
  ensureExtension,
  exportFileName,
  pageFileName,
  safeBaseName,
  zeroPad,
} from "@/pdf/core/filenames";
import { newId, pdfByteStore } from "@/pdf/core/byte-store";
import { processInChunks, Semaphore } from "@/pdf/core/concurrency";
import {
  assertPdfBytes,
  hasPdfMagicBytes,
  sniffImageFormat,
} from "@/pdf/core/validation";
import { PdfError, isPdfError, toUserMessage } from "@/pdf/config/errors";
import { formatBytes, limitFor, PDF_LIMITS } from "@/pdf/config/limits";
import { collectWarnings } from "@/pdf/config/warnings";
import type { Rotation } from "@/pdf/types";

const enc = (s: string) => new TextEncoder().encode(s);

describe("coordinates edges", () => {
  it("handles zero-size viewports without NaN", () => {
    expect(viewportToNormalized(10, 20, 0, 0)).toEqual({ x: 0, y: 0 });
    expect(viewportToNormalized(10, 20, 0, 400)).toEqual({ x: 0, y: 0.05 });
    expect(normalizedToViewport(0.5, 0.5, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("handles zero-size pages in normalized conversions", () => {
    expect(pdfToNormalized(10, 10, 0, 0, 0)).toEqual({ x: 0, y: 0 });
    const p = normalizedToPdf(0.5, 0.5, 600, 800, 0);
    expect(p.x).toBeCloseTo(300);
    expect(p.y).toBeCloseTo(400);
  });

  it("covers all rotations for displayed<->pdf round trip", () => {
    const rotations: Rotation[] = [0, 90, 180, 270];
    for (const r of rotations) {
      const d = pdfToDisplayed(100, 200, 600, 800, r);
      const back = displayedToPdf(d.dx, d.dy, 600, 800, r);
      expect(back.x).toBeCloseTo(100, 6);
      expect(back.y).toBeCloseTo(200, 6);
    }
  });

  it("normalizes fractional, negative and large angles", () => {
    expect(normalizeRotation(44)).toBe(0);
    expect(normalizeRotation(46)).toBe(90);
    expect(normalizeRotation(135)).toBe(180);
    expect(normalizeRotation(225)).toBe(270);
    expect(normalizeRotation(315)).toBe(0);
    expect(normalizeRotation(-45)).toBe(0);
    expect(normalizeRotation(-135)).toBe(270);
    expect(normalizeRotation(720 + 90)).toBe(90);
    expect(normalizeRotation(360)).toBe(0);
  });

  it("returns exact matrices per rotation", () => {
    expect(displayToPdfMatrix(600, 800, 0)).toEqual([1, 0, 0, 1, 0, 0]);
    expect(displayToPdfMatrix(600, 800, 90)).toEqual([0, 1, -1, 0, 600, 0]);
    expect(displayToPdfMatrix(600, 800, 180)).toEqual([-1, 0, 0, -1, 600, 800]);
    expect(displayToPdfMatrix(600, 800, 270)).toEqual([0, -1, 1, 0, 0, 800]);
    expect(displaySize(10, 20, 180)).toEqual({ width: 10, height: 20 });
  });

  it("converts degrees and clamps values", () => {
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI);
    expect(degreesToRadians(0)).toBe(0);
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(99, 0, 10)).toBe(10);
    expect(clamp(5, 5, 5)).toBe(5);
  });
});

describe("layout edges", () => {
  const base = {
    pageWidth: 600,
    pageHeight: 800,
    imageWidth: 300,
    imageHeight: 200,
    margin: 20,
  };

  it("falls back to first preset for unknown ids", () => {
    // @ts-expect-error runtime-invalid id
    expect(getPageSizePreset("a3").id).toBe(PAGE_SIZE_PRESETS[0].id);
    expect(getPageSizePreset("original").width).toBe(0);
  });

  it("fit preserves aspect ratio", () => {
    const r = computePlacement({ ...base, placement: "fit" });
    expect(r.width / r.height).toBeCloseTo(300 / 200, 6);
    expect(r.width).toBeLessThanOrEqual(600 - 40);
    expect(r.height).toBeLessThanOrEqual(800 - 40);
  });

  it("fill covers the available area", () => {
    const r = computePlacement({ ...base, placement: "fill" });
    expect(r.width >= 600 - 40 || r.height >= 800 - 40).toBe(true);
  });

  it("original clamps oversized images to the page", () => {
    const r = computePlacement({
      ...base,
      imageWidth: 5000,
      imageHeight: 6000,
      placement: "original",
    });
    expect(r.width).toBeLessThanOrEqual(600);
    expect(r.height).toBeLessThanOrEqual(800);
  });

  it("stretch fills available area even with huge margins", () => {
    const r = computePlacement({ ...base, placement: "stretch", margin: 500 });
    expect(r.width).toBe(1);
    expect(r.height).toBe(1);
    expect(r.x).toBe(500);
  });

  it("tolerates zero/negative image dimensions", () => {
    const r = computePlacement({ ...base, imageWidth: 0, imageHeight: -5, placement: "fit" });
    expect(Number.isFinite(r.width)).toBe(true);
    expect(Number.isFinite(r.height)).toBe(true);
    expect(r.width).toBeGreaterThan(0);
  });

  it("tolerates negative margins", () => {
    const r = computePlacement({ ...base, margin: -10, placement: "fit" });
    expect(Number.isFinite(r.width)).toBe(true);
  });
});

describe("filenames edges", () => {
  it("strips pdf extension case-insensitively and invalid chars", () => {
    expect(safeBaseName("report.PDF")).toBe("report");
    expect(safeBaseName("a/b\\c:d*e?f\"g<h>i|j")).not.toMatch(/[/\\:*?"<>|]/);
    expect(safeBaseName("  ")).toBe("document");
    expect(safeBaseName("", "fallback")).toBe("fallback");
    expect(safeBaseName("a".repeat(200)).length).toBe(120);
  });

  it("handles control characters and whitespace-only names", () => {
    expect(safeBaseName("\u0000\u001fhi.PDF")).toBe("--hi");
    expect(safeBaseName("   ")).toBe("document");
    // tab is an invalid filename char -> replaced with "-", then trimmed to "-"
    expect(safeBaseName("   \t  ")).toBe("-");
  });

  it("keeps multi-dot names and pads pages", () => {
    expect(zeroPad(7)).toBe("007");
    expect(zeroPad(1234)).toBe("1234");
    expect(pageFileName("my.report.v2.pdf", 3, "PNG")).toBe("my.report.v2-page-003.png");
    expect(pageFileName("doc", 12, ".jpg")).toBe("doc-page-012.jpg");
  });

  it("normalizes export suffixes", () => {
    expect(exportFileName("doc.pdf", "  -- compressed ")).toBe("doc-compressed-.pdf");
    expect(exportFileName("doc.pdf", "compressed")).toBe("doc-compressed.pdf");
    expect(exportFileName("doc", "")).toBe("doc.pdf");
    expect(exportFileName("doc", "   ")).toBe("doc.pdf");
  });

  it("ensures extensions case-insensitively", () => {
    expect(ensureExtension("file.PDF", "pdf")).toBe("file.PDF");
    expect(ensureExtension("file", ".pdf")).toBe("file.pdf");
  });
});

describe("byte store", () => {
  it("stores, replaces, deletes and clears", () => {
    pdfByteStore.clear();
    const a = new Uint8Array([1, 2, 3]);
    pdfByteStore.set("k1", a);
    expect(pdfByteStore.get("k1")).toBe(a);
    expect(pdfByteStore.has("k1")).toBe(true);
    expect(pdfByteStore.size()).toBe(1);
    const b = new Uint8Array([9]);
    pdfByteStore.set("k1", b);
    expect(pdfByteStore.get("k1")).toBe(b);
    pdfByteStore.delete("k1");
    expect(pdfByteStore.has("k1")).toBe(false);
    expect(pdfByteStore.get("missing")).toBeUndefined();
    pdfByteStore.clear();
    expect(pdfByteStore.size()).toBe(0);
  });

  it("generates unique prefixed ids", () => {
    const ids = new Set(Array.from({ length: 50 }, () => newId("page")));
    expect(ids.size).toBe(50);
    for (const id of ids) expect(id.startsWith("page_")).toBe(true);
    expect(newId().startsWith("id_")).toBe(true);
  });
});

describe("concurrency", () => {
  it("rejects non-positive semaphore limits", () => {
    expect(() => new Semaphore(0)).toThrow();
    expect(() => new Semaphore(-2)).toThrow();
  });

  it("limits concurrent execution and releases on error", async () => {
    const sem = new Semaphore(2);
    let running = 0;
    let maxRunning = 0;
    const task = async (fail = false) => {
      running += 1;
      maxRunning = Math.max(maxRunning, running);
      await new Promise((r) => setTimeout(r, 5));
      running -= 1;
      if (fail) throw new Error("boom");
      return 1;
    };
    const results = await Promise.all([
      sem.run(() => task()),
      sem.run(() => task()),
      sem.run(() => task()),
      sem.run(() => task()),
    ]);
    expect(results).toEqual([1, 1, 1, 1]);
    expect(maxRunning).toBeLessThanOrEqual(2);
    expect(sem.activeCount).toBe(0);
    expect(sem.pendingCount).toBe(0);
    await expect(sem.run(() => task(true))).rejects.toThrow("boom");
    expect(sem.activeCount).toBe(0);
  });

  it("processes chunks with progress, empty input and index order", async () => {
    const progress: Array<[number, number]> = [];
    const out = await processInChunks([1, 2, 3, 4, 5], 2, async (v, i) => v * 10 + i, (c, t) =>
      progress.push([c, t]),
    );
    expect(out).toEqual([10, 21, 32, 43, 54]);
    expect(progress.at(-1)).toEqual([5, 5]);
    expect(await processInChunks([], 3, async (v: number) => v)).toEqual([]);
    await expect(
      processInChunks([1], 1, () => {
        throw new Error("handler");
      }),
    ).rejects.toThrow("handler");
  });
});

describe("validation / errors / limits / warnings", () => {
  it("finds magic bytes with offset and rejects short buffers", () => {
    const withPrefix = new Uint8Array([0, 1, 2, ...enc("%PDF-1.4")]);
    expect(hasPdfMagicBytes(withPrefix)).toBe(true);
    expect(hasPdfMagicBytes(new Uint8Array([1, 2]))).toBe(false);
    expect(hasPdfMagicBytes(enc("hello"))).toBe(false);
  });

  it("asserts pdf bytes", () => {
    expect(() => assertPdfBytes(new Uint8Array([]))).toThrow(PdfError);
    expect(() => assertPdfBytes(enc("not a pdf"))).toThrow(PdfError);
    expect(() => assertPdfBytes(enc("%PDF-1.7"))).not.toThrow();
  });

  it("sniffs truncated signatures safely", () => {
    expect(sniffImageFormat(new Uint8Array([0x89, 0x50]))).toBeUndefined();
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8]))).toBeUndefined();
    expect(sniffImageFormat(new Uint8Array(12).fill(0))).toBeUndefined();
  });

  it("maps error messages and predicates", () => {
    expect(isPdfError(new PdfError("PDF_INVALID"))).toBe(true);
    expect(isPdfError(new Error("x"))).toBe(false);
    expect(toUserMessage(new PdfError("PDF_ENCRYPTED"))).toMatch(/password/i);
    expect(toUserMessage(new Error("wrong password supplied"))).toMatch(/password/i);
    expect(toUserMessage(new Error("allocation failed"))).toMatch(/memory/i);
    expect(toUserMessage(new Error("mystery"))).toMatch(/went wrong/i);
    expect(toUserMessage(undefined)).toMatch(/went wrong/i);
  });

  it("formats bytes and resolves scopes", () => {
    expect(formatBytes(NaN)).toBe("0 B");
    expect(formatBytes(-5)).toBe("0 B");
    expect(formatBytes(500)).toBe("500 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(limitFor("general").maxPages).toBe(100);
    expect(limitFor("sign").maxPages).toBe(50);
    expect(PDF_LIMITS.merge.maxDocuments).toBe(20);
  });

  it("collects file/page warnings with precedence", () => {
    expect(collectWarnings({ sizeBytes: 10, pageCount: 2 })).toEqual([]);
    const both = collectWarnings({
      sizeBytes: PDF_LIMITS.warnings.largeFileBytes,
      pageCount: PDF_LIMITS.warnings.largePageCount,
    });
    // large file takes precedence over many pages (else-if branch)
    expect(both.map((w) => w.code)).toEqual(["LARGE_FILE"]);
    expect(
      collectWarnings({ sizeBytes: 1, pageCount: 1, maxPageDimensionPt: 20000 })[0].code,
    ).toBe("LARGE_PAGE");
  });
});
