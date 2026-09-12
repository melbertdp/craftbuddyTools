export const PDF_ERROR_CODES = [
  "PDF_INVALID",
  "PDF_ENCRYPTED",
  "PDF_TOO_LARGE",
  "PDF_TOO_MANY_PAGES",
  "PDF_CORRUPTED",
  "UNSUPPORTED_DOCUMENT",
  "MEMORY_LIMIT",
  "RENDER_FAILED",
  "EXPORT_FAILED",
  "CONVERSION_FAILED",
  "OPERATION_CANCELLED",
  "INVALID_SELECTION",
  "PROCESSING_FAILED",
] as const;

export type PdfErrorCode = (typeof PDF_ERROR_CODES)[number];

const FALLBACK_MESSAGES: Record<PdfErrorCode, string> = {
  PDF_INVALID: "This file is not a valid PDF document.",
  PDF_ENCRYPTED: "This PDF is password-protected and cannot be opened.",
  PDF_TOO_LARGE: "This PDF is larger than the allowed size limit.",
  PDF_TOO_MANY_PAGES: "This PDF has more pages than this tool allows.",
  PDF_CORRUPTED: "This PDF appears to be damaged and could not be read.",
  UNSUPPORTED_DOCUMENT: "This document type is not supported by this tool.",
  MEMORY_LIMIT: "This document needs more memory than this device can safely provide.",
  RENDER_FAILED: "A page could not be rendered. The PDF may be damaged.",
  EXPORT_FAILED: "The document could not be exported. Please try again.",
  CONVERSION_FAILED: "The conversion could not be completed.",
  OPERATION_CANCELLED: "The operation was cancelled.",
  INVALID_SELECTION: "The selected pages are not valid.",
  PROCESSING_FAILED: "Something went wrong while processing this document.",
};

export class PdfError extends Error {
  readonly code: PdfErrorCode;
  readonly userMessage: string;
  readonly cause?: unknown;

  constructor(code: PdfErrorCode, userMessage?: string, options?: { cause?: unknown }) {
    super(userMessage ?? FALLBACK_MESSAGES[code]);
    this.name = "PdfError";
    this.code = code;
    this.userMessage = userMessage ?? FALLBACK_MESSAGES[code];
    this.cause = options?.cause;
  }
}

export function isPdfError(error: unknown): error is PdfError {
  return error instanceof PdfError;
}

export function toUserMessage(error: unknown): string {
  if (isPdfError(error)) return error.userMessage;
  if (error instanceof Error) {
    const text = error.message || "";
    if (/password/i.test(text)) return FALLBACK_MESSAGES.PDF_ENCRYPTED;
    if (/invalid pdf|not a pdf|missing pdf/i.test(text)) return FALLBACK_MESSAGES.PDF_INVALID;
    if (/out of memory|allocation failed/i.test(text)) return FALLBACK_MESSAGES.MEMORY_LIMIT;
  }
  return FALLBACK_MESSAGES.PROCESSING_FAILED;
}
