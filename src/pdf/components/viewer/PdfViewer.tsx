"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Maximize2, Minus, Plus, Scaling } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PdfPageModel } from "@/pdf/types";
import { displaySize } from "@/pdf/core/coordinates";
import { cn } from "@/lib/utils";
import { PdfPageCanvas } from "./PdfPageCanvas";

export type ViewerMode = "width" | "page" | "custom";

interface PdfViewerProps {
  page: PdfPageModel;
  bytes?: Uint8Array;
  pageNumber: number;
  pageCount: number;
  sourceKey: string;
  onPrev?: () => void;
  onNext?: () => void;
  onScaleChange?: (scale: number) => void;
  onPageClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
  children?: (scale: number) => React.ReactNode;
  className?: string;
  toolbar?: boolean;
}

const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export function PdfViewer({
  page,
  bytes,
  pageNumber,
  pageCount,
  sourceKey,
  onPrev,
  onNext,
  onScaleChange,
  onPageClick,
  children,
  className,
  toolbar = true,
}: PdfViewerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [mode, setMode] = React.useState<ViewerMode>("width");
  const [zoom, setZoom] = React.useState(1);
  const [container, setContainer] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const update = () => {
      setContainer({ width: element.clientWidth, height: element.clientHeight });
    };
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const size = displaySize(page.width, page.height, page.rotation);
  const padding = 48;
  const availableWidth = Math.max(80, container.width - padding);
  const availableHeight = Math.max(80, container.height - padding);

  let scale = zoom;
  if (mode === "width" && size.width > 0) scale = availableWidth / size.width;
  else if (mode === "page" && size.width > 0 && size.height > 0) {
    scale = Math.min(availableWidth / size.width, availableHeight / size.height);
  }
  scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));

  React.useEffect(() => {
    onScaleChange?.(scale);
  }, [scale, onScaleChange]);

  const adjustZoom = (delta: number) => {
    setMode("custom");
    setZoom((current) => {
      const base = mode === "custom" ? current : scale;
      return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, base + delta));
    });
  };

  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {toolbar && (
        <div className="flex flex-wrap items-center justify-center gap-1 border-b border-border bg-card/70 px-2 py-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Previous page"
                disabled={pageNumber <= 1}
                onClick={onPrev}
              >
                <ChevronLeft className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Previous page</TooltipContent>
          </Tooltip>
          <span className="px-2 text-xs text-muted-foreground" aria-live="polite">
            Page {pageNumber} of {pageCount}
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Next page"
                disabled={pageNumber >= pageCount}
                onClick={onNext}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Next page</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-border" aria-hidden />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom out"
                onClick={() => adjustZoom(-0.15)}
              >
                <Minus className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom out</TooltipContent>
          </Tooltip>
          <span className="w-12 text-center text-xs text-muted-foreground">
            {Math.round(scale * 100)}%
          </span>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Zoom in"
                onClick={() => adjustZoom(0.15)}
              >
                <Plus className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Zoom in</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Fit width"
                aria-pressed={mode === "width"}
                className={cn(mode === "width" && "bg-accent")}
                onClick={() => setMode("width")}
              >
                <Scaling className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit width</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Fit page"
                aria-pressed={mode === "page"}
                className={cn(mode === "page" && "bg-accent")}
                onClick={() => setMode("page")}
              >
                <Maximize2 className="size-4" aria-hidden />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Fit page</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-auto bg-muted/40 p-6"
      >
        <div className="flex min-h-full w-full">
          <div className="relative m-auto" onClick={onPageClick}>
            {bytes ? (
              <PdfPageCanvas
                cacheKey={`viewer:${sourceKey}`}
                bytes={bytes}
                pageIndex={page.sourcePageIndex}
                rotation={page.rotation}
                scale={scale}
                lazy={false}
                className="shadow-lg"
              />
            ) : (
              <div
                className="bg-white shadow-lg"
                style={{ width: size.width * scale, height: size.height * scale }}
              />
            )}
            {children?.(scale)}
          </div>
        </div>
      </div>
    </div>
  );
}
