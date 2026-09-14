import type { V2ClassifiedPage, V2ColorClass, V2Rates } from "./types";

export interface V2CategoryTotals {
  counts: Record<V2ColorClass, number>;
  subtotals: Record<V2ColorClass, number>;
  pageSubtotal: number;
  printedPages: number;
  copies: number;
}

export interface V2PriceOptions {
  copies: number;
  paperAdjustmentPerPage: number;
  addons: number;
  discount: number;
  otherCharges: number;
}

export function applyOverride(
  page: V2ClassifiedPage,
  override: V2ColorClass | null,
): V2ClassifiedPage {
  return {
    ...page,
    overrideCategory: override,
    finalCategory: override ?? page.detectedCategory,
  };
}

export function summarizeCategories(
  pages: V2ClassifiedPage[],
  rates: V2Rates,
  copiesRaw: number,
): V2CategoryTotals {
  const copies = Math.max(1, Math.floor(copiesRaw || 1));
  const counts: Record<V2ColorClass, number> = { BW: 0, LIGHT: 0, SEMI: 0, FULL: 0 };
  for (const page of pages) {
    if (page.status !== "complete") continue;
    counts[page.finalCategory] += 1;
  }
  const subtotals: Record<V2ColorClass, number> = {
    BW: counts.BW * rates.bw,
    LIGHT: counts.LIGHT * rates.light,
    SEMI: counts.SEMI * rates.semi,
    FULL: counts.FULL * rates.full,
  };
  const pageSubtotal = subtotals.BW + subtotals.LIGHT + subtotals.SEMI + subtotals.FULL;
  return {
    counts,
    subtotals,
    pageSubtotal,
    printedPages: pages.filter((p) => p.status === "complete").length * copies,
    copies,
  };
}

export function calculateV2Total(
  pages: V2ClassifiedPage[],
  rates: V2Rates,
  options: V2PriceOptions,
): V2CategoryTotals & {
  paperAdjustment: number;
  discountAmount: number;
  grandTotal: number;
} {
  const summary = summarizeCategories(pages, rates, options.copies);
  const completed = pages.filter((p) => p.status === "complete").length;
  const paperAdjustment = Math.max(0, options.paperAdjustmentPerPage) * completed * summary.copies;
  const preDiscount =
    summary.pageSubtotal * summary.copies + paperAdjustment + Math.max(0, options.addons) + Math.max(0, options.otherCharges);
  const discountAmount = Math.max(0, Math.min(preDiscount, options.discount));
  return {
    ...summary,
    paperAdjustment,
    discountAmount,
    grandTotal: Math.max(0, preDiscount - discountAmount),
  };
}

export function averageColorCoverage(pages: V2ClassifiedPage[]): number {
  const complete = pages.filter((p) => p.status === "complete");
  if (complete.length === 0) return 0;
  return (complete.reduce((sum, p) => sum + p.colorCoverage, 0) / complete.length) * 100;
}

export function reviewCount(pages: V2ClassifiedPage[]): number {
  return pages.filter((p) => p.reviewRecommended && p.status === "complete").length;
}
