export interface PageSizePreset {
  id: "a4" | "letter" | "legal" | "original";
  label: string;
  width: number;
  height: number;
}

export const PAGE_SIZE_PRESETS: PageSizePreset[] = [
  { id: "a4", label: "A4 (210 × 297 mm)", width: 595.28, height: 841.89 },
  { id: "letter", label: "Letter (8.5 × 11 in)", width: 612, height: 792 },
  { id: "legal", label: "Legal (8.5 × 14 in)", width: 612, height: 1008 },
  { id: "original", label: "Original image dimensions", width: 0, height: 0 },
];

export function getPageSizePreset(id: PageSizePreset["id"]): PageSizePreset {
  return PAGE_SIZE_PRESETS.find((preset) => preset.id === id) ?? PAGE_SIZE_PRESETS[0];
}

export type PageOrientation = "portrait" | "landscape";
export type ImagePlacement = "fit" | "fill" | "original" | "stretch";

export interface PlacementResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PlacementInput {
  pageWidth: number;
  pageHeight: number;
  imageWidth: number;
  imageHeight: number;
  placement: ImagePlacement;
  margin: number;
}

/** Compute an image rectangle inside a PDF page (bottom-left origin, points). */
export function computePlacement(input: PlacementInput): PlacementResult {
  const { pageWidth, pageHeight, imageWidth, imageHeight, margin, placement } = input;
  const availableWidth = Math.max(1, pageWidth - margin * 2);
  const availableHeight = Math.max(1, pageHeight - margin * 2);
  const safeImageWidth = Math.max(1, imageWidth);
  const safeImageHeight = Math.max(1, imageHeight);

  if (placement === "stretch") {
    return { x: margin, y: margin, width: availableWidth, height: availableHeight };
  }

  if (placement === "original") {
    const width = Math.min(safeImageWidth, pageWidth);
    const height = Math.min(safeImageHeight, pageHeight);
    return {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    };
  }

  if (placement === "fill") {
    const scaleCover = Math.max(availableWidth / safeImageWidth, availableHeight / safeImageHeight);
    const width = safeImageWidth * scaleCover;
    const height = safeImageHeight * scaleCover;
    return {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2,
      width,
      height,
    };
  }

  // fit (contain)
  const scaleFit = Math.min(availableWidth / safeImageWidth, availableHeight / safeImageHeight);
  const width = safeImageWidth * scaleFit;
  const height = safeImageHeight * scaleFit;
  return {
    x: (pageWidth - width) / 2,
    y: (pageHeight - height) / 2,
    width,
    height,
  };
}
