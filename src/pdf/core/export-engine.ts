import { PdfError } from "@/pdf/config/errors";
import type { EditorObject, PdfMetadata, PdfPageModel, TextObject } from "@/pdf/types";
import { displaySize, displayToPdfMatrix } from "./coordinates";
import { dataUrlToBytes } from "./image";
import { buildPdfBytes, type StructureSource } from "./structure";

export interface ExportOptions {
  pages: PdfPageModel[];
  sources: StructureSource[];
  objectsByPageId?: Record<string, EditorObject[]>;
  metadata?: PdfMetadata;
  signal?: AbortSignal;
  onProgress?: (completed: number, total: number) => void;
  exportScale?: number;
  useObjectStreams?: boolean;
}

export interface RgbColor {
  r: number;
  g: number;
  b: number;
}

export function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "").trim();
  const expanded =
    normalized.length === 3
      ? normalized
          .split("")
          .map((char) => char + char)
          .join("")
      : normalized;
  const value = Number.parseInt(expanded.slice(0, 6) || "000000", 16);
  if (!Number.isFinite(value)) return { r: 0, g: 0, b: 0 };
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255,
  };
}

function pivotForRotation(
  cx: number,
  cy: number,
  width: number,
  height: number,
  rotationDegrees: number,
): { x: number; y: number; rotate: number } {
  const angle = (-rotationDegrees * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const halfW = width / 2;
  const halfH = height / 2;
  return {
    x: cx - (halfW * cos - halfH * sin),
    y: cy - (halfW * sin + halfH * cos),
    rotate: angle,
  };
}

export interface RasterizedText {
  bytes: Uint8Array;
  width: number;
  height: number;
}

const ASSUMED_PX_PER_POINT = 3;

/** Rasterize a text object to PNG so fonts, Unicode, and formatting match the editor. */
export async function rasterizeTextObject(
  object: TextObject,
  widthPt: number,
  heightPt: number,
  scale = ASSUMED_PX_PER_POINT,
): Promise<RasterizedText | undefined> {
  if (!object.text.trim() || widthPt <= 0 || heightPt <= 0) return undefined;
  const pixelWidth = Math.max(2, Math.round(widthPt * scale));
  const pixelHeight = Math.max(2, Math.round(heightPt * scale));
  const maxDimension = 8192;
  const clamp = Math.min(1, maxDimension / Math.max(pixelWidth, pixelHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(pixelWidth * clamp));
  canvas.height = Math.max(2, Math.round(pixelHeight * clamp));
  const context = canvas.getContext("2d");
  if (!context) return undefined;
  const effectiveScale = scale * clamp;
  const fontSizePx = object.fontSize * effectiveScale;

  if (object.backgroundColor) {
    context.fillStyle = object.backgroundColor;
    context.fillRect(0, 0, canvas.width, canvas.height);
  }

  const weight = object.bold ? "bold" : "normal";
  const style = object.italic ? "italic" : "normal";
  context.font = `${style} ${weight} ${fontSizePx}px ${object.fontFamily}`;
  context.fillStyle = object.color;
  context.textBaseline = "middle";

  const lineHeightPx = fontSizePx * object.lineHeight;
  const words = object.text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width > canvas.width - 4 && current) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);

  let y = lineHeightPx / 2 + 2;
  for (const line of lines) {
    const textWidth = context.measureText(line).width;
    let x = 2;
    if (object.align === "center") x = (canvas.width - textWidth) / 2;
    else if (object.align === "right") x = canvas.width - textWidth - 2;
    context.fillText(line, x, y);
    if (object.underline) {
      context.strokeStyle = object.color;
      context.lineWidth = Math.max(1, fontSizePx * 0.05);
      context.beginPath();
      context.moveTo(x, y + fontSizePx * 0.42);
      context.lineTo(x + textWidth, y + fontSizePx * 0.42);
      context.stroke();
    }
    y += lineHeightPx;
  }

  const dataUrl = canvas.toDataURL("image/png");
  canvas.width = 0;
  canvas.height = 0;
  return {
    bytes: dataUrlToBytes(dataUrl),
    width: widthPt,
    height: heightPt,
  };
}

interface DrawContext {
  pdf: import("pdf-lib").PDFDocument;
  imageCache: Map<string, import("pdf-lib").PDFImage>;
  signal?: AbortSignal;
}

async function embedImage(
  context: DrawContext,
  dataUrl: string,
  format: "png" | "jpeg" | "webp",
): Promise<import("pdf-lib").PDFImage> {
  const cached = context.imageCache.get(dataUrl);
  if (cached) return cached;
  const bytes = dataUrlToBytes(dataUrl);
  let image: import("pdf-lib").PDFImage;
  if (format === "jpeg") {
    image = await context.pdf.embedJpg(bytes);
  } else {
    image = await context.pdf.embedPng(bytes);
  }
  context.imageCache.set(dataUrl, image);
  return image;
}

interface PlacedObject {
  cx: number;
  cy: number;
  width: number;
  height: number;
}

function placeObject(
  object: EditorObject,
  displayWidth: number,
  displayHeight: number,
): PlacedObject {
  return {
    cx: object.x * displayWidth,
    cy: displayHeight - object.y * displayHeight,
    width: object.width * displayWidth,
    height: object.height * displayHeight,
  };
}

async function drawEditorObject(
  context: DrawContext,
  page: import("pdf-lib").PDFPage,
  object: EditorObject,
  displayWidth: number,
  displayHeight: number,
): Promise<void> {
  const { rgb, degrees, BlendMode, LineCapStyle } = await import("pdf-lib");
  const toColor = (hex: string) => {
    const c = hexToRgb(hex);
    return rgb(c.r, c.g, c.b);
  };
  const placed = placeObject(object, displayWidth, displayHeight);
  const opacity = Math.max(0, Math.min(1, object.opacity));
  const angleRad = (-object.rotation * Math.PI) / 180;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const mapLocal = (lx: number, ly: number): { x: number; y: number } => {
    const localX = (lx - 0.5) * placed.width;
    const localY = (0.5 - ly) * placed.height;
    return {
      x: placed.cx + localX * cos - localY * sin,
      y: placed.cy + localX * sin + localY * cos,
    };
  };

  if (object.type === "text") {
    const raster = await rasterizeTextObject(object, placed.width, placed.height);
    if (!raster) return;
    const image = await context.pdf.embedPng(raster.bytes);
    const pivot = pivotForRotation(
      placed.cx,
      placed.cy,
      placed.width,
      placed.height,
      object.rotation,
    );
    page.drawImage(image, {
      x: pivot.x,
      y: pivot.y,
      width: placed.width,
      height: placed.height,
      rotate: degrees((pivot.rotate * 180) / Math.PI),
      opacity,
    });
    return;
  }

  if (object.type === "image" || object.type === "signature") {
    const image = await embedImage(context, object.dataUrl, object.format);
    const pivot = pivotForRotation(
      placed.cx,
      placed.cy,
      placed.width,
      placed.height,
      object.rotation,
    );
    page.drawImage(image, {
      x: pivot.x,
      y: pivot.y,
      width: placed.width,
      height: placed.height,
      rotate: degrees((pivot.rotate * 180) / Math.PI),
      opacity,
    });
    return;
  }

  if (object.type === "drawing") {
    if (object.points.length < 2) return;
    const color = toColor(object.color);
    const strokePoints = object.points.map((point) => mapLocal(point.x, point.y));
    for (let index = 1; index < strokePoints.length; index += 1) {
      page.drawLine({
        start: strokePoints[index - 1],
        end: strokePoints[index],
        thickness: Math.max(0.5, object.thickness),
        color,
        opacity,
        lineCap: LineCapStyle.Round,
      });
    }
    return;
  }

  if (
    object.type === "highlight" ||
    object.type === "underline" ||
    object.type === "strikethrough"
  ) {
    const color = toColor(object.color);
    if (object.type === "highlight") {
      const center = mapLocal(0.5, 0.5);
      const pivot = pivotForRotation(
        center.x,
        center.y,
        placed.width,
        placed.height,
        object.rotation,
      );
      page.drawRectangle({
        x: pivot.x,
        y: pivot.y,
        width: placed.width,
        height: placed.height,
        color,
        opacity: Math.min(1, opacity * 0.5),
        rotate: degrees((pivot.rotate * 180) / Math.PI),
        blendMode: BlendMode.Multiply,
      });
      return;
    }
    const thickness = Math.max(1, placed.height * 0.12);
    const localY = object.type === "underline" ? 1 : 0.5;
    const center = mapLocal(0.5, localY);
    const pivot = pivotForRotation(center.x, center.y, placed.width, thickness, object.rotation);
    page.drawRectangle({
      x: pivot.x,
      y: pivot.y,
      width: placed.width,
      height: thickness,
      color,
      opacity,
      rotate: degrees((pivot.rotate * 180) / Math.PI),
    });
    return;
  }

  if (object.type === "rectangle") {
    const stroke = toColor(object.stroke);
    const fill = toColor(object.fill);
    const hasFill = object.fill !== "transparent" && object.fill !== "none";
    page.drawRectangle({
      x: placed.cx - placed.width / 2,
      y: placed.cy - placed.height / 2,
      width: placed.width,
      height: placed.height,
      borderColor: stroke,
      borderWidth: Math.max(0, object.thickness),
      borderOpacity: opacity,
      color: hasFill ? fill : undefined,
      opacity: hasFill ? opacity : 0,
      rotate: degrees(-object.rotation),
    });
    return;
  }

  if (object.type === "ellipse") {
    const stroke = toColor(object.stroke);
    const fill = toColor(object.fill);
    const hasFill = object.fill !== "transparent" && object.fill !== "none";
    page.drawEllipse({
      x: placed.cx,
      y: placed.cy,
      xScale: placed.width / 2,
      yScale: placed.height / 2,
      borderColor: stroke,
      borderWidth: Math.max(0, object.thickness),
      borderOpacity: opacity,
      color: hasFill ? fill : undefined,
      opacity: hasFill ? opacity : 0,
      rotate: degrees(-object.rotation),
    });
    return;
  }

  if (object.type === "line" || object.type === "arrow") {
    const color = toColor(object.stroke);
    const start = mapLocal(0, 0.5);
    const end = mapLocal(1, 0.5);
    const thickness = Math.max(0.5, object.thickness);
    page.drawLine({ start, end, thickness, color, opacity, lineCap: LineCapStyle.Round });
    if (object.type === "arrow") {
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const headLength = Math.max(6, thickness * 4);
      const spread = Math.PI / 7;
      page.drawLine({
        start: end,
        end: {
          x: end.x - headLength * Math.cos(angle - spread),
          y: end.y - headLength * Math.sin(angle - spread),
        },
        thickness,
        color,
        opacity,
        lineCap: LineCapStyle.Round,
      });
      page.drawLine({
        start: end,
        end: {
          x: end.x - headLength * Math.cos(angle + spread),
          y: end.y - headLength * Math.sin(angle + spread),
        },
        thickness,
        color,
        opacity,
        lineCap: LineCapStyle.Round,
      });
    }
  }
}

export async function exportPdf(options: ExportOptions): Promise<Uint8Array> {
  const structureBytes = await buildPdfBytes({
    pages: options.pages.map((page) => ({
      sourceDocumentId: page.sourceDocumentId,
      sourcePageIndex: page.sourcePageIndex,
      rotation: page.rotation,
      width: page.width,
      height: page.height,
    })),
    sources: options.sources,
    metadata: options.metadata,
    useObjectStreams: options.useObjectStreams ?? true,
  });

  const objectsByPageId = options.objectsByPageId ?? {};
  const hasObjects = options.pages.some((page) => (objectsByPageId[page.id]?.length ?? 0) > 0);
  if (!hasObjects) return structureBytes;

  const { PDFDocument, pushGraphicsState, popGraphicsState, concatTransformationMatrix } =
    await import("pdf-lib");
  const pdf = await PDFDocument.load(structureBytes, { updateMetadata: false });
  const pages = pdf.getPages();
  const context: DrawContext = { pdf, imageCache: new Map(), signal: options.signal };

  try {
    for (let index = 0; index < options.pages.length; index += 1) {
      if (options.signal?.aborted) throw new PdfError("OPERATION_CANCELLED");
      const model = options.pages[index];
      const objects = objectsByPageId[model.id] ?? [];
      const pdfPage = pages[index];
      if (!pdfPage) continue;

      if (objects.length > 0) {
        const display = displaySize(model.width, model.height, model.rotation);
        const matrix = displayToPdfMatrix(model.width, model.height, model.rotation);
        pdfPage.pushOperators(
          pushGraphicsState(),
          concatTransformationMatrix(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]),
        );
        for (const object of objects) {
          await drawEditorObject(context, pdfPage, object, display.width, display.height);
        }
        pdfPage.pushOperators(popGraphicsState());
      }
      options.onProgress?.(index + 1, options.pages.length);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    return await pdf.save({ useObjectStreams: options.useObjectStreams ?? true });
  } catch (error) {
    if (error instanceof PdfError) throw error;
    throw new PdfError("EXPORT_FAILED", undefined, { cause: error });
  }
}
