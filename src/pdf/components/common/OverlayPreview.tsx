"use client";

import * as React from "react";
import type { EditorObject, PdfPageModel } from "@/pdf/types";
import { displaySize } from "@/pdf/core/coordinates";
import { PdfPageCanvas } from "@/pdf/components/viewer/PdfPageCanvas";

interface OverlayPreviewProps {
  page: PdfPageModel;
  bytes: Uint8Array;
  sourceId: string;
  objects: EditorObject[];
  width?: number;
}

export function OverlayPreview({ page, bytes, sourceId, objects, width = 420 }: OverlayPreviewProps) {
  const display = displaySize(page.width, page.height, page.rotation);
  const height = (width * display.height) / display.width;
  const scale = width / display.width;

  return (
    <div className="relative mx-auto shadow-lg" style={{ width, height }}>
      <PdfPageCanvas
        cacheKey={`preview:${sourceId}`}
        bytes={bytes}
        pageIndex={page.sourcePageIndex}
        rotation={page.rotation}
        targetWidth={width}
        lazy={false}
        className="h-full w-full"
        canvasClassName="h-full w-full"
      />
      {objects.map((object) => {
        const left = object.x * width;
        const top = object.y * height;
        const objectWidth = object.width * width;
        const objectHeight = object.height * height;
        const transform = `translate(-50%, -50%) rotate(${object.rotation}deg)`;

        if (object.type === "text") {
          return (
            <div
              key={object.id}
              aria-hidden
              style={{
                position: "absolute",
                left,
                top,
                width: objectWidth,
                height: objectHeight,
                transform,
                opacity: object.opacity,
                color: object.color,
                background: object.backgroundColor || undefined,
                fontFamily: object.fontFamily,
                fontSize: object.fontSize * scale,
                fontWeight: object.bold ? 700 : 400,
                fontStyle: object.italic ? "italic" : "normal",
                textDecoration: object.underline ? "underline" : "none",
                textAlign: object.align,
                lineHeight: object.lineHeight,
                whiteSpace: "pre-wrap",
              }}
            >
              {object.text}
            </div>
          );
        }
        if (object.type === "image" || object.type === "signature") {
          return (
            <img
              key={object.id}
              src={object.dataUrl}
              alt=""
              aria-hidden
              style={{
                position: "absolute",
                left,
                top,
                width: objectWidth,
                height: objectHeight,
                transform,
                opacity: object.opacity,
                objectFit: "contain",
              }}
            />
          );
        }
        return null;
      })}
    </div>
  );
}
