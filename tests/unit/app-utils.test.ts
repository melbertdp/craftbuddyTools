import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";
import { expandRanges, parseRanges, summarizePages, validatePageSelection } from "@/pdf/core/ranges";
import { PdfError } from "@/pdf/config/errors";

describe("cn", () => {
  it("merges class names and resolves tailwind conflicts", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("a", false && "b", undefined, null, "c")).toBe("a c");
    expect(cn(["a", "b"], { c: true, d: false })).toBe("a b c");
    expect(cn("text-sm", "text-lg", "font-bold")).toBe("text-lg font-bold");
  });
});

describe("ranges extra branches", () => {
  it("trims whitespace and tolerates spaces around dashes", () => {
    expect(parseRanges("  1  -  3 , 5 ")).toEqual([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
    ]);
  });

  it("rejects empty segments and zero pages", () => {
    expect(() => parseRanges("1,,2")).not.toThrow(); // empty segments filtered
    expect(() => parseRanges("1-")).toThrow(PdfError);
    expect(() => parseRanges("-3")).toThrow(PdfError);
    expect(() => parseRanges("0")).toThrow(PdfError);
  });

  it("expands overlapping ranges sorted and deduped", () => {
    expect(expandRanges([{ from: 5, to: 7 }, { from: 1, to: 3 }, { from: 2, to: 6 }])).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(expandRanges([])).toEqual([]);
  });

  it("validate reports singular vs plural page counts", () => {
    expect(() => validatePageSelection([2], 1)).toThrow(/1 page\./);
    expect(() => validatePageSelection([9], 5)).toThrow(/5 pages/);
  });

  it("summarize handles unsorted, duplicated and empty input", () => {
    expect(summarizePages([3, 1, 2, 2, 1])).toEqual(["1-3"]);
    expect(summarizePages([])).toEqual([]);
    expect(summarizePages([10, 8, 9])).toEqual(["8-10"]);
  });
});
