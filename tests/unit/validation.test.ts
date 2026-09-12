import { describe, expect, it } from "vitest";
import { formatBytes, PDF_LIMITS, limitFor } from "@/pdf/config/limits";
import { collectWarnings, LARGE_DOCUMENT_MESSAGE } from "@/pdf/config/warnings";
import { hasPdfMagicBytes, sniffImageFormat } from "@/pdf/core/validation";
import { PDF_ERROR_CODES, PdfError, toUserMessage } from "@/pdf/config/errors";

describe("limits and warnings", () => {
  it("exposes centralized limits", () => {
    expect(PDF_LIMITS.general.maxFileSizeBytes).toBe(50 * 1024 * 1024);
    expect(PDF_LIMITS.general.maxPages).toBe(100);
    expect(PDF_LIMITS.edit.maxPages).toBe(50);
    expect(PDF_LIMITS.sign.maxPages).toBe(50);
    expect(PDF_LIMITS.merge.maxCombinedPages).toBe(200);
    expect(PDF_LIMITS.imageToPdf.maxImages).toBe(50);
    expect(PDF_LIMITS.pdfToImage.maxPages).toBe(100);
    expect(limitFor("edit").maxPages).toBe(50);
  });

  it("formats byte sizes", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
  });

  it("warns for large documents", () => {
    expect(collectWarnings({ sizeBytes: 100, pageCount: 2 })).toHaveLength(0);
    const manyPages = collectWarnings({
      sizeBytes: 100,
      pageCount: PDF_LIMITS.warnings.largePageCount,
    });
    expect(manyPages[0].message).toBe(LARGE_DOCUMENT_MESSAGE);
    const large = collectWarnings({
      sizeBytes: PDF_LIMITS.warnings.largeFileBytes,
      pageCount: 1,
    });
    expect(large[0].code).toBe("LARGE_FILE");
    const largePage = collectWarnings({
      sizeBytes: 1,
      pageCount: 1,
      maxPageDimensionPt: PDF_LIMITS.warnings.hugePageDimensionPt,
    });
    expect(largePage[0].code).toBe("LARGE_PAGE");
  });
});

describe("validation", () => {
  it("detects PDF magic bytes", () => {
    expect(hasPdfMagicBytes(new TextEncoder().encode("%PDF-1.7\n"))).toBe(true);
    expect(hasPdfMagicBytes(new TextEncoder().encode("hello world"))).toBe(false);
  });

  it("sniffs image formats", () => {
    expect(sniffImageFormat(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("png");
    expect(sniffImageFormat(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("jpeg");
    const webp = new Uint8Array(12);
    webp.set(new TextEncoder().encode("RIFF"), 0);
    webp.set(new TextEncoder().encode("WEBP"), 8);
    expect(sniffImageFormat(webp)).toBe("webp");
    expect(sniffImageFormat(new Uint8Array([1, 2, 3]))).toBeUndefined();
  });
});

describe("errors", () => {
  it("maps error codes to messages", () => {
    expect(new PdfError("PDF_ENCRYPTED").userMessage).toMatch(/password/i);
    expect(toUserMessage(new PdfError("PDF_INVALID"))).toBe("This file is not a valid PDF document.");
    expect(toUserMessage(new Error("Unknown"))).toMatch(/went wrong/i);
  });

  it("defines a stable code list", () => {
    expect(PDF_ERROR_CODES).toContain("PDF_INVALID");
    expect(PDF_ERROR_CODES).toContain("MEMORY_LIMIT");
  });
});
