import type { EditorObject, PdfMetadata, PdfPageModel, PdfSourceDocument } from "@/pdf/types";
import { exportPdf } from "./export-engine";
import type { StructureSource } from "./structure";
import { runPdfOperation } from "@/pdf/workers/client";

export interface ExportPagesRequest {
  pages: PdfPageModel[];
  sources: PdfSourceDocument[];
  objectsByPageId?: Record<string, EditorObject[]>;
  metadata?: PdfMetadata;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  preferWorker?: boolean;
}

function structureSources(sources: PdfSourceDocument[]): StructureSource[] {
  return sources.map((source) => ({ id: source.id, bytes: source.bytes }));
}

export async function exportPages(request: ExportPagesRequest): Promise<Uint8Array> {
  const objectsByPageId = request.objectsByPageId ?? {};
  const hasObjects = request.pages.some((page) => (objectsByPageId[page.id]?.length ?? 0) > 0);

  if (!hasObjects) {
    return runPdfOperation(
      {
        op: "build",
        pages: request.pages.map((page) => ({
          sourceDocumentId: page.sourceDocumentId,
          sourcePageIndex: page.sourcePageIndex,
          rotation: page.rotation,
          width: page.width,
          height: page.height,
        })),
        sources: structureSources(request.sources),
        metadata: request.metadata,
      },
      { useWorker: request.preferWorker },
    );
  }

  return exportPdf({
    pages: request.pages,
    sources: structureSources(request.sources),
    objectsByPageId,
    metadata: request.metadata,
    signal: request.signal,
    onProgress: request.onProgress,
  });
}
