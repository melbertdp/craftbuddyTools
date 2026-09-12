import { PdfError } from "@/pdf/config/errors";
import type { PageRange } from "@/pdf/types";

/** Parse "1-5, 8, 10-12" into normalized 1-based inclusive ranges. */
export function parseRanges(input: string): PageRange[] {
  const cleaned = input.trim();
  if (!cleaned) throw new PdfError("INVALID_SELECTION", "Enter at least one page or range.");

  const parts = cleaned.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    throw new PdfError("INVALID_SELECTION", "Enter at least one page or range.");
  }

  const ranges: PageRange[] = [];
  for (const part of parts) {
    const match = /^(\d+)\s*(?:-\s*(\d+))?$/.exec(part);
    if (!match) {
      throw new PdfError("INVALID_SELECTION", `"${part}" is not a valid page or range.`);
    }
    const from = Number(match[1]);
    const to = match[2] === undefined ? from : Number(match[2]);
    if (from < 1 || to < 1) {
      throw new PdfError("INVALID_SELECTION", "Page numbers start at 1.");
    }
    if (from > to) {
      throw new PdfError("INVALID_SELECTION", `"${part}" has an end before its start.`);
    }
    ranges.push({ from, to });
  }
  return ranges;
}

/** Expand ranges into a de-duplicated, ascending list of 1-based page numbers. */
export function expandRanges(ranges: PageRange[]): number[] {
  const seen = new Set<number>();
  for (const range of ranges) {
    for (let page = range.from; page <= range.to; page += 1) seen.add(page);
  }
  return [...seen].sort((a, b) => a - b);
}

export function parsePageList(input: string, pageCount: number): number[] {
  const pages = expandRanges(parseRanges(input));
  return validatePageSelection(pages, pageCount);
}

export function validatePageSelection(pages: number[], pageCount: number): number[] {
  if (pages.length === 0) {
    throw new PdfError("INVALID_SELECTION", "Select at least one page.");
  }
  const outOfRange = pages.filter((page) => page < 1 || page > pageCount);
  if (outOfRange.length > 0) {
    throw new PdfError(
      "INVALID_SELECTION",
      `This document has ${pageCount} page${pageCount === 1 ? "" : "s"}. Page ${outOfRange[0]} does not exist.`,
    );
  }
  return pages;
}

/** Split page numbers into consecutive groups, e.g. [1,2,3,7,8] -> ["1-3","7-8"]. */
export function summarizePages(pages: number[]): string[] {
  const sorted = [...new Set(pages)].sort((a, b) => a - b);
  const groups: string[] = [];
  let start: number | undefined;
  let prev: number | undefined;
  for (const page of sorted) {
    if (start === undefined) {
      start = page;
    } else if (prev !== undefined && page !== prev + 1) {
      groups.push(start === prev ? `${start}` : `${start}-${prev}`);
      start = page;
    }
    prev = page;
  }
  if (start !== undefined && prev !== undefined) {
    groups.push(start === prev ? `${start}` : `${start}-${prev}`);
  }
  return groups;
}

/** Group selected pages into ranges for multi-output splitting. */
export function toRanges(input: string, pageCount: number): PageRange[] {
  const ranges = parseRanges(input).map((range) => ({
    from: range.from,
    to: Math.min(range.to, pageCount),
  }));
  const pages = expandRanges(ranges);
  validatePageSelection(pages, pageCount);
  return ranges;
}
