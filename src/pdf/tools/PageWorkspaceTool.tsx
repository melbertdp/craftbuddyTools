"use client";

import * as React from "react";
import {
  Copy,
  FilePlus2,
  ImagePlus,
  Loader2,
  Merge,
  RotateCcw,
  RotateCw,
  Scissors,
  Trash2,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToolShell } from "@/pdf/components/common/ToolShell";
import { StatusBanner } from "@/pdf/components/common/JobProgress";
import { PdfUploader } from "@/pdf/components/upload/PdfUploader";
import { ImageUploader, type UploadedImage } from "@/pdf/components/upload/ImageUploader";
import { PageGrid, resolveSource } from "@/pdf/components/viewer/PageThumbnail";
import { PdfPageCanvas } from "@/pdf/components/viewer/PdfPageCanvas";
import { PDF_LIMITS, formatBytes, type LimitScope } from "@/pdf/config/limits";
import { toUserMessage } from "@/pdf/config/errors";
import { exportPages } from "@/pdf/core/export-service";
import { downloadBytes, downloadZip } from "@/pdf/core/download";
import { exportFileName } from "@/pdf/core/filenames";
import { parseRanges, toRanges } from "@/pdf/core/ranges";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import { runJob } from "@/pdf/stores/job-store";
import { useWorkspaceStore } from "@/pdf/stores/workspace-store";
import type { PdfPageModel, PdfSourceDocument } from "@/pdf/types";

export type PageWorkspaceVariant =
  | "merge"
  | "organize"
  | "rotate"
  | "delete-pages"
  | "extract"
  | "split";

const EXPORT_SUFFIX: Record<PageWorkspaceVariant, string> = {
  merge: "merged",
  organize: "organized",
  rotate: "rotated",
  "delete-pages": "deleted-pages",
  extract: "extracted",
  split: "split",
};

interface PageWorkspaceToolProps {
  variant: PageWorkspaceVariant;
  title: string;
  description: string;
}

export function PageWorkspaceTool({ variant, title, description }: PageWorkspaceToolProps) {
  const pages = useWorkspaceStore((state) => state.pages);
  const sources = useWorkspaceStore((state) => state.sources);
  const selectedPageIds = useWorkspaceStore((state) => state.selectedPageIds);
  const activePageId = useWorkspaceStore((state) => state.activePageId);
  const canUndo = useWorkspaceStore((state) => state.past.length > 0);
  const canRedo = useWorkspaceStore((state) => state.future.length > 0);
  const store = useWorkspaceStore;

  const [documents, setDocuments] = React.useState<LoadedDocument[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();
  const [previewPageId, setPreviewPageId] = React.useState<string>();
  const [insertKind, setInsertKind] = React.useState<"pdf" | "image" | null>(null);
  const [insertImages, setInsertImages] = React.useState<UploadedImage[]>([]);
  const [splitInput, setSplitInput] = React.useState("1-1");
  const [splitEveryPage, setSplitEveryPage] = React.useState(false);

  const multiple = variant === "merge";
  const scope: LimitScope = "general";

  const rebuild = React.useCallback(
    (docs: LoadedDocument[]) => {
      setDocuments(docs);
      setError(undefined);
      setNotice(undefined);
      store.getState().reset();
      docs.forEach((doc, index) => {
        store.getState().hydrate(doc, index === 0 ? "replace" : "append");
      });
    },
    [store],
  );

  const validateMerge = (docs: LoadedDocument[]): string | undefined => {
    if (docs.length > PDF_LIMITS.merge.maxDocuments) {
      return `You can merge up to ${PDF_LIMITS.merge.maxDocuments} documents.`;
    }
    const totalBytes = docs.reduce((sum, doc) => sum + doc.source.size, 0);
    const totalPages = docs.reduce((sum, doc) => sum + doc.pages.length, 0);
    if (totalBytes > PDF_LIMITS.merge.maxCombinedBytes) {
      return `Combined input is ${formatBytes(totalBytes)}. The limit is ${formatBytes(
        PDF_LIMITS.merge.maxCombinedBytes,
      )}.`;
    }
    if (totalPages > PDF_LIMITS.merge.maxCombinedPages) {
      return `Combined pages: ${totalPages}. The limit is ${PDF_LIMITS.merge.maxCombinedPages}.`;
    }
    return undefined;
  };

  const selectPage = (pageId: string, event: React.MouseEvent) => {
    const additive = event.metaKey || event.ctrlKey || event.shiftKey;
    store.getState().selectPages([pageId], additive);
    store.getState().setActivePage(pageId);
  };

  const ensureSelection = (): string[] => {
    const state = store.getState();
    if (state.selectedPageIds.length > 0) return state.selectedPageIds;
    if (state.activePageId) return [state.activePageId];
    return [];
  };

  const rotate = (delta: number) => {
    const ids = ensureSelection();
    if (ids.length === 0) return;
    const previous = store.getState().selectedPageIds;
    store.getState().selectPages(ids);
    store.getState().rotateSelectedPages(delta);
    store.getState().selectPages(previous);
  };

  const exportAll = async (pagesToExport: PdfPageModel[]) => {
    if (pagesToExport.length === 0) {
      setError("There are no pages to export.");
      return;
    }
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const baseName = documents[0]?.source.name ?? "document";
      const bytes = await runJob({
        label: variant === "merge" ? "Merging PDF" : "Preparing PDF",
        task: async (context) => {
          context.onProgress(5, "Reading pages");
          const result = await exportPages({
            pages: pagesToExport,
            sources: store.getState().sources,
            onProgress: (completed, total) =>
              context.onProgress(10 + (completed / total) * 85, `Page ${completed} of ${total}`),
          });
          context.onProgress(100, "Done");
          return result;
        },
      });
      downloadBytes(bytes, exportFileName(baseName, EXPORT_SUFFIX[variant]));
      setNotice(
        `Exported ${pagesToExport.length} page${pagesToExport.length === 1 ? "" : "s"} (${formatBytes(
          bytes.byteLength,
        )}).`,
      );
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const exportSplit = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const baseName = documents[0]?.source.name ?? "document";
      let groups: { from: number; to: number }[];
      if (splitEveryPage) {
        groups = pages.map((_, index) => ({ from: index + 1, to: index + 1 }));
      } else {
        groups = toRanges(splitInput, pages.length);
      }
      const outputs = await runJob({
        label: "Splitting PDF",
        task: async (context) => {
          const results: { filename: string; bytes: Uint8Array }[] = [];
          for (let index = 0; index < groups.length; index += 1) {
            const group = groups[index];
            const slice = pages.slice(group.from - 1, group.to);
            const bytes = await exportPages({
              pages: slice,
              sources: store.getState().sources,
            });
            results.push({
              filename: `${baseName.replace(/\.pdf$/i, "")}-pages-${group.from}-${group.to}.pdf`,
              bytes,
            });
            context.onProgress(((index + 1) / groups.length) * 100, `Group ${index + 1} of ${groups.length}`);
          }
          return results;
        },
      });
      if (outputs.length === 1) {
        downloadBytes(outputs[0].bytes, outputs[0].filename);
        setNotice(`Exported 1 file (${formatBytes(outputs[0].bytes.byteLength)}).`);
      } else {
        await downloadZip(
          outputs.map((output) => ({ filename: output.filename, data: output.bytes })),
          `${baseName.replace(/\.pdf$/i, "")}-split.zip`,
        );
        setNotice(`Exported ${outputs.length} files as ZIP.`);
      }
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const previewPage = pages.find((page) => page.id === previewPageId);
  const previewSource = previewPage ? resolveSource(previewPage, sources) : undefined;
  const previewNumber = previewPage ? pages.indexOf(previewPage) + 1 : 0;

  const hasSelection = selectedPageIds.length > 0;
  const selectionCount = selectedPageIds.length;

  return (
    <ToolShell
      title={title}
      description={description}
      wide
      actions={
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Undo"
                disabled={!canUndo}
                onClick={() => store.getState().undo()}
              >
                <Undo2 className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Undo</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Redo"
                disabled={!canRedo}
                onClick={() => store.getState().redo()}
              >
                <Redo2 className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Redo</TooltipContent>
          </Tooltip>
        </>
      }
    >
      <div className="space-y-4">
        <PdfUploader
          scope={scope}
          multiple={multiple}
          value={documents}
          onChange={rebuild}
          validate={multiple ? validateMerge : undefined}
          compact={documents.length > 0 || pages.length > 0}
          hint={
            multiple
              ? `Add PDFs - up to ${PDF_LIMITS.merge.maxDocuments} files, ${formatBytes(
                  PDF_LIMITS.merge.maxCombinedBytes,
                )} total`
              : undefined
          }
        />

        {error && <StatusBanner tone="warning">{error}</StatusBanner>}
        {notice && <StatusBanner tone="success">{notice}</StatusBanner>}

        {pages.length > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-border bg-card p-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => rotate(-90)}
                disabled={busy}
              >
                <RotateCcw className="size-4" aria-hidden /> Rotate left
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => rotate(90)} disabled={busy}>
                <RotateCw className="size-4" aria-hidden /> Rotate right
              </Button>
              <div className="mx-1 h-5 w-px bg-border" aria-hidden />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => store.getState().duplicateSelectedPages()}
                disabled={!hasSelection}
              >
                <Copy className="size-4" aria-hidden /> Duplicate
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => store.getState().deleteSelectedPages()}
                disabled={!hasSelection || selectionCount >= pages.length}
              >
                <Trash2 className="size-4" aria-hidden /> Delete
              </Button>
              <div className="mx-1 h-5 w-px bg-border" aria-hidden />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => store.getState().insertBlankPage(activePageId)}
                disabled={busy}
              >
                <FilePlus2 className="size-4" aria-hidden /> Blank page
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => setInsertKind("pdf")} disabled={busy}>
                Insert PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setInsertImages([]);
                  setInsertKind("image");
                }}
                disabled={busy}
              >
                <ImagePlus className="size-4" aria-hidden /> Image page
              </Button>

              <span className="ml-auto text-xs text-muted-foreground">
                {selectionCount > 0 ? `${selectionCount} selected` : "Click to select • double-click to preview"}
              </span>
            </div>

            <div className="rounded-xl border border-border bg-card p-3">
              <PageGrid
                pages={pages}
                sources={sources}
                selectedIds={selectedPageIds}
                activeId={activePageId}
                onSelect={selectPage}
                onOpen={(pageId) => setPreviewPageId(pageId)}
                onReorder={(from, to) => store.getState().reorderPages(from, to)}
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2">
              {variant === "extract" && (
                <span className="mr-auto text-xs text-muted-foreground">
                  Selected pages are exported. {selectionCount === 0 && "Select at least one page."}
                </span>
              )}
              <Button
                type="button"
                size="lg"
                disabled={busy || (variant === "extract" && selectionCount === 0)}
                onClick={() => {
                  if (variant === "split") void exportSplit();
                  else if (variant === "extract") {
                    const selected = pages.filter((page) => selectedPageIds.includes(page.id));
                    void exportAll(selected);
                  } else {
                    void exportAll(pages);
                  }
                }}
              >
                {busy ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : variant === "merge" ? (
                  <Merge className="size-4" aria-hidden />
                ) : variant === "split" ? (
                  <Scissors className="size-4" aria-hidden />
                ) : null}
                {variant === "merge"
                  ? "Merge PDFs"
                  : variant === "split"
                    ? "Split PDF"
                    : "Export PDF"}
              </Button>
            </div>

            {variant === "split" && (
              <div className="rounded-xl border border-border bg-card p-4">
                <h2 className="text-sm font-semibold text-foreground">Split options</h2>
                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="split-ranges">Page ranges</Label>
                    <Input
                      id="split-ranges"
                      value={splitInput}
                      disabled={splitEveryPage}
                      onChange={(event) => setSplitInput(event.target.value)}
                      placeholder="1-3, 4-8, 10-15"
                      className="w-64"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="size-4 accent-[var(--primary)]"
                      checked={splitEveryPage}
                      onChange={(event) => setSplitEveryPage(event.target.checked)}
                    />
                    Split every page into its own file
                  </label>
                  {!splitEveryPage && splitInput.trim() && (
                    <span className="text-xs text-muted-foreground">
                      {(() => {
                        try {
                          const count = parseRanges(splitInput).length;
                          return `${count} output file${count === 1 ? "" : "s"}`;
                        } catch {
                          return "Invalid range";
                        }
                      })()}
                    </span>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={Boolean(previewPage)} onOpenChange={(open) => !open && setPreviewPageId(undefined)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Page {previewNumber} preview</DialogTitle>
            <DialogDescription>Preview only - nothing is uploaded.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[70vh] overflow-auto rounded-lg border border-border bg-muted/40 p-4">
            {previewPage && previewSource && (
              <PdfPageCanvas
                cacheKey={`preview:${previewSource.id}`}
                bytes={previewSource.bytes}
                pageIndex={previewPage.sourcePageIndex}
                rotation={previewPage.rotation}
                targetWidth={900}
                lazy={false}
                className="mx-auto shadow-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={insertKind === "pdf"} onOpenChange={(open) => !open && setInsertKind(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert pages from another PDF</DialogTitle>
            <DialogDescription>Pages are added after the current page.</DialogDescription>
          </DialogHeader>
          <PdfUploader
            scope="general"
            value={[]}
            onChange={(docs) => {
              if (docs.length === 0) return;
              const index = pages.findIndex((page) => page.id === activePageId);
              store.getState().insertDocuments(docs, index < 0 ? pages.length : index + 1);
              setDocuments((current) => [...current, ...docs]);
              setInsertKind(null);
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={insertKind === "image"}
        onOpenChange={(open) => {
          if (!open) {
            setInsertKind(null);
            setInsertImages([]);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Insert an image as a page</DialogTitle>
            <DialogDescription>The image is placed on a new page after the current page.</DialogDescription>
          </DialogHeader>
          <ImageUploader
            value={insertImages}
            onChange={(images) => {
              setInsertImages(images);
              const last = images[images.length - 1];
              if (last) {
                store.getState().insertImagePage(last.image, activePageId);
                setInsertKind(null);
                setInsertImages([]);
              }
            }}
          />
        </DialogContent>
      </Dialog>
    </ToolShell>
  );
}

export type { PdfPageModel, PdfSourceDocument };
