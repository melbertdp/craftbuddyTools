const KB = 1024;
const MB = 1024 * KB;

export const BYTES = { KB, MB } as const;

export interface SizeLimit {
  maxFileSizeBytes: number;
  maxPages: number;
}

export const PDF_LIMITS = {
  general: { maxFileSizeBytes: 50 * MB, maxPages: 100 } satisfies SizeLimit,
  edit: { maxFileSizeBytes: 50 * MB, maxPages: 50 } satisfies SizeLimit,
  sign: { maxFileSizeBytes: 50 * MB, maxPages: 50 } satisfies SizeLimit,
  merge: {
    maxFileSizeBytes: 50 * MB,
    maxCombinedBytes: 100 * MB,
    maxCombinedPages: 200,
    maxDocuments: 20,
  },
  image: {
    maxFileSizeBytes: 20 * MB,
    maxCount: 50,
  },
  pdfToImage: {
    maxFileSizeBytes: 50 * MB,
    maxPages: 100,
  },
  imageToPdf: {
    maxImages: 50,
    maxImageBytes: 20 * MB,
  },
  render: {
    maxConcurrency: 2,
    maxCanvasDimension: 4096,
    maxCanvasPixels: 16_777_216,
    thumbnailWidth: 200,
    thumbnailMaxConcurrency: 3,
  },
  warnings: {
    largeFileBytes: 25 * MB,
    largePageCount: 60,
    largeCanvasPixels: 8_000_000,
    hugePageDimensionPt: 14_400,
    hugeEmbeddedImageBytes: 24 * MB,
  },
} as const;

export type LimitScope = "general" | "edit" | "sign";

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
}

export function limitFor(scope: LimitScope): SizeLimit {
  return PDF_LIMITS[scope];
}
