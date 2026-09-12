import { buildPdfBytes } from "@/pdf/core/structure";
import { updatePdfMetadata } from "@/pdf/core/enhancement-engine";
import type { WorkerOperation, WorkerResponse } from "./protocol";

let worker: Worker | undefined;
let workerFailed = false;
let requestId = 0;
const pending = new Map<
  number,
  { resolve: (bytes: Uint8Array) => void; reject: (error: Error) => void }
>();

function getWorker(): Worker | undefined {
  if (workerFailed || typeof window === "undefined") return undefined;
  if (worker) return worker;
  try {
    const instance = new Worker(new URL("./pdf-ops.worker.ts", import.meta.url), {
      type: "module",
    });
    instance.onmessage = (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const entry = pending.get(response.id);
      if (!entry) return;
      pending.delete(response.id);
      if (response.ok) entry.resolve(response.bytes);
      else entry.reject(new Error(response.error));
    };
    instance.onerror = () => {
      workerFailed = true;
      for (const entry of pending.values()) {
        entry.reject(new Error("The PDF worker stopped unexpectedly."));
      }
      pending.clear();
    };
    worker = instance;
    return worker;
  } catch {
    workerFailed = true;
    return undefined;
  }
}

async function inline(operation: WorkerOperation): Promise<Uint8Array> {
  if (operation.op === "build") {
    return buildPdfBytes({
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
  }
  return updatePdfMetadata(operation.bytes, {
    metadata: operation.metadata ?? {},
    remove: operation.remove,
  });
}

/** Run a canvas-free PDF operation, preferring a Web Worker when available. */
export async function runPdfOperation(
  operation: WorkerOperation,
  options: { useWorker?: boolean } = {},
): Promise<Uint8Array> {
  const instance = options.useWorker === false ? undefined : getWorker();
  if (!instance) return inline(operation);

  requestId += 1;
  const id = requestId;
  return new Promise<Uint8Array>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    instance.postMessage({ id, operation });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        inline(operation).then(resolve).catch(reject);
      }
    }, 60_000);
  });
}

export function terminatePdfWorker(): void {
  worker?.terminate();
  worker = undefined;
  pending.clear();
}
