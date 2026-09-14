"use client";

import * as React from "react";
import { pdfByteStore } from "@/pdf/core/byte-store";
import { releaseDocument, type LoadedDocument } from "@/pdf/core/document-engine";
import { useWorkspaceStore } from "@/pdf/stores/workspace-store";

/**
 * Release every byte-store entry referenced by the global workspace, then
 * reset the workspace. Deleting is idempotent, so documents still held by
 * local tool state can be released again safely on unmount.
 */
export function resetPdfWorkspace(): void {
  const { sources } = useWorkspaceStore.getState();
  for (const source of sources) pdfByteStore.delete(source.id);
  useWorkspaceStore.getState().reset();
}

/**
 * Every PDF tool mounts with a clean workspace and leaves no document behind.
 * Mounting resets (covers SPA navigation where the global store persists),
 * unmounting releases bytes + resets (covers back/forward and tool switches).
 */
export function useResetPdfWorkspaceOnMount(): void {
  React.useEffect(() => {
    resetPdfWorkspace();
    return () => {
      resetPdfWorkspace();
    };
  }, []);
}

/**
 * Release locally-held LoadedDocuments when a tool unmounts so switching
 * tools never leaks bytes and never shows the previous upload again.
 * Local useState already resets on remount; this frees the underlying bytes.
 */
export function useReleaseDocumentsOnUnmount(documents: LoadedDocument[]): void {
  const ref = React.useRef(documents);
  ref.current = documents;
  React.useEffect(
    () => () => {
      for (const document of ref.current) releaseDocument(document);
      ref.current = [];
    },
    [],
  );
}

/**
 * Wrap a documents setter so replaced/removed documents release their bytes.
 * PdfUploader drops the previous value without releasing it in single-file
 * mode, so tools use this to avoid leaking the previous upload.
 */
export function releaseRemovedDocuments(
  previous: LoadedDocument[],
  next: LoadedDocument[],
): void {
  if (previous === next) return;
  const keep = new Set(next.map((document) => document.source.id));
  for (const document of previous) {
    if (!keep.has(document.source.id)) releaseDocument(document);
  }
}
