import { newId } from "./byte-store";
import { normalizeRotation } from "./coordinates";
import type { PdfPageModel, Rotation } from "@/pdf/types";

export function clonePage(page: PdfPageModel): PdfPageModel {
  return { ...page, id: newId("page") };
}

export function reorderPage(pages: PdfPageModel[], fromIndex: number, toIndex: number): PdfPageModel[] {
  if (fromIndex === toIndex) return pages;
  const next = [...pages];
  const clamped = Math.max(0, Math.min(toIndex, next.length - 1));
  const [moved] = next.splice(fromIndex, 1);
  if (!moved) return pages;
  next.splice(clamped, 0, moved);
  return next;
}

export function movePageById(pages: PdfPageModel[], pageId: string, toIndex: number): PdfPageModel[] {
  const fromIndex = pages.findIndex((page) => page.id === pageId);
  if (fromIndex < 0) return pages;
  return reorderPage(pages, fromIndex, toIndex);
}

export function deletePages(pages: PdfPageModel[], pageIds: Iterable<string>): PdfPageModel[] {
  const remove = new Set(pageIds);
  const next = pages.filter((page) => !remove.has(page.id));
  return next.length > 0 ? next : pages;
}

export function duplicatePages(pages: PdfPageModel[], pageIds: Iterable<string>): PdfPageModel[] {
  const target = new Set(pageIds);
  const next: PdfPageModel[] = [];
  for (const page of pages) {
    next.push(page);
    if (target.has(page.id)) next.push(clonePage(page));
  }
  return next;
}

export function rotatePages(
  pages: PdfPageModel[],
  pageIds: Iterable<string>,
  delta: number,
): PdfPageModel[] {
  const target = new Set(pageIds);
  return pages.map((page) =>
    target.has(page.id) ? { ...page, rotation: normalizeRotation(page.rotation + delta) } : page,
  );
}

export function setPageRotation(page: PdfPageModel, rotation: Rotation): PdfPageModel {
  return { ...page, rotation };
}

export function extractPageNumbers(pages: PdfPageModel[], pageNumbers: number[]): PdfPageModel[] {
  const wanted = new Set(pageNumbers);
  return pages.filter((_, index) => wanted.has(index + 1));
}

export function selectPageIdsByNumbers(pages: PdfPageModel[], pageNumbers: number[]): string[] {
  const wanted = new Set(pageNumbers);
  return pages.filter((_, index) => wanted.has(index + 1)).map((page) => page.id);
}

export interface BlankPageOptions {
  width?: number;
  height?: number;
  rotation?: Rotation;
  sourceDocumentId?: string;
}

export function createBlankPage(options: BlankPageOptions = {}): PdfPageModel {
  return {
    id: newId("page"),
    sourceDocumentId: options.sourceDocumentId ?? "blank",
    sourcePageIndex: -1,
    rotation: options.rotation ?? 0,
    width: options.width ?? 595.28,
    height: options.height ?? 841.89,
  };
}

export function createImagePage(
  width: number,
  height: number,
  rotation: Rotation = 0,
): PdfPageModel {
  return {
    id: newId("page"),
    sourceDocumentId: "image",
    sourcePageIndex: -1,
    rotation,
    width,
    height,
  };
}

export function insertPagesAt(
  pages: PdfPageModel[],
  newPages: PdfPageModel[],
  index: number,
): PdfPageModel[] {
  const clamped = Math.max(0, Math.min(index, pages.length));
  return [...pages.slice(0, clamped), ...newPages, ...pages.slice(clamped)];
}

export function insertAfterPage(
  pages: PdfPageModel[],
  pageId: string,
  newPages: PdfPageModel[],
): PdfPageModel[] {
  const index = pages.findIndex((page) => page.id === pageId);
  return insertPagesAt(pages, newPages, index < 0 ? pages.length : index + 1);
}

/** Compute a rotation delta that maps the current rotation to a target. */
export function rotationDelta(current: Rotation, target: Rotation): number {
  return target - current;
}
