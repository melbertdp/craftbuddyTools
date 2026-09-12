import { describe, expect, it } from "vitest";
import {
  createBlankPage,
  deletePages,
  duplicatePages,
  extractPageNumbers,
  insertAfterPage,
  insertPagesAt,
  movePageById,
  reorderPage,
  rotatePages,
  selectPageIdsByNumbers,
} from "@/pdf/core/page-engine";
import type { PdfPageModel } from "@/pdf/types";

function makePages(count: number): PdfPageModel[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `page-${index + 1}`,
    sourceDocumentId: "doc",
    sourcePageIndex: index,
    rotation: 0,
    width: 600,
    height: 800,
  }));
}

describe("page engine", () => {
  it("reorders pages", () => {
    const pages = makePages(4);
    const next = reorderPage(pages, 0, 2);
    expect(next.map((page) => page.id)).toEqual(["page-2", "page-3", "page-1", "page-4"]);
  });

  it("moves a page by id", () => {
    const pages = makePages(3);
    const next = movePageById(pages, "page-3", 0);
    expect(next.map((page) => page.id)).toEqual(["page-3", "page-1", "page-2"]);
  });

  it("deletes pages but keeps at least one", () => {
    const pages = makePages(3);
    expect(deletePages(pages, ["page-1"]).map((page) => page.id)).toEqual(["page-2", "page-3"]);
    expect(deletePages(pages, ["page-1", "page-2", "page-3"])).toHaveLength(3);
  });

  it("duplicates pages after the original", () => {
    const pages = makePages(2);
    const next = duplicatePages(pages, ["page-1"]);
    expect(next).toHaveLength(3);
    expect(next[1].sourcePageIndex).toBe(0);
    expect(next[1].id).not.toBe("page-1");
  });

  it("rotates selected pages only", () => {
    const pages = makePages(3);
    const next = rotatePages(pages, ["page-2"], 90);
    expect(next.map((page) => page.rotation)).toEqual([0, 90, 0]);
    expect(rotatePages(next, ["page-2"], -90)[1].rotation).toBe(0);
  });

  it("extracts pages by 1-based number", () => {
    const pages = makePages(5);
    expect(extractPageNumbers(pages, [1, 3, 5]).map((page) => page.id)).toEqual([
      "page-1",
      "page-3",
      "page-5",
    ]);
    expect(selectPageIdsByNumbers(pages, [2, 4])).toEqual(["page-2", "page-4"]);
  });

  it("inserts pages at positions", () => {
    const pages = makePages(2);
    const blank = createBlankPage();
    expect(insertPagesAt(pages, [blank], 1)[1].id).toBe(blank.id);
    expect(insertAfterPage(pages, "page-1", [blank])[1].id).toBe(blank.id);
  });
});
