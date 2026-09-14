import { PDF_LIMITS } from "./limits";

export interface DocumentWarning {
  code: "LARGE_FILE" | "MANY_PAGES" | "LARGE_PAGE" | "COMPLEX_DOCUMENT";
  message: string;
}

export interface WarningInput {
  sizeBytes: number;
  pageCount: number;
  maxPageDimensionPt?: number;
}

export const LARGE_DOCUMENT_MESSAGE =
  "Large document - This PDF may require additional processing time and memory on your device.";

export function collectWarnings(input: WarningInput): DocumentWarning[] {
  const warnings: DocumentWarning[] = [];
  const { warnings: thresholds } = PDF_LIMITS;

  if (input.sizeBytes >= thresholds.largeFileBytes) {
    warnings.push({ code: "LARGE_FILE", message: LARGE_DOCUMENT_MESSAGE });
  } else if (input.pageCount >= thresholds.largePageCount) {
    warnings.push({ code: "MANY_PAGES", message: LARGE_DOCUMENT_MESSAGE });
  }

  if (
    typeof input.maxPageDimensionPt === "number" &&
    input.maxPageDimensionPt >= thresholds.hugePageDimensionPt
  ) {
    warnings.push({
      code: "LARGE_PAGE",
      message:
        "Unusually large page size detected. Rendering may be downscaled to protect performance.",
    });
  }

  return warnings;
}
