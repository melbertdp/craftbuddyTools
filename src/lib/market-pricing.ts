export type ContentType = "text_only" | "image_only" | "text_with_image";
export type ColorClass = "black_white" | "partial_color" | "full_color";
export type MarketService = "document_print" | "photo_print";

export const DOCUMENT_MARKET_PRICING = {
  text_only: {
    black_white: { short: 4, A4: 5, long: 6 },
    partial_color: { short: 6, A4: 7, long: 8 },
    full_color: { short: 8, A4: 9, long: 10 },
  },
  image_only: {
    black_white: { short: 5, A4: 7, long: 9 },
    partial_color: { short: 8, A4: 10, long: 13 },
    full_color: { short: 15, A4: 20, long: 25 },
  },
  text_with_image: {
    black_white: { short: 6, A4: 8, long: 10 },
    partial_color: { short: 10, A4: 15, long: 20 },
    full_color: { short: 15, A4: 20, long: 25 },
  },
} as const;

export const PHOTO_MARKET_PRICING = {
  "4R": 18,
  "5R": 20,
  A4: 40,
} as const;

export function marketUnitPrice(input: {
  service: MarketService;
  size: string;
  contentType: ContentType;
  colorClass: ColorClass;
}): number | null {
  if (input.service === "photo_print") {
    return (
      PHOTO_MARKET_PRICING[input.size as keyof typeof PHOTO_MARKET_PRICING] ??
      null
    );
  }
  const size =
    input.size === "short" || input.size === "long" || input.size === "A4"
      ? input.size
      : null;
  if (!size) return null;
  return DOCUMENT_MARKET_PRICING[input.contentType][input.colorClass][size];
}
