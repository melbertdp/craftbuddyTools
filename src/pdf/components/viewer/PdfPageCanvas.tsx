"use client";

import * as React from "react";
import { PdfError } from "@/pdf/config/errors";
import type { Rotation } from "@/pdf/types";
import { renderPageToCanvas } from "@/pdf/core/render-engine";
import { cn } from "@/lib/utils";

interface PdfPageCanvasProps {
  cacheKey: string;
  bytes: Uint8Array;
  pageIndex: number;
  rotation: Rotation;
  scale?: number;
  targetWidth?: number;
  background?: string;
  lazy?: boolean;
  className?: string;
  canvasClassName?: string;
  onRendered?: (size: { width: number; height: number }) => void;
  onError?: (message: string) => void;
}

export function PdfPageCanvas({
  cacheKey,
  bytes,
  pageIndex,
  rotation,
  scale = 1,
  targetWidth,
  background = "#ffffff",
  lazy = true,
  className,
  canvasClassName,
  onRendered,
  onError,
}: PdfPageCanvasProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = React.useState(!lazy);
  const [status, setStatus] = React.useState<"idle" | "rendering" | "ready" | "error">(
    lazy ? "idle" : "rendering",
  );

  React.useEffect(() => {
    if (!lazy || visible) return;
    const element = containerRef.current;
    if (!element) return;
    if (typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "320px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [lazy, visible]);

  React.useEffect(() => {
    if (!visible) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const controller = new AbortController();
    setStatus("rendering");
    renderPageToCanvas(canvas, {
      cacheKey,
      bytes,
      pageIndex,
      rotation,
      scale,
      targetWidth,
      background,
      signal: controller.signal,
      devicePixelRatio: Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1),
    })
      .then((result) => {
        if (controller.signal.aborted) return;
        setStatus("ready");
        onRendered?.({ width: result.width, height: result.height });
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        if (error instanceof PdfError && error.code === "OPERATION_CANCELLED") return;
        setStatus("error");
        onError?.(error instanceof Error ? error.message : "This page could not be rendered.");
      });
    return () => {
      controller.abort();
    };
  }, [visible, cacheKey, bytes, pageIndex, rotation, scale, targetWidth, background, onRendered, onError]);

  React.useEffect(
    () => () => {
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = 0;
        canvas.height = 0;
      }
    },
    [],
  );

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <canvas
        ref={canvasRef}
        className={cn(
          "block max-w-full",
          status !== "ready" && "opacity-0",
          canvasClassName,
        )}
        aria-label={`Page ${pageIndex + 1}`}
      />
      {status === "rendering" && (
        <div className="absolute inset-0 grid place-items-center text-xs text-muted-foreground">
          Rendering…
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 grid place-items-center p-2 text-center text-xs text-destructive">
          This page could not be rendered.
        </div>
      )}
    </div>
  );
}
