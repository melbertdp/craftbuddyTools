export type V2ColorClass = "BW" | "LIGHT" | "SEMI" | "FULL";
export type V2ContentClass = "TEXT" | "MIXED" | "IMAGE" | "SCANNED";

export type V2PageStatus = "pending" | "processing" | "complete" | "failed";

export interface V2PixelMetrics {
  inkCoverage: number;
  colorCoverage: number;
  bwCoverage: number;
  whiteCoverage: number;
  averageSaturation: number;
  averageBrightness: number;
  darkPixelCoverage: number;
  coloredInkCoverage: number;
}

export interface V2LayoutCoverage {
  textCoverage: number;
  imageCoverage: number;
  imageShare: number;
  modelUsed: "pp-doclayout" | "heuristic-fallback" | "none";
  regionCount: number;
}

export interface V2ClassifiedPage extends V2PixelMetrics {
  pageNumber: number;
  colorClass: V2ColorClass;
  contentClass: V2ContentClass;
  detectedCategory: V2ColorClass;
  overrideCategory: V2ColorClass | null;
  finalCategory: V2ColorClass;
  confidence: number;
  reviewRecommended: boolean;
  textCoverage: number;
  imageCoverage: number;
  layoutModel: V2LayoutCoverage["modelUsed"];
  previewUrl?: string;
  status: V2PageStatus;
  error?: string;
}

export interface V2Thresholds {
  backgroundLevel: number;
  colorChromaThreshold: number;
  colorSaturationThreshold: number;
  bwMaxColorCoverage: number;
  lightMaxColorCoverage: number;
  semiMaxColorCoverage: number;
  textMaxImageShare: number;
  imageMinImageShare: number;
  reviewConfidenceThreshold: number;
  scannedImageCoverage: number;
  scannedMaxColorCoverage: number;
  scannedMaxInkCoverage: number;
}

export interface V2Rates {
  bw: number;
  light: number;
  semi: number;
  full: number;
}

export const V2_COLOR_LABELS: Record<V2ColorClass, string> = {
  BW: "B&W",
  LIGHT: "Light Color",
  SEMI: "Semi Color",
  FULL: "Full Color",
};

export const V2_CONTENT_LABELS: Record<V2ContentClass, string> = {
  TEXT: "Text",
  MIXED: "Mixed",
  IMAGE: "Image",
  SCANNED: "Scanned",
};
