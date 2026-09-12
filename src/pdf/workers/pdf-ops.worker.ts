import { buildPdfBytes } from "@/pdf/core/structure";
import { updatePdfMetadata } from "@/pdf/core/enhancement-engine";
import type { WorkerRequest, WorkerResponse } from "./protocol";

interface WorkerScope {
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
}

const scope = self as unknown as WorkerScope;

scope.onmessage = async (event: MessageEvent<WorkerRequest>) => {
  const { id, operation } = event.data;
  try {
    let bytes: Uint8Array;
    if (operation.op === "build") {
      bytes = await buildPdfBytes({
        pages: operation.pages.map((page) => ({
          sourceDocumentId: page.sourceDocumentId,
          sourcePageIndex: page.sourcePageIndex,
          rotation: page.rotation as 0 | 90 | 180 | 270,
          width: page.width,
          height: page.height,
        })),
        sources: operation.sources,
        metadata: operation.metadata,
        stripMetadata: operation.stripMetadata,
      });
    } else {
      bytes = await updatePdfMetadata(operation.bytes, {
        metadata: operation.metadata ?? {},
        remove: operation.remove,
      });
    }
    const transferable = bytes.buffer instanceof ArrayBuffer ? [bytes.buffer] : undefined;
    scope.postMessage({ id, ok: true, bytes }, transferable);
  } catch (error) {
    scope.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : "Worker operation failed.",
    });
  }
};
