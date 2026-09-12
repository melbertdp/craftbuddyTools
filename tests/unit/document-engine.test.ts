import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PDFDocument } from "pdf-lib";
import { loadPdfBytes } from "@/pdf/core/document-engine";
import { buildPdfBytes } from "@/pdf/core/structure";
import { PdfError } from "@/pdf/config/errors";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(join(process.cwd(), "tests", "fixtures", "generated", name)));

describe("document engine fixtures", () => {
  it("loads a one-page PDF", async () => {
    const loaded = await loadPdfBytes(fixture("one-page.pdf"), "one-page.pdf", { register: false });
    expect(loaded.source.pageCount).toBe(1);
    expect(loaded.pages[0].width).toBeCloseTo(595.28, 1);
  });

  it("loads portrait and landscape with correct orientation", async () => {
    const portrait = await loadPdfBytes(fixture("portrait.pdf"), "portrait.pdf", { register: false });
    const landscape = await loadPdfBytes(fixture("landscape.pdf"), "landscape.pdf", { register: false });
    expect(portrait.pages[0].height).toBeGreaterThan(portrait.pages[0].width);
    expect(landscape.pages[0].width).toBeGreaterThan(landscape.pages[0].height);
  });

  it("reads page rotation from the rotated fixture", async () => {
    const loaded = await loadPdfBytes(fixture("rotated.pdf"), "rotated.pdf", { register: false });
    expect(loaded.pages[0].rotation).toBe(90);
  });

  it("warns about large page dimensions", async () => {
    const loaded = await loadPdfBytes(fixture("huge-page.pdf"), "huge.pdf", { register: false });
    expect(loaded.warnings.some((warning) => warning.code === "LARGE_PAGE")).toBe(true);
  });

  it("enforces page limits", async () => {
    await expect(
      loadPdfBytes(fixture("hundred-page.pdf"), "hundred.pdf", { scope: "edit", register: false }),
    ).rejects.toMatchObject({ code: "PDF_TOO_MANY_PAGES" });
  });

  it("rejects a non-PDF file", async () => {
    await expect(
      loadPdfBytes(fixture("not-a-pdf.txt"), "not-a-pdf.txt", { register: false }),
    ).rejects.toBeInstanceOf(PdfError);
  });

  it("rejects a corrupted PDF", async () => {
    await expect(
      loadPdfBytes(fixture("corrupted.pdf"), "corrupted.pdf", { register: false }),
    ).rejects.toMatchObject({ code: "PDF_CORRUPTED" });
  });

  it("loads image-heavy, vector-heavy, unicode, forms, and transparent fixtures", async () => {
    for (const name of [
      "image-heavy.pdf",
      "vector-heavy.pdf",
      "unicode-text.pdf",
      "forms.pdf",
      "annotations.pdf",
      "transparent-image.pdf",
      "mixed-sizes.pdf",
    ]) {
      const loaded = await loadPdfBytes(fixture(name), name, { register: false });
      expect(loaded.source.pageCount).toBeGreaterThan(0);
    }
  });
});

describe("structure building", () => {
  it("merges pages from multiple sources in order", async () => {
    const first = await loadPdfBytes(fixture("portrait.pdf"), "portrait.pdf", { register: false });
    const second = await loadPdfBytes(fixture("landscape.pdf"), "landscape.pdf", { register: false });
    const bytes = await buildPdfBytes({
      pages: [
        { sourceDocumentId: first.source.id, sourcePageIndex: 0, rotation: 0, width: 595.28, height: 841.89 },
        { sourceDocumentId: second.source.id, sourcePageIndex: 0, rotation: 0, width: 841.89, height: 595.28 },
      ],
      sources: [
        { id: first.source.id, bytes: first.source.bytes },
        { id: second.source.id, bytes: second.source.bytes },
      ],
    });
    const merged = await PDFDocument.load(bytes);
    expect(merged.getPageCount()).toBe(2);
    expect(merged.getPage(0).getSize().height).toBeGreaterThan(merged.getPage(0).getSize().width);
    expect(merged.getPage(1).getSize().width).toBeGreaterThan(merged.getPage(1).getSize().height);
  });

  it("keeps duplicated pages and applies rotation", async () => {
    const source = await loadPdfBytes(fixture("one-page.pdf"), "one-page.pdf", { register: false });
    const page = { sourceDocumentId: source.source.id, sourcePageIndex: 0, rotation: 90 as const, width: 595.28, height: 841.89 };
    const bytes = await buildPdfBytes({
      pages: [page, page],
      sources: [{ id: source.source.id, bytes: source.source.bytes }],
    });
    const output = await PDFDocument.load(bytes);
    expect(output.getPageCount()).toBe(2);
    expect(output.getPage(0).getRotation().angle).toBe(90);
  });

  it("exports blank pages", async () => {
    const bytes = await buildPdfBytes({
      pages: [{ sourceDocumentId: "blank", sourcePageIndex: -1, rotation: 0, width: 400, height: 600 }],
      sources: [],
    });
    const output = await PDFDocument.load(bytes);
    expect(output.getPage(0).getSize()).toEqual({ width: 400, height: 600 });
  });
});
