import { describe, expect, it } from "vitest";
import {
  ensureExtension,
  exportFileName,
  pageFileName,
  safeBaseName,
  zeroPad,
} from "@/pdf/core/filenames";

describe("filenames", () => {
  it("zero-pads page numbers", () => {
    expect(zeroPad(1)).toBe("001");
    expect(zeroPad(42, 4)).toBe("0042");
  });

  it("generates predictable page filenames", () => {
    expect(pageFileName("report.pdf", 1, "png")).toBe("report-page-001.png");
    expect(pageFileName("report.pdf", 12, ".jpg")).toBe("report-page-012.jpg");
  });

  it("sanitizes base names", () => {
    expect(safeBaseName("a/b:c*d?.pdf")).toBe("a-b-c-d-");
    expect(safeBaseName("", "fallback")).toBe("fallback");
  });

  it("builds export filenames", () => {
    expect(exportFileName("My Doc.PDF", "Watermarked")).toBe("My Doc-watermarked.pdf");
    expect(exportFileName("doc.pdf", "")).toBe("doc.pdf");
  });

  it("ensures extensions", () => {
    expect(ensureExtension("file", "pdf")).toBe("file.pdf");
    expect(ensureExtension("file.pdf", "pdf")).toBe("file.pdf");
  });
});
