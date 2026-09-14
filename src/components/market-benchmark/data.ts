export type BenchmarkUnit = "per page" | "per piece" | "per package" | "per sq. inch" | "per job";

export type BenchmarkRecord = {
  id: string;
  category: string;
  service: string;
  variant?: string;
  size: string;
  marketLow: number;
  marketHigh: number;
  unit: BenchmarkUnit;
  notes?: string;
};

type Row = [string, string, number, number, BenchmarkUnit, string?];

function rows(category: string, values: Row[]): BenchmarkRecord[] {
  return values.map(([service, size, marketLow, marketHigh, unit, notes], index) => ({
    id: `${category.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${index + 1}`,
    category,
    service,
    size,
    marketLow,
    marketHigh,
    unit,
    notes,
  }));
}

export const BENCHMARK_CATEGORIES = [
  "Document Printing",
  "Photocopy / Xerox",
  "Photo Printing",
  "Rush ID",
  "Lamination",
  "Scanning",
  "Sticker / Vinyl",
  "Photo Cards",
  "Souvenirs",
] as const;

export const BENCHMARKS: BenchmarkRecord[] = [
  ...rows("Document Printing", [
    ["B&W - Text Only", "Short", 3, 5, "per page"], ["B&W - Text Only", "A4", 4, 6, "per page"], ["B&W - Text Only", "Long", 6, 7, "per page"],
    ["B&W - Text + Image", "Short", 6, 7, "per page"], ["B&W - Text + Image", "A4", 7, 8, "per page"], ["B&W - Text + Image", "Long", 8, 10, "per page"],
    ["B&W - Picture Only", "Short", 5, 6, "per page"], ["B&W - Picture Only", "A4", 6, 10, "per page"], ["B&W - Picture Only", "Long", 7, 10, "per page"],
    ["B&W - Full Image", "Short", 8, 10, "per page"], ["B&W - Full Image", "A4", 10, 12, "per page"], ["B&W - Full Image", "Long", 12, 15, "per page"],
    ["Colored - Text Only", "Short", 6, 8, "per page"], ["Colored - Text Only", "A4", 7, 10, "per page"], ["Colored - Text Only", "Long", 8, 12, "per page"],
    ["Colored - Text + Image", "Short", 9, 10, "per page"], ["Colored - Text + Image", "A4", 10, 12, "per page"], ["Colored - Text + Image", "Long", 11, 15, "per page"],
    ["Colored - Picture Only", "Short", 8, 10, "per page"], ["Colored - Picture Only", "A4", 9, 12, "per page"], ["Colored - Picture Only", "Long", 10, 15, "per page"],
    ["Colored - Full Image", "Short", 12, 15, "per page"], ["Colored - Full Image", "A4", 13, 18, "per page"], ["Colored - Full Image", "Long", 15, 20, "per page"],
  ]),
  ...rows("Photocopy / Xerox", [
    ["B&W Photocopy", "Short", 2, 4, "per page"], ["B&W Photocopy", "A4", 2, 5, "per page"], ["B&W Photocopy", "Long", 4, 7, "per page"],
    ["Colored Photocopy", "Short", 5, 10, "per page"], ["Colored Photocopy", "A4", 5, 10, "per page"], ["Colored Photocopy", "Long", 6, 10, "per page"],
    ["Back-to-Back Add-on", "Any applicable size", 2, 5, "per page", "Additional charge commonly observed for back-to-back printing."],
  ]),
  ...rows("Photo Printing", [
    ["Wallet", "Approx. 2 × 3 in", 4, 7, "per piece", "Often sold in bundles of 9–10 pieces. Bundle pricing and minimum quantities are common for smaller photo sizes."],
    ["2R", "2.5 × 3.5 in", 5, 10, "per piece", "Some providers apply minimum quantities. Bundle pricing and minimum quantities are common for smaller photo sizes."],
    ["3R", "3.5 × 5 in", 8, 15, "per piece", "Bundle pricing and minimum quantities are common for smaller photo sizes."],
    ["4R", "4 × 6 in", 10, 20, "per piece", "Bundle pricing and minimum quantities are common for smaller photo sizes."],
    ["5R", "5 × 7 in", 15, 30, "per piece", "Bundle pricing and minimum quantities are common for smaller photo sizes."],
    ["6R", "6 × 8 in", 20, 40, "per piece", "Bundle pricing and minimum quantities are common for smaller photo sizes."],
    ["8R", "8 × 10 in", 30, 60, "per piece", "Bundle pricing and minimum quantities are common for smaller photo sizes."],
    ["A4 Photo", "Approx. 8.27 × 11.69 in", 40, 80, "per piece", "Bundle pricing and minimum quantities are common for smaller photo sizes."],
  ]),
  ...rows("Rush ID", [
    ["Basic Rush ID Package", "-", 35, 40, "per package", "Typically smaller 1×1 / 2×2 combinations."], ["Standard Rush ID Package", "-", 40, 50, "per package", "Typical mixed ID-size package."], ["Large Rush ID Package", "-", 50, 65, "per package", "Larger quantity or mixed-size package."], ["Soft Copy Add-on", "-", 10, 10, "per package", "Digital copy."], ["Formal Attire Editing", "-", 20, 20, "per package", "Optional photo editing service."],
  ]),
  ...rows("Lamination", [
    ["ID / Wallet - 125 Micron", "-", 15, 25, "per piece"], ["ID / Wallet - 250 Micron", "-", 20, 25, "per piece"], ["3R - 250 Micron", "-", 20, 20, "per piece"], ["4R - 250 Micron", "-", 25, 25, "per piece"], ["A6 - 125 Micron", "-", 25, 25, "per piece"], ["5R - 250 Micron", "-", 35, 35, "per piece"], ["A5 / Half A4 - 125 Micron", "-", 30, 40, "per piece"], ["A5 / Half A4 - 250 Micron", "-", 35, 45, "per piece"], ["6R - 250 Micron", "-", 40, 40, "per piece"], ["8R - 250 Micron", "-", 50, 50, "per piece"], ["A4 - 125 Micron", "-", 40, 50, "per piece"], ["A4 - 250 Micron", "-", 60, 70, "per piece"],
  ]),
  ...rows("Scanning", [
    ["Document Scan to Soft Copy", "Any common document size", 5, 15, "per page"], ["Scan + B&W Print", "-", 5, 5, "per page"], ["Scan + Color Print", "-", 10, 15, "per page", "Some low-cost providers may offer basic scanning below this benchmark."],
  ]),
  ...rows("Sticker / Vinyl", [
    ["Matte Sticker", "A4", 30, 40, "per page"], ["Glossy Sticker", "A4", 30, 50, "per page"], ["Photo Waterproof Sticker", "A4", 65, 80, "per page"], ["Waterproof Vinyl", "A4", 65, 65, "per page"], ["Vinyl Lettering", "Custom", 5, 5, "per sq. inch"], ["Custom Layout Add-on", "-", 10, 10, "per job"], ["Photo Editing Add-on", "-", 20, 20, "per job"],
  ]),
  ...rows("Photo Cards", [
    ["Large Photo Card", "11.94 × 17.02 cm", 70, 70, "per package", "Example package contains 2 pieces."], ["Standard Photo Card", "5.49 × 8.38 cm", 80, 80, "per package", "Example package contains 10 pieces."], ["Small Photo Card", "5.08 × 7.11 cm", 80, 80, "per package", "Example package contains 12 pieces."],
  ]),
  ...rows("Souvenirs", [
    ["Ref Magnet", "ATM Size", 25, 25, "per piece", "Minimum order may apply."], ["Baby Head Souvenir", "2 × 2 in", 20, 20, "per piece", "Observed minimum of 30 pieces."], ["Baby Head Souvenir", "2.5 × 3.5 in", 25, 25, "per piece", "Observed minimum of 30 pieces."],
  ]),
];
