import { describe, expect, it } from "vitest";
import {
  calculatePricing,
  calculatePrintCost,
  DEFAULT_PROFILE,
  PAPER_SIZES,
  PAPER_TYPES,
  type PaperSize,
  type PaperType,
} from "@/lib/calculator";
import {
  DOCUMENT_MARKET_PRICING,
  marketUnitPrice,
  PHOTO_MARKET_PRICING,
  type ColorClass,
  type ContentType,
  type MarketService,
} from "@/lib/market-pricing";

type PrintCostInput = Parameters<typeof calculatePrintCost>[0];
type PricingInput = Parameters<typeof calculatePricing>[0];

const page = (value: number) => ({
  cyan: value,
  magenta: value,
  yellow: value,
  black: value,
});

const makePrintInput = (
  overrides: Partial<PrintCostInput> = {},
): PrintCostInput => ({
  pages: [page(0)],
  profile: {
    ...DEFAULT_PROFILE,
    paperCost: 10,
    inkCostPerMl: 2,
    qualityRates: { Draft: 0, Standard: 0, High: 0, Best: 0 },
  },
  paperSize: "A4",
  paperType: "Bond paper",
  quality: "Standard",
  copies: 1,
  maintenance: 1,
  electricity: 0.5,
  labor: 0.25,
  waste: 10,
  overhead: 10,
  margin: 20,
  pricingBasis: "markup",
  other: 4,
  printType: "document_print",
  rounding: "none",
  contentType: "text_only",
  colorClass: "black_white",
  ...overrides,
});

describe("calculatePrintCost", () => {
  it("calculates every cost component and derived value", () => {
    const result = calculatePrintCost(makePrintInput({ pages: [page(0), page(0)], copies: 2 }));

    expect(result.pageCount).toBe(4);
    expect(result.inkMl).toBe(0);
    expect(result.inkCost).toBe(0);
    expect(result.paperCost).toBe(40);
    expect(result.maintenanceCost).toBe(4);
    expect(result.electricityCost).toBe(2);
    expect(result.laborCost).toBe(1);
    expect(result.wasteCost).toBe(4);
    expect(result.productionSubtotal).toBe(55);
    expect(result.overhead).toBe(5.5);
    expect(result.totalCost).toBe(60.5);
    expect(result.costPerPrint).toBe(15.125);
    expect(result.suggestedPricePerPrint).toBe(18.15);
    expect(result.suggestedJobPrice).toBe(72.6);
    expect(result.profit).toBeCloseTo(12.1);
    expect(result.actualMargin).toBeCloseTo(16.6666667);
    expect(result.marketUnitPrice).toBe(5);
    expect(result.marketReference).toBe(20);
    expect(result.marketReferenceAvailable).toBe(true);
  });

  it("averages ink load across pages before applying page count", () => {
    const result = calculatePrintCost(
      makePrintInput({
        pages: [page(0.1), page(0.3)],
        copies: 1,
        profile: { ...makePrintInput().profile, inkCostPerMl: 1, qualityRates: { Standard: 1 } },
        maintenance: 0,
        electricity: 0,
        labor: 0,
        waste: 0,
        overhead: 0,
        other: 0,
      }),
    );

    expect(result.averageInkLoad).toBe(80);
    expect(result.inkMl).toBeCloseTo(1 * 0.7 * 8.27 * 11.69 * 0.8 * 2);
  });

  it.each(PAPER_TYPES)("supports %s paper pricing", (paperType: PaperType) => {
    const result = calculatePrintCost(makePrintInput({ paperType }));
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
    expect(result.paperCost).toBe(10);
  });

  it.each(Object.keys(PAPER_SIZES) as PaperSize[])("supports %s paper size", (paperSize) => {
    const result = calculatePrintCost(makePrintInput({ paperSize }));
    expect(result.totalCost).toBeGreaterThanOrEqual(0);
    expect(result.marketReferenceAvailable).toBe(
      paperSize === "A4",
    );
  });

  it.each(["Draft", "Standard", "High", "Best"])("supports %s quality", (quality) => {
    const result = calculatePrintCost(makePrintInput({ quality }));
    expect(Number.isFinite(result.totalCost)).toBe(true);
  });

  it("uses zero ink for an unknown quality", () => {
    const result = calculatePrintCost(
      makePrintInput({ pages: [page(100)], quality: "Missing quality" }),
    );
    expect(result.inkCost).toBe(0);
  });

  it.each([
    ["text_only", "black_white", 1],
    ["text_with_image", "partial_color", 1.15 * 1.25],
    ["image_only", "full_color", 1.3 * 1.5],
  ] as [ContentType, ColorClass, number][])(
    "applies %s and %s content factors",
    (contentType, colorClass, factor) => {
      const result = calculatePrintCost(
        makePrintInput({
          pages: [page(0.1)],
          contentType,
          colorClass,
          profile: { ...makePrintInput().profile, inkCostPerMl: 1, qualityRates: { Standard: 1 } },
          maintenance: 0,
          electricity: 0,
          labor: 0,
          waste: 0,
          overhead: 0,
          other: 0,
        }),
      );
      expect(result.averageInkLoad).toBeCloseTo(40 * factor);
    },
  );

  it("scales per-page costs and market totals with pages and copies", () => {
    const one = calculatePrintCost(makePrintInput({ pages: [page(0)], copies: 1, other: 0 }));
    const many = calculatePrintCost(
      makePrintInput({ pages: [page(0), page(0)], copies: 3, other: 0 }),
    );

    expect(many.pageCount).toBe(one.pageCount * 6);
    expect(many.totalCost).toBeCloseTo(one.totalCost * 6);
    expect(many.marketReference).toBe(one.marketReference! * 6);
  });

  it("floors fractional copies and clamps negative copies", () => {
    expect(calculatePrintCost(makePrintInput({ copies: 2.9 })).pageCount).toBe(2);
    expect(calculatePrintCost(makePrintInput({ copies: -2 })).pageCount).toBe(0);
  });

  it("clamps negative cost inputs", () => {
    const result = calculatePrintCost(
      makePrintInput({
        profile: { ...makePrintInput().profile, paperCost: -10, inkCostPerMl: -2 },
        maintenance: -1,
        electricity: -1,
        labor: -1,
        waste: -10,
        overhead: -10,
        margin: -20,
        other: -4,
      }),
    );
    expect(result.totalCost).toBe(0);
    expect(result.suggestedJobPrice).toBe(0);
    expect(result.profit).toBe(0);
  });

  it("supports markup and margin pricing", () => {
    const markup = calculatePrintCost(makePrintInput({ margin: 25, pricingBasis: "markup" }));
    const margin = calculatePrintCost(makePrintInput({ margin: 25, pricingBasis: "margin" }));

    expect(markup.suggestedPricePerPrint).toBeCloseTo(markup.costPerPrint * 1.25);
    expect(margin.suggestedPricePerPrint).toBeCloseTo(margin.costPerPrint / 0.75);
  });

  it.each([
    ["none", 22.11],
    ["nearest-1", 22],
    ["up-1", 23],
    ["nearest-5", 20],
    ["up-5", 25],
    ["nearest-10", 20],
    ["up-10", 30],
  ] as const)("applies %s rounding per print", (rounding, expected) => {
    const result = calculatePrintCost(makePrintInput({ rounding }));
    expect(result.suggestedPricePerPrint).toBe(expected);
  });

  it("returns unavailable market pricing for unsupported combinations", () => {
    const result = calculatePrintCost(makePrintInput({ paperSize: "A5" }));
    expect(result.marketUnitPrice).toBeNull();
    expect(result.marketReference).toBeNull();
    expect(result.marketReferenceAvailable).toBe(false);
  });

  it("handles empty pages and zero copies without throwing", () => {
    const empty = calculatePrintCost(makePrintInput({ pages: [], copies: 1 }));
    const zero = calculatePrintCost(makePrintInput({ pages: [], copies: 0 }));
    expect(Number.isFinite(empty.totalCost)).toBe(true);
    expect(zero.pageCount).toBe(0);
    expect(Number.isFinite(zero.totalCost)).toBe(true);
  });
});

describe("marketUnitPrice", () => {
  it("matches every document market table entry", () => {
    for (const contentType of Object.keys(DOCUMENT_MARKET_PRICING) as ContentType[]) {
      for (const colorClass of Object.keys(DOCUMENT_MARKET_PRICING[contentType]) as ColorClass[]) {
        for (const size of ["short", "A4", "long"] as const) {
          expect(
            marketUnitPrice({ service: "document_print", size, contentType, colorClass }),
          ).toBe(DOCUMENT_MARKET_PRICING[contentType][colorClass][size]);
        }
      }
    }
  });

  it("matches every photo market table entry", () => {
    for (const size of Object.keys(PHOTO_MARKET_PRICING)) {
      expect(
        marketUnitPrice({
          service: "photo_print",
          size,
          contentType: "text_only",
          colorClass: "black_white",
        }),
      ).toBe(PHOTO_MARKET_PRICING[size as keyof typeof PHOTO_MARKET_PRICING]);
    }
  });

  it("returns null for unsupported sizes", () => {
    expect(
      marketUnitPrice({
        service: "document_print",
        size: "A5",
        contentType: "text_only",
        colorClass: "black_white",
      }),
    ).toBeNull();
    expect(
      marketUnitPrice({
        service: "photo_print",
        size: "A3",
        contentType: "text_only",
        colorClass: "black_white",
      }),
    ).toBeNull();
  });
});

describe("calculatePricing", () => {
  const input = (overrides: Partial<PricingInput> = {}): PricingInput => ({
    totalCostBase: 100,
    method: "margin",
    margin: 25,
    amount: 30,
    price: 150,
    discount: 10,
    tax: 12,
    ...overrides,
  });

  it("calculates margin pricing with discount and tax", () => {
    const result = calculatePricing(input());
    expect(result.profit).toBe(25);
    expect(result.discountAmount).toBe(2.5);
    expect(result.listingPrice).toBe(122.5);
    expect(result.salesTax).toBe(14.7);
    expect(result.finalPrice).toBe(137.2);
    expect(result.actualMargin).toBeCloseTo(18.2215743);
  });

  it("calculates fixed amount pricing", () => {
    const result = calculatePricing(input({ method: "amount", amount: 40 }));
    expect(result.profit).toBe(40);
    expect(result.discountAmount).toBe(4);
    expect(result.listingPrice).toBe(136);
    expect(result.finalPrice).toBeCloseTo(152.32);
  });

  it("calculates fixed price pricing without a discount amount", () => {
    const result = calculatePricing(input({ method: "price", price: 150 }));
    expect(result.profit).toBe(50);
    expect(result.discountAmount).toBe(0);
    expect(result.listingPrice).toBe(150);
    expect(result.finalPrice).toBe(168);
  });

  it("clamps negative numeric inputs to zero", () => {
    const result = calculatePricing(
      input({ totalCostBase: -100, margin: -25, amount: -40, price: -150, discount: -10, tax: -12 }),
    );
    expect(result.listingPrice).toBe(0);
    expect(result.profit).toBe(0);
    expect(result.salesTax).toBe(0);
    expect(result.finalPrice).toBe(0);
    expect(result.actualMargin).toBe(0);
  });

  it("handles a price below cost", () => {
    const result = calculatePricing(input({ method: "price", price: 80 }));
    expect(result.profit).toBe(-20);
    expect(result.finalPrice).toBe(89.6);
    expect(result.actualMargin).toBeCloseTo(-22.3214286);
  });

  it("handles zero and over-100% margin without Infinity", () => {
    const zero = calculatePricing(input({ margin: 0 }));
    const over = calculatePricing(input({ margin: 100 }));
    expect(zero.listingPrice).toBe(100);
    expect(over.listingPrice).toBe(190);
    expect(Number.isFinite(over.finalPrice)).toBe(true);
  });

  it("does not apply discount amount in fixed-price mode", () => {
    const result = calculatePricing(input({ method: "price", discount: 100 }));
    expect(result.discountAmount).toBe(0);
    expect(result.listingPrice).toBe(150);
  });
});

describe("runtime-invalid market input", () => {
  it("returns unavailable for an unsupported market service", () => {
    const service = "unknown" as MarketService;
    expect(
      marketUnitPrice({
        service,
        size: "A4",
        contentType: "text_only",
        colorClass: "black_white",
      }),
    ).toBeNull();
  });
});
