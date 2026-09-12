"use client";

import * as React from "react";
import {
  Download,
  Images,
  Loader2,
  PanelRight,
  Redo2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ToolShell } from "@/pdf/components/common/ToolShell";
import { StatusBanner } from "@/pdf/components/common/JobProgress";
import { PdfUploader } from "@/pdf/components/upload/PdfUploader";
import { PdfViewer } from "@/pdf/components/viewer/PdfViewer";
import { ThumbnailSidebar, resolveSource } from "@/pdf/components/viewer/PageThumbnail";
import { EditorCanvas } from "./EditorCanvas";
import { EditorProperties } from "./EditorProperties";
import { EditorToolbar } from "./EditorToolbar";
import { SignatureDialog } from "./SignatureDialog";
import { toUserMessage } from "@/pdf/config/errors";
import { displaySize } from "@/pdf/core/coordinates";
import { exportPages } from "@/pdf/core/export-service";
import { downloadBytes } from "@/pdf/core/download";
import { exportFileName } from "@/pdf/core/filenames";
import { createImageObject } from "@/pdf/core/editor/model";
import { loadImageFile, type LoadedImage } from "@/pdf/core/image";
import { PDF_LIMITS } from "@/pdf/config/limits";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import { runJob } from "@/pdf/stores/job-store";
import { useWorkspaceStore } from "@/pdf/stores/workspace-store";
import type { ImageObject } from "@/pdf/types";

interface EditorWorkspaceProps {
  mode: "edit" | "sign";
  title: string;
  description: string;
}

export function EditorWorkspace({ mode, title, description }: EditorWorkspaceProps) {
  const pages = useWorkspaceStore((state) => state.pages);
  const sources = useWorkspaceStore((state) => state.sources);
  const objects = useWorkspaceStore((state) => state.objects);
  const activePageId = useWorkspaceStore((state) => state.activePageId);
  const canUndo = useWorkspaceStore((state) => state.past.length > 0);
  const canRedo = useWorkspaceStore((state) => state.future.length > 0);
  const store = useWorkspaceStore;

  const [documents, setDocuments] = React.useState<LoadedDocument[]>([]);
  const [, setScale] = React.useState(1);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();
  const [signatureOpen, setSignatureOpen] = React.useState(false);
  const [propertiesOpen, setPropertiesOpen] = React.useState(false);
  const [thumbnailsOpen, setThumbnailsOpen] = React.useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  const activePage = pages.find((page) => page.id === activePageId) ?? pages[0];
  const activeIndex = activePage ? pages.indexOf(activePage) : 0;
  const activeSource = activePage ? resolveSource(activePage, sources) : undefined;

  const loadDocuments = (docs: LoadedDocument[]) => {
    setDocuments(docs);
    setError(undefined);
    setNotice(undefined);
    store.getState().reset();
    if (docs[0]) store.getState().hydrate(docs[0], "replace");
  };

  const sizeFor = (pageId: string, aspect: number, maxWidth = 0.4) => {
    const page = store.getState().pages.find((item) => item.id === pageId);
    if (!page) return { width: maxWidth, height: 0.3 };
    const display = displaySize(page.width, page.height, page.rotation);
    let width = maxWidth;
    let height = (width * display.width) / Math.max(0.1, aspect) / display.height;
    if (height > 0.6) {
      height = 0.6;
      width = (height * display.height * aspect) / display.width;
    }
    return { width, height };
  };

  const addImage = React.useCallback(
    (image: LoadedImage, type: ImageObject["type"] = "image") => {
      const pageId = store.getState().activePageId ?? store.getState().pages[0]?.id;
      if (!pageId) return;
      const size = sizeFor(pageId, image.width / Math.max(1, image.height));
      const object = createImageObject(
        { pageId, x: 0.5, y: 0.5, ...size },
        image.dataUrl,
        image.format,
        { type },
      );
      store.getState().addObject(object);
      store.getState().setTool("select");
    },
    [store],
  );

  const handleImageFile = async (file: File) => {
    try {
      const image = await loadImageFile(file, PDF_LIMITS.image.maxFileSizeBytes);
      addImage(image);
    } catch (caught) {
      setError(toUserMessage(caught));
    }
  };

  // Paste images while the editor is open.
  React.useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (!files || files.length === 0) return;
      const file = Array.from(files).find((item) => item.type.startsWith("image/"));
      if (!file) return;
      event.preventDefault();
      void handleImageFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addImage]);

  // Keyboard shortcuts.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable)) {
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      const state = store.getState();
      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) state.redo();
        else state.undo();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        state.redo();
        return;
      }
      if (mod && event.key.toLowerCase() === "c") {
        state.copySelection();
        return;
      }
      if (mod && event.key.toLowerCase() === "v") {
        state.pasteClipboard();
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        state.duplicateSelectedObjects();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (state.selectedObjectIds.length > 0) {
          event.preventDefault();
          state.deleteSelectedObjects();
        }
        return;
      }
      if (event.key === "Escape") {
        state.selectObjects([]);
        state.setTool("select");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);

  const handleExport = async () => {
    if (pages.length === 0) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const baseName = documents[0]?.source.name ?? "document";
      const bytes = await runJob({
        label: mode === "sign" ? "Preparing signed PDF" : "Exporting edited PDF",
        task: async (context) => {
          context.onProgress(5, "Applying edits");
          return exportPages({
            pages: store.getState().pages,
            sources: store.getState().sources,
            objectsByPageId: store.getState().objects,
            metadata: store.getState().metadata,
            onProgress: (completed, total) =>
              context.onProgress(5 + (completed / total) * 90, `Page ${completed} of ${total}`),
          });
        },
      });
      downloadBytes(bytes, exportFileName(baseName, mode === "sign" ? "signed" : "edited"));
      store.getState().markExported();
      setNotice(`Exported ${pages.length} page${pages.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const hasDocument = pages.length > 0;

  return (
    <ToolShell
      title={title}
      description={description}
      wide
      contentClassName="flex min-h-0 flex-col"
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
            <TooltipContent>Undo (Ctrl/Cmd+Z)</TooltipContent>
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
            <TooltipContent>Redo (Ctrl/Cmd+Shift+Z)</TooltipContent>
          </Tooltip>
          <Button type="button" size="sm" disabled={!hasDocument || busy} onClick={handleExport}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
            Save / Export
          </Button>
        </>
      }
    >
      {!hasDocument ? (
        <div className="mx-auto w-full max-w-2xl space-y-4">
          <PdfUploader
            scope={mode}
            value={documents}
            onChange={loadDocuments}
            title="Drop a PDF to start"
          />
          {error && <StatusBanner tone="warning">{error}</StatusBanner>}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          {error && <StatusBanner tone="warning">{error}</StatusBanner>}
          {notice && <StatusBanner tone="success">{notice}</StatusBanner>}

          <div className="flex items-center gap-2 lg:hidden">
            <Sheet open={thumbnailsOpen} onOpenChange={setThumbnailsOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm">
                  <Images className="size-4" aria-hidden /> Pages
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader>
                  <SheetTitle>Pages</SheetTitle>
                </SheetHeader>
                <ThumbnailSidebar
                  pages={pages}
                  sources={sources}
                  activePageId={activePage?.id}
                  onActiveChange={(pageId) => {
                    store.getState().setActivePage(pageId);
                    setThumbnailsOpen(false);
                  }}
                />
              </SheetContent>
            </Sheet>
            <Sheet open={propertiesOpen} onOpenChange={setPropertiesOpen}>
              <SheetTrigger asChild>
                <Button type="button" variant="outline" size="sm" className="ml-auto">
                  <PanelRight className="size-4" aria-hidden /> Properties
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="max-h-[70vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Properties</SheetTitle>
                </SheetHeader>
                <EditorProperties mode={mode} />
              </SheetContent>
            </Sheet>
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-[190px_minmax(0,1fr)_300px] gap-3 max-[1024px]:grid-cols-1">
            <aside className="hidden min-h-0 overflow-hidden rounded-xl border border-border bg-card xl:block">
              <ThumbnailSidebar
                pages={pages}
                sources={sources}
                activePageId={activePage?.id}
                onActiveChange={(pageId) => store.getState().setActivePage(pageId)}
              />
            </aside>

            <section
              className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const file = event.dataTransfer.files?.[0];
                if (file && file.type.startsWith("image/")) void handleImageFile(file);
              }}
            >
              <EditorToolbar
                mode={mode}
                onAddImage={() => imageInputRef.current?.click()}
                onAddSignature={() => setSignatureOpen(true)}
              />
              {activePage && (
                <PdfViewer
                  page={activePage}
                  bytes={activeSource?.bytes}
                  sourceKey={activeSource?.id ?? "unknown"}
                  pageNumber={activeIndex + 1}
                  pageCount={pages.length}
                  onPrev={() => {
                    const previous = pages[activeIndex - 1];
                    if (previous) store.getState().setActivePage(previous.id);
                  }}
                  onNext={() => {
                    const next = pages[activeIndex + 1];
                    if (next) store.getState().setActivePage(next.id);
                  }}
                  onScaleChange={setScale}
                  className="min-h-[60vh]"
                >
                  {(viewerScale) => <EditorCanvas page={activePage} scale={viewerScale} />}
                </PdfViewer>
              )}
            </section>

            <aside className="hidden min-h-0 overflow-y-auto rounded-xl border border-border bg-card xl:block">
              <EditorProperties mode={mode} />
            </aside>
          </div>
        </div>
      )}

      <input
        ref={imageInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleImageFile(file);
          event.target.value = "";
        }}
      />

      <SignatureDialog
        open={signatureOpen}
        onOpenChange={setSignatureOpen}
        onAccept={(dataUrl, aspect) => {
          const pageId = store.getState().activePageId ?? store.getState().pages[0]?.id;
          if (!pageId) return;
          const size = sizeFor(pageId, aspect, 0.42);
          store.getState().addObject(
            createImageObject({ pageId, x: 0.5, y: 0.5, ...size }, dataUrl, "png", {
              type: "signature",
            }),
          );
          store.getState().setTool("select");
        }}
      />
    </ToolShell>
  );
}
