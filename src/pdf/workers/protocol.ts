import type { PdfMetadata } from "@/pdf/types";

export interface WorkerSource {
  id: string;
  bytes: Uint8Array;
}

export interface WorkerPage {
  sourceDocumentId: string;
  sourcePageIndex: number;
  rotation: number;
  width: number;
  height: number;
}

export type WorkerOperation =
  | {
      op: "build";
      pages: WorkerPage[];
      sources: WorkerSource[];
      metadata?: PdfMetadata;
      stripMetadata?: boolean;
    }
  | {
      op: "metadata";
      bytes: Uint8Array;
      metadata?: PdfMetadata;
      remove?: boolean;
    };

export interface WorkerRequest {
  id: number;
  operation: WorkerOperation;
}

export interface WorkerSuccess {
  id: number;
  ok: true;
  bytes: Uint8Array;
}

export interface WorkerFailure {
  id: number;
  ok: false;
  error: string;
}

export type WorkerResponse = WorkerSuccess | WorkerFailure;
