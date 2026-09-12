"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";
import type { PdfPageModel, PdfSourceDocument, Rotation } from "@/pdf/types";
import { displaySize } from "@/pdf/core/coordinates";
import { cn } from "@/lib/utils";
import { PdfPageCanvas } from "./PdfPageCanvas";

export function resolveSource(
  page: PdfPageModel,
  sources: PdfSourceDocument[],
): PdfSourceDocument | undefined {
  return sources.find((source) => source.id === page.sourceDocumentId);
}

interface PageThumbnailProps {
  page: PdfPageModel;
  bytes?: Uint8Array;
  pageNumber: number;
  selected?: boolean;
  active?: boolean;
  draggable?: boolean;
  onSelect?: (event: React.MouseEvent) => void;
  onOpen?: () => void;
  onDragStart?: () => void;
  onDrop?: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  className?: string;
}

export function PageThumbnail({
  page,
  bytes,
  pageNumber,
  selected = false,
  active = false,
  draggable = false,
  onSelect,
  onOpen,
  onDragStart,
  onDrop,
  onDragOver,
  className,
}: PageThumbnailProps) {
  const size = displaySize(page.width, page.height, page.rotation);
  const aspect = size.width / size.height;

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 rounded-lg p-1 transition-colors",
        draggable && "cursor-grab active:cursor-grabbing",
        className,
      )}
    >
      <button
        type="button"
        onClick={(event) => {
          if (onSelect) onSelect(event);
          else onOpen?.();
        }}
        onDoubleClick={onOpen}
        aria-pressed={selected}
        aria-label={`Page ${pageNumber}${selected ? ", selected" : ""}`}
        className={cn(
          "relative block w-full overflow-hidden rounded-md border-2 bg-white shadow-sm transition-all focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
          selected ? "border-primary" : "border-border hover:border-primary/50",
          active && !selected && "ring-2 ring-primary/30",
        )}
        style={{ aspectRatio: `${aspect}` }}
      >
        {bytes ? (
          <PdfPageCanvas
            cacheKey={`thumb:${page.sourceDocumentId}`}
            bytes={bytes}
            pageIndex={page.sourcePageIndex}
            rotation={page.rotation}
            targetWidth={220}
            lazy
            className="h-full w-full"
            canvasClassName="h-full w-full object-contain"
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-[10px] text-muted-foreground">Blank</span>
        )}
        <span className="absolute left-1 top-1 rounded bg-foreground/75 px-1.5 py-0.5 text-[10px] font-semibold text-background">
          {pageNumber}
        </span>
        {page.rotation !== 0 && (
          <span className="absolute right-1 top-1 rounded bg-foreground/75 p-0.5 text-background">
            <RotateCw className="size-3" aria-hidden />
          </span>
        )}
        {selected && (
          <span className="absolute inset-0 bg-primary/10" aria-hidden />
        )}
      </button>
      <span className="text-[10px] text-muted-foreground">{pageNumber}</span>
    </div>
  );
}

interface PageGridProps {
  pages: PdfPageModel[];
  sources: PdfSourceDocument[];
  selectedIds: string[];
  activeId?: string;
  onSelect?: (pageId: string, event: React.MouseEvent) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  onOpen?: (pageId: string) => void;
  columnsClassName?: string;
  emptyMessage?: string;
}

export function PageGrid({
  pages,
  sources,
  selectedIds,
  activeId,
  onSelect,
  onReorder,
  onOpen,
  columnsClassName,
  emptyMessage = "No pages yet.",
}: PageGridProps) {
  const dragIndex = React.useRef<number | null>(null);

  if (pages.length === 0) {
    return <p className="py-12 text-center text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div
      className={cn(
        "grid grid-cols-5 gap-3 max-[1100px]:grid-cols-4 max-[760px]:grid-cols-3 max-[520px]:grid-cols-2",
        columnsClassName,
      )}
    >
      {pages.map((page, index) => (
        <PageThumbnail
          key={page.id}
          page={page}
          pageNumber={index + 1}
          bytes={resolveSource(page, sources)?.bytes}
          selected={selectedIds.includes(page.id)}
          active={page.id === activeId}
          draggable={Boolean(onReorder)}
          onSelect={
            onSelect
              ? (event) => onSelect(page.id, event)
              : undefined
          }
          onOpen={onOpen ? () => onOpen(page.id) : undefined}
          onDragStart={() => {
            dragIndex.current = index;
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={() => {
            if (dragIndex.current !== null && onReorder) onReorder(dragIndex.current, index);
            dragIndex.current = null;
          }}
        />
      ))}
    </div>
  );
}

interface ThumbnailSidebarProps {
  pages: PdfPageModel[];
  sources: PdfSourceDocument[];
  activePageId?: string;
  onActiveChange: (pageId: string) => void;
}

export function ThumbnailSidebar({
  pages,
  sources,
  activePageId,
  onActiveChange,
}: ThumbnailSidebarProps) {
  return (
    <nav aria-label="Page thumbnails" className="flex h-full flex-col gap-2 overflow-y-auto p-3">
      {pages.map((page, index) => (
        <div
          key={page.id}
          role="button"
          tabIndex={0}
          onClick={() => onActiveChange(page.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onActiveChange(page.id);
            }
          }}
          aria-current={page.id === activePageId}
          className={cn(
            "flex cursor-pointer items-center gap-2 rounded-lg border p-1.5 text-left transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
            page.id === activePageId
              ? "border-primary bg-primary/5"
              : "border-transparent hover:border-border hover:bg-accent/40",
          )}
        >
          <PageThumbnail
            page={page}
            pageNumber={index + 1}
            bytes={resolveSource(page, sources)?.bytes}
            active={page.id === activePageId}
            className="w-16 shrink-0"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-medium text-foreground">Page {index + 1}</span>
            <span className="block text-[10px] text-muted-foreground">
              {Math.round(page.width)} × {Math.round(page.height)} pt
            </span>
          </span>
        </div>
      ))}
    </nav>
  );
}

export function rotationLabel(rotation: Rotation): string {
  return `${rotation}°`;
}
