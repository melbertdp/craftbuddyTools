import {
  marketUnitPrice,
  type ColorClass,
  type ContentType,
  type MarketService,
} from "./market-pricing";

export type CalculationMethod = "margin" | "amount" | "price";
export type PrintPricingBasis = "markup" | "margin";

export function calculatePricing(input: {
  totalCostBase: number;
  method: CalculationMethod;
  margin: number;
  amount: number;
  price: number;
  discount: number;
  tax: number;
}) {
  const cost = Math.max(0, input.totalCostBase);
  let profit = 0;
  let listingPrice = 0;
  if (input.method === "margin") {
    profit = (cost * Math.max(0, input.margin)) / 100;
    listingPrice = cost + profit - (profit * Math.max(0, input.discount)) / 100;
  } else if (input.method === "amount") {
    profit = Math.max(0, input.amount);
    listingPrice = cost + profit - (profit * Math.max(0, input.discount)) / 100;
  } else {
    listingPrice = Math.max(0, input.price);
    profit = listingPrice - cost;
  }
  const salesTax = (listingPrice * Math.max(0, input.tax)) / 100;
  const finalPrice = listingPrice + salesTax;
  return {
    listingPrice,
    profit,
    salesTax,
    finalPrice,
    discountAmount:
      input.method === "price"
        ? 0
        : (profit * Math.max(0, input.discount)) / 100,
    actualMargin: finalPrice ? (profit / finalPrice) * 100 : 0,
  };
}

export interface PrintProfile {
  id: string;
  name: string;
  paperCost: number;
  inkCostPerMl: number;
  qualityRates: Record<string, number>;
}

export type PaperType = "Bond paper" | "Glossy" | "Matte";
export type PaperSize = "A4" | "A5" | "Letter" | "Legal" | "4R" | "5R" | "A3";
export const PAPER_SIZES: Record<
  PaperSize,
  { label: string; widthIn: number; heightIn: number }
> = {
  A4: { label: "A4 · 210 × 297 mm", widthIn: 8.27, heightIn: 11.69 },
  A5: { label: "A5 · 148 × 210 mm", widthIn: 5.83, heightIn: 8.27 },
  Letter: { label: "US Letter · 8.5 × 11 in", widthIn: 8.5, heightIn: 11 },
  Legal: { label: "US Legal · 8.5 × 14 in", widthIn: 8.5, heightIn: 14 },
  "4R": { label: "4R · 4 × 6 in", widthIn: 4, heightIn: 6 },
  "5R": { label: "5R · 5 × 7 in", widthIn: 5, heightIn: 7 },
  A3: { label: "A3 · 297 × 420 mm", widthIn: 11.69, heightIn: 16.54 },
};
export const PAPER_TYPES: PaperType[] = ["Bond paper", "Glossy", "Matte"];
export const PAPER_TYPE_FACTORS: Record<
  PaperType,
  { ink: number; cost: number }
> = {
  "Bond paper": { ink: 0.7, cost: 1 },
  Glossy: { ink: 1, cost: 1 },
  Matte: { ink: 0.9, cost: 1 },
};
export const COLOR_INK_FACTORS: Record<ColorClass, number> = {
  black_white: 1,
  partial_color: 1,
  full_color: 1.5,
};

export const DEFAULT_PROFILE: PrintProfile = {
  id: "default-epson",
  name: "Epson-style photo printer",
  paperCost: 10,
  inkCostPerMl: 420 / 250,
  qualityRates: { Draft: 0.012, Standard: 0.016, High: 0.018, Best: 0.02 },
};

export function calculatePrintCost(input: {
  pages: { cyan: number; magenta: number; yellow: number; black: number }[];
  profile: PrintProfile;
  paperSize: PaperSize;
  paperType: PaperType;
  quality: string;
  copies: number;
  maintenance: number;
  electricity: number;
  labor: number;
  waste: number;
  overhead: number;
  margin: number;
  pricingBasis?: PrintPricingBasis;
  other: number;
  printType: MarketService;
  rounding:
    | "none"
    | "nearest-1"
    | "up-1"
    | "nearest-5"
    | "up-5"
    | "nearest-10"
    | "up-10";
  contentType?: ContentType;
  colorClass?: ColorClass;
}) {
  const pages = input.pages.length
    ? input.pages
    : [{ cyan: 0, magenta: 0, yellow: 0, black: 0 }];
  const copies = Math.max(0, Math.floor(input.copies));
  const pageCount = pages.length * copies;
  const paper = PAPER_SIZES[input.paperSize];
  const area = paper.widthIn * paper.heightIn;
  const rate =
    (input.profile.qualityRates[input.quality] ?? 0) *
    PAPER_TYPE_FACTORS[input.paperType].ink *
    COLOR_INK_FACTORS[input.colorClass ?? "black_white"];
  const measuredInkLoad =
    pages.reduce(
      (sum, page) =>
        sum +
        page.cyan + page.magenta + page.yellow + page.black,
      0,
    ) / pages.length;
  const contentFactor =
    input.contentType === "image_only"
      ? 1.3
      : input.contentType === "text_with_image"
        ? 1.15
        : 1;
  const colorFactor =
    input.colorClass === "full_color"
      ? 1.5
      : input.colorClass === "partial_color"
        ? 1.25
        : 1;
  const average = measuredInkLoad * contentFactor * colorFactor;
  const inkMl = rate * area * average * pageCount;
  const inkCost = inkMl * Math.max(0, input.profile.inkCostPerMl);
  const paperCost =
    pageCount *
    Math.max(0, input.profile.paperCost) *
    PAPER_TYPE_FACTORS[input.paperType].cost;
  const maintenanceCost = Math.max(0, input.maintenance) * pageCount;
  const electricityCost = Math.max(0, input.electricity) * pageCount;
  const laborCost = Math.max(0, input.labor) * pageCount;
  const wasteCost = ((inkCost + paperCost) * Math.max(0, input.waste)) / 100;
  const productionSubtotal =
    inkCost +
    paperCost +
    maintenanceCost +
    electricityCost +
    laborCost +
    wasteCost +
    Math.max(0, input.other);
  const overhead = (productionSubtotal * Math.max(0, input.overhead)) / 100;
  const totalCost = productionSubtotal + overhead;
  const costPerPrint = pageCount ? totalCost / pageCount : 0;
  const targetRate = Math.max(0, input.margin) / 100;
  const rawPrice =
    input.pricingBasis === "margin"
      ? targetRate < 1
        ? costPerPrint / (1 - targetRate)
        : 0
      : costPerPrint * (1 + targetRate);
  const step = input.rounding.endsWith("-10")
    ? 10
    : input.rounding.endsWith("-5")
      ? 5
      : input.rounding.endsWith("-1")
        ? 1
        : 0;
  const suggestedPricePerPrint = step
    ? (input.rounding.startsWith("up")
        ? Math.ceil(rawPrice / step)
        : Math.round(rawPrice / step)) * step
    : rawPrice;
  const suggestedJobPrice = suggestedPricePerPrint * pageCount;
  const marketUnit = marketUnitPrice({
    service: input.printType,
    size: input.paperSize,
    contentType: input.contentType ?? "text_only",
    colorClass: input.colorClass ?? "black_white",
  });
  return {
    pageCount,
    inkMl,
    inkCost,
    paperCost,
    maintenanceCost,
    electricityCost,
    laborCost,
    wasteCost,
    productionSubtotal,
    overhead,
    totalCost,
    costPerPrint,
    suggestedPricePerPrint,
    suggestedJobPrice,
    profit: suggestedJobPrice - totalCost,
    actualMargin: suggestedJobPrice
      ? ((suggestedJobPrice - totalCost) / suggestedJobPrice) * 100
      : 0,
    averageInkLoad: average * 100,
    marketUnitPrice: marketUnit,
    marketReference: marketUnit == null ? null : marketUnit * pageCount,
    marketReferenceAvailable: marketUnit != null,
  };
}
