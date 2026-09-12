import { PdfError } from "@/pdf/config/errors";
import { limitFor, type LimitScope } from "@/pdf/config/limits";
import { collectWarnings, type DocumentWarning } from "@/pdf/config/warnings";
import type { PdfMetadata, PdfPageModel, PdfSourceDocument, Rotation } from "@/pdf/types";
import { newId, pdfByteStore } from "./byte-store";
import { assertPdfBytes } from "./validation";
import { normalizeRotation } from "./coordinates";

export interface LoadedDocument {
  source: PdfSourceDocument;
  pages: PdfPageModel[];
  metadata: PdfMetadata;
  warnings: DocumentWarning[];
  maxPageDimension: number;
}

interface LoadOptions {
  scope?: LimitScope;
  maxPages?: number;
  register?: boolean;
}

function mapPdfLibError(error: unknown): PdfError {
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "EncryptedPDFError" || /encrypted/i.test(message)) {
    return new PdfError("PDF_ENCRYPTED");
  }
  if (/password/i.test(message)) return new PdfError("PDF_ENCRYPTED");
  if (/header|not a pdf|missing pdf/i.test(message)) return new PdfError("PDF_INVALID");
  return new PdfError("PDF_CORRUPTED", undefined, { cause: error });
}

export async function loadPdfBytes(
  bytes: Uint8Array,
  name: string,
  options: LoadOptions = {},
): Promise<LoadedDocument> {
  const scope = options.scope ?? "general";
  const limits = limitFor(scope);
  const maxPages = options.maxPages ?? limits.maxPages;

  const size = bytes.byteLength;
  if (size > limits.maxFileSizeBytes) {
    throw new PdfError(
      "PDF_TOO_LARGE",
      `This PDF is ${(size / (1024 * 1024)).toFixed(1)} MB. The limit is ${(
        limits.maxFileSizeBytes /
        (1024 * 1024)
      ).toFixed(0)} MB.`,
    );
  }
  assertPdfBytes(bytes);

  const { PDFDocument } = await import("pdf-lib");
  let pdf: import("pdf-lib").PDFDocument;
  let pageCount: number;
  let pages: PdfPageModel[] = [];
  let maxPageDimension = 0;
  try {
    pdf = await PDFDocument.load(bytes, { updateMetadata: false });
    pageCount = pdf.getPageCount();
    if (pageCount === 0) {
      throw new PdfError("PDF_INVALID", "This PDF does not contain any pages.");
    }
    if (pageCount > maxPages) {
      throw new PdfError(
        "PDF_TOO_MANY_PAGES",
        `This PDF has ${pageCount} pages. The limit for this tool is ${maxPages}.`,
      );
    }

    const id = newId("doc");
    for (let index = 0; index < pageCount; index += 1) {
      const page = pdf.getPage(index);
      const { width, height } = page.getSize();
      const rotation = normalizeRotation(page.getRotation().angle) as Rotation;
      maxPageDimension = Math.max(maxPageDimension, width, height);
      pages.push({
        id: newId("page"),
        sourceDocumentId: id,
        sourcePageIndex: index,
        rotation,
        width,
        height,
      });
    }
    if (options.register !== false) pdfByteStore.set(id, bytes);
  } catch (error) {
    if (error instanceof PdfError) throw error;
    throw mapPdfLibError(error);
  }

  const sourceId = pages[0].sourceDocumentId;
  const source: PdfSourceDocument = {
    id: sourceId,
    name,
    size,
    bytes,
    pageCount,
    encrypted: false,
  };

  return {
    source,
    pages,
    metadata: readMetadata(pdf),
    warnings: collectWarnings({ sizeBytes: size, pageCount, maxPageDimensionPt: maxPageDimension }),
    maxPageDimension,
  };
}

export function readMetadata(pdf: import("pdf-lib").PDFDocument): PdfMetadata {
  return {
    title: pdf.getTitle(),
    author: pdf.getAuthor(),
    subject: pdf.getSubject(),
    keywords: pdf.getKeywords(),
    creator: pdf.getCreator(),
    producer: pdf.getProducer(),
  };
}

export async function loadPdfFile(
  file: File,
  options: LoadOptions = {},
): Promise<LoadedDocument> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return loadPdfBytes(bytes, file.name, options);
}

export function releaseDocument(document: LoadedDocument): void {
  pdfByteStore.delete(document.source.id);
}
