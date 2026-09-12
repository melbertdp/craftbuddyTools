import { describe, expect, it } from "vitest";
import {
  expandRanges,
  parsePageList,
  parseRanges,
  summarizePages,
  toRanges,
  validatePageSelection,
} from "@/pdf/core/ranges";
import { PdfError } from "@/pdf/config/errors";

describe("page ranges", () => {
  it("parses single pages, ranges, and lists", () => {
    expect(parseRanges("1-5")).toEqual([{ from: 1, to: 5 }]);
    expect(parseRanges("1,3,7")).toEqual([
      { from: 1, to: 1 },
      { from: 3, to: 3 },
      { from: 7, to: 7 },
    ]);
    expect(parseRanges("1-3, 4-8, 10-15")).toEqual([
      { from: 1, to: 3 },
      { from: 4, to: 8 },
      { from: 10, to: 15 },
    ]);
  });

  it("rejects malformed input", () => {
    expect(() => parseRanges("")).toThrow(PdfError);
    expect(() => parseRanges("abc")).toThrow(PdfError);
    expect(() => parseRanges("5-2")).toThrow(PdfError);
    expect(() => parseRanges("0-3")).toThrow(PdfError);
  });

  it("expands and de-duplicates ranges", () => {
    expect(expandRanges(parseRanges("1-3,2-4"))).toEqual([1, 2, 3, 4]);
  });

  it("validates against page count", () => {
    expect(parsePageList("1-3", 5)).toEqual([1, 2, 3]);
    expect(() => validatePageSelection([9], 5)).toThrow(/does not exist/);
    expect(() => validatePageSelection([], 5)).toThrow(PdfError);
  });

  it("summarizes page numbers into ranges", () => {
    expect(summarizePages([1, 2, 3, 7, 8, 10])).toEqual(["1-3", "7-8", "10"]);
    expect(summarizePages([5])).toEqual(["5"]);
  });

  it("clamps ranges to the document length", () => {
    expect(toRanges("1-10", 4)).toEqual([{ from: 1, to: 4 }]);
  });
});
