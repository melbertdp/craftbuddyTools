import { PdfError } from "@/pdf/config/errors";

const PDF_MAGIC = "%PDF-";
const MAX_SIGNATURE_SCAN = 1024;

/** Verify the PDF magic bytes rather than trusting filename or MIME type. */
export function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  const limit = Math.min(bytes.length, MAX_SIGNATURE_SCAN);
  for (let i = 0; i <= limit - PDF_MAGIC.length; i += 1) {
    let match = true;
    for (let j = 0; j < PDF_MAGIC.length; j += 1) {
      if (bytes[i + j] !== PDF_MAGIC.charCodeAt(j)) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

export function sniffImageFormat(bytes: Uint8Array): "png" | "jpeg" | "webp" | undefined {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpeg";
  }
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    return "webp";
  }
  return undefined;
}

export async function readFileBytes(file: File | Blob): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

export function assertPdfBytes(bytes: Uint8Array): void {
  if (bytes.length === 0) {
    throw new PdfError("PDF_INVALID", "This file is empty.");
  }
  if (!hasPdfMagicBytes(bytes)) {
    throw new PdfError(
      "PDF_INVALID",
      "This file does not look like a PDF. It may be renamed or damaged.",
    );
  }
}
