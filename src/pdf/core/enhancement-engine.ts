import { newId } from "./byte-store";
import { displaySize } from "./coordinates";
import { createImageObject, createTextObject } from "./editor/model";
import type { EditorObject, ImageObject, PdfMetadata, PdfPageModel, TextObject } from "@/pdf/types";

export type StampPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "center"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

export const POSITIONS: StampPosition[] = [
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "center",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
];

function horizontalAlignment(position: StampPosition): "left" | "center" | "right" {
  if (position.endsWith("left")) return "left";
  if (position.endsWith("right")) return "right";
  return "center";
}

function verticalAlignment(position: StampPosition): "top" | "middle" | "bottom" {
  if (position.startsWith("top")) return "top";
  if (position.startsWith("bottom")) return "bottom";
  return "middle";
}

interface TextBoxInput {
  page: PdfPageModel;
  text: string;
  fontSize: number;
  position: StampPosition;
  margin: number;
  lineHeight?: number;
  align?: "left" | "center" | "right";
  boxWidth?: number;
}

function textBoxForPage(input: TextBoxInput): { x: number; y: number; width: number; height: number; align: "left" | "center" | "right" } {
  const display = displaySize(input.page.width, input.page.height, input.page.rotation);
  const margin = input.margin;
  const boxWidth = input.boxWidth ?? Math.max(0.2, (display.width - margin * 2) / display.width);
  const height = ((input.fontSize * (input.lineHeight ?? 1.3)) / display.height) * 1.2;
  const horizontal = input.align ?? horizontalAlignment(input.position);
  const vertical = verticalAlignment(input.position);

  let x: number;
  if (horizontal === "left") x = margin / display.width + boxWidth / 2;
  else if (horizontal === "right") x = 1 - margin / display.width - boxWidth / 2;
  else x = 0.5;

  let y: number;
  if (vertical === "top") y = margin / display.height + height / 2;
  else if (vertical === "bottom") y = 1 - margin / display.height - height / 2;
  else y = 0.5;

  return { x, y, width: boxWidth, height, align: horizontal };
}

export interface WatermarkOptions {
  kind: "text" | "image";
  text: string;
  dataUrl?: string;
  format?: ImageObject["format"];
  fontFamily: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  scale: number;
  position: StampPosition;
  tiled: boolean;
  pageNumbers: number[];
  margin: number;
}

export function buildWatermarkObjects(
  pages: PdfPageModel[],
  options: WatermarkOptions,
): Record<string, EditorObject[]> {
  const result: Record<string, EditorObject[]> = {};
  const target = new Set(options.pageNumbers);
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (target.size > 0 && !target.has(index + 1)) continue;
    const objects: EditorObject[] = [];

    if (options.kind === "text") {
      if (options.tiled) {
        const columns = 3;
        const rows = 4;
        for (let row = 0; row < rows; row += 1) {
          for (let column = 0; column < columns; column += 1) {
            const x = (column + 0.5) / columns;
            const y = (row + 0.5) / rows;
            objects.push(
              buildTextStamp({
                id: newId("wm"),
                pageId: page.id,
                text: options.text,
                fontFamily: options.fontFamily,
                fontSize: options.fontSize * options.scale,
                color: options.color,
                opacity: options.opacity,
                rotation: options.rotation,
                x,
                y,
              }),
            );
          }
        }
      } else {
        const box = textBoxForPage({
          page,
          text: options.text,
          fontSize: options.fontSize * options.scale,
          position: options.position,
          margin: options.margin,
        });
        objects.push(
          buildTextStamp({
            id: newId("wm"),
            pageId: page.id,
            text: options.text,
            fontFamily: options.fontFamily,
            fontSize: options.fontSize * options.scale,
            color: options.color,
            opacity: options.opacity,
            rotation: options.rotation,
            x: box.x,
            y: box.y,
          }),
        );
      }
    } else if (options.dataUrl) {
      const display = displaySize(page.width, page.height, page.rotation);
      const widthNorm = Math.min(1, 0.5 * options.scale);
      const heightNorm = widthNorm * (display.width / display.height);
      const horizontal = horizontalAlignment(options.position);
      const vertical = verticalAlignment(options.position);
      const x =
        horizontal === "left"
          ? options.margin / display.width + widthNorm / 2
          : horizontal === "right"
            ? 1 - options.margin / display.width - widthNorm / 2
            : 0.5;
      const y =
        vertical === "top"
          ? options.margin / display.height + heightNorm / 2
          : vertical === "bottom"
            ? 1 - options.margin / display.height - heightNorm / 2
            : 0.5;
      objects.push(
        createImageObject(
          { pageId: page.id, x, y, width: widthNorm, height: heightNorm },
          options.dataUrl,
          options.format ?? "png",
          {
            id: newId("wm"),
            type: "image",
            opacity: options.opacity,
            rotation: options.rotation,
          },
        ),
      );
    }
    result[page.id] = objects;
  }
  return result;
}

function buildTextStamp(input: {
  id: string;
  pageId: string;
  text: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  opacity: number;
  rotation: number;
  x: number;
  y: number;
  align?: TextObject["align"];
}): TextObject {
  const width = 0.9;
  const height = 0.06;
  return createTextObject(
    { pageId: input.pageId, x: input.x, y: input.y, width, height },
    {
      id: input.id,
      type: "text",
      text: input.text,
      fontFamily: input.fontFamily,
      fontSize: input.fontSize,
      color: input.color,
      opacity: input.opacity,
      rotation: input.rotation,
      align: input.align ?? "center",
      bold: true,
    },
  );
}

export type PageNumberFormat = "n" | "page-n" | "n-of-total" | "page-n-of-total";

export interface PageNumberOptions {
  format: PageNumberFormat;
  startNumber: number;
  prefix: string;
  suffix: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  position: StampPosition;
  margin: number;
  pageNumbers: number[];
}

export function formatPageNumber(
  format: PageNumberFormat,
  number: number,
  total: number,
): string {
  switch (format) {
    case "n":
      return String(number);
    case "page-n":
      return `Page ${number}`;
    case "n-of-total":
      return `${number} of ${total}`;
    case "page-n-of-total":
      return `Page ${number} of ${total}`;
  }
}

export function buildPageNumberObjects(
  pages: PdfPageModel[],
  options: PageNumberOptions,
): Record<string, EditorObject[]> {
  const result: Record<string, EditorObject[]> = {};
  const target = new Set(options.pageNumbers);
  let counter = options.startNumber;
  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (target.size > 0 && !target.has(index + 1)) continue;
    const label = `${options.prefix}${formatPageNumber(options.format, counter, pages.length)}${options.suffix}`;
    counter += 1;
    const box = textBoxForPage({
      page,
      text: label,
      fontSize: options.fontSize,
      position: options.position,
      margin: options.margin,
      boxWidth: 0.6,
    });
    result[page.id] = [
      buildTextStamp({
        id: newId("pn"),
        pageId: page.id,
        text: label,
        fontFamily: options.fontFamily,
        fontSize: options.fontSize,
        color: options.color,
        opacity: 1,
        rotation: 0,
        x: box.x,
        y: box.y,
        align: box.align,
      }),
    ];
  }
  return result;
}

export interface MetadataUpdateOptions {
  metadata: PdfMetadata;
  remove?: boolean;
}

export async function updatePdfMetadata(
  bytes: Uint8Array,
  options: MetadataUpdateOptions,
): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.load(bytes, { updateMetadata: false });
  if (options.remove) {
    pdf.setTitle("");
    pdf.setAuthor("");
    pdf.setSubject("");
    pdf.setKeywords([]);
    pdf.setCreator("");
    pdf.setProducer("");
  } else {
    const { title, author, subject, keywords, creator, producer } = options.metadata;
    pdf.setTitle(title ?? "");
    pdf.setAuthor(author ?? "");
    pdf.setSubject(subject ?? "");
    pdf.setKeywords(keywords ? keywords.split(/[,;]\s*/).filter(Boolean) : []);
    pdf.setCreator(creator ?? "");
    pdf.setProducer(producer ?? "");
  }
  return pdf.save({ useObjectStreams: true });
}
