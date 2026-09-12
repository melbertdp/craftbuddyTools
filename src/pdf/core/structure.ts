import { PdfError } from "@/pdf/config/errors";
import type { PdfMetadata, Rotation } from "@/pdf/types";

export interface StructureSource {
  id: string;
  bytes: Uint8Array;
}

export interface StructurePage {
  sourceDocumentId: string;
  sourcePageIndex: number;
  rotation: Rotation;
  width: number;
  height: number;
}

export interface BuildStructureOptions {
  pages: StructurePage[];
  sources: StructureSource[];
  metadata?: PdfMetadata;
  useObjectStreams?: boolean;
  stripMetadata?: boolean;
}

/** Canvas-free PDF assembly used by both the main thread and the ops worker. */
export async function buildPdfBytes(options: BuildStructureOptions): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import("pdf-lib");
  const out = await PDFDocument.create();

  const requested = new Map<string, number[]>();
  for (const page of options.pages) {
    if (page.sourcePageIndex < 0) continue;
    const list = requested.get(page.sourceDocumentId) ?? [];
    list.push(page.sourcePageIndex);
    requested.set(page.sourceDocumentId, list);
  }

  const loaded = new Map<string, import("pdf-lib").PDFDocument>();
  try {
    for (const source of options.sources) {
      const indices = requested.get(source.id);
      if (!indices || indices.length === 0) continue;
      const doc = await PDFDocument.load(source.bytes, { updateMetadata: false });
      loaded.set(source.id, doc);
    }

    const copied = new Map<string, import("pdf-lib").PDFPage[]>();
    for (const [sourceId, indices] of requested) {
      const doc = loaded.get(sourceId);
      if (!doc) {
        throw new PdfError("PDF_CORRUPTED", "A source document could not be reopened.");
      }
      copied.set(sourceId, await out.copyPages(doc, indices));
    }

    const cursors = new Map<string, number>();
    for (const page of options.pages) {
      if (page.sourcePageIndex < 0) {
        const blank = out.addPage([page.width, page.height]);
        blank.setRotation(degrees(page.rotation));
        continue;
      }
      const list = copied.get(page.sourceDocumentId);
      const cursor = cursors.get(page.sourceDocumentId) ?? 0;
      if (!list || cursor >= list.length) {
        throw new PdfError("PDF_CORRUPTED", "A page could not be copied into the export.");
      }
      const next = list[cursor];
      cursors.set(page.sourceDocumentId, cursor + 1);
      next.setRotation(degrees(page.rotation));
      out.addPage(next);
    }

    if (options.metadata) applyMetadata(out, options.metadata);
    if (options.stripMetadata) stripDocumentMetadata(out);

    return await out.save({ useObjectStreams: options.useObjectStreams ?? true });
  } catch (error) {
    if (error instanceof PdfError) throw error;
    throw new PdfError("EXPORT_FAILED", undefined, { cause: error });
  }
}

export function applyMetadata(pdf: import("pdf-lib").PDFDocument, metadata: PdfMetadata): void {
  if (metadata.title !== undefined) pdf.setTitle(metadata.title);
  if (metadata.author !== undefined) pdf.setAuthor(metadata.author);
  if (metadata.subject !== undefined) pdf.setSubject(metadata.subject);
  if (metadata.keywords !== undefined) {
    pdf.setKeywords(metadata.keywords.split(/[,;]\s*/).filter(Boolean));
  }
  if (metadata.creator !== undefined) pdf.setCreator(metadata.creator);
  if (metadata.producer !== undefined) pdf.setProducer(metadata.producer);
}

export function stripDocumentMetadata(pdf: import("pdf-lib").PDFDocument): void {
  pdf.setTitle("");
  pdf.setAuthor("");
  pdf.setSubject("");
  pdf.setKeywords([]);
  pdf.setCreator("");
  pdf.setProducer("");
}
