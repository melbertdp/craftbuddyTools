import { newId } from "@/pdf/core/byte-store";
import type {
  DrawingObject,
  EditorObject,
  ImageObject,
  MarkupObject,
  ShapeObject,
  TextObject,
} from "@/pdf/types";

export const DEFAULT_TEXT_COLOR = "#0f172a";
export const DEFAULT_STROKE_COLOR = "#2563eb";
export const DEFAULT_HIGHLIGHT_COLOR = "#fde047";

interface ObjectGeometry {
  pageId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export function createTextObject(
  geometry: ObjectGeometry,
  overrides: Partial<TextObject> = {},
): TextObject {
  return {
    id: newId("obj"),
    pageId: geometry.pageId,
    type: "text",
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rotation: 0,
    opacity: 1,
    text: "Text",
    fontFamily: "Helvetica, Arial, sans-serif",
    fontSize: 14,
    bold: false,
    italic: false,
    underline: false,
    align: "left",
    color: DEFAULT_TEXT_COLOR,
    lineHeight: 1.3,
    ...overrides,
  };
}

export function createImageObject(
  geometry: ObjectGeometry,
  dataUrl: string,
  format: ImageObject["format"],
  overrides: Partial<ImageObject> = {},
): ImageObject {
  return {
    id: newId("obj"),
    pageId: geometry.pageId,
    type: "image",
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rotation: 0,
    opacity: 1,
    dataUrl,
    format,
    ...overrides,
  };
}

export function createDrawingObject(
  pageId: string,
  overrides: Partial<DrawingObject> = {},
): DrawingObject {
  return {
    id: newId("obj"),
    pageId,
    type: "drawing",
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    rotation: 0,
    opacity: 1,
    points: [],
    color: DEFAULT_STROKE_COLOR,
    thickness: 3,
    mode: "draw",
    ...overrides,
  };
}

export function createShapeObject(
  geometry: ObjectGeometry,
  type: ShapeObject["type"],
  overrides: Partial<ShapeObject> = {},
): ShapeObject {
  return {
    id: newId("obj"),
    pageId: geometry.pageId,
    type,
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rotation: 0,
    opacity: 1,
    stroke: DEFAULT_STROKE_COLOR,
    fill: "transparent",
    thickness: 2,
    ...overrides,
  };
}

export function createMarkupObject(
  geometry: ObjectGeometry,
  type: MarkupObject["type"],
  overrides: Partial<MarkupObject> = {},
): MarkupObject {
  return {
    id: newId("obj"),
    pageId: geometry.pageId,
    type,
    x: geometry.x,
    y: geometry.y,
    width: geometry.width,
    height: geometry.height,
    rotation: 0,
    opacity: 0.85,
    color: DEFAULT_HIGHLIGHT_COLOR,
    ...overrides,
  };
}

export function updateObject<T extends EditorObject>(
  objects: T[],
  id: string,
  patch: Partial<EditorObject>,
): T[] {
  return objects.map((object) =>
    object.id === id ? ({ ...object, ...patch } as T) : object,
  );
}

export function updateObjects<T extends EditorObject>(
  objects: T[],
  ids: Iterable<string>,
  patch: Partial<EditorObject>,
): T[] {
  const target = new Set(ids);
  return objects.map((object) => (target.has(object.id) ? ({ ...object, ...patch } as T) : object));
}

export function removeObjects<T extends EditorObject>(objects: T[], ids: Iterable<string>): T[] {
  const target = new Set(ids);
  return objects.filter((object) => !target.has(object.id));
}

export function duplicateObjects<T extends EditorObject>(
  objects: T[],
  ids: Iterable<string>,
  offset = 0.02,
): { objects: T[]; newIds: string[] } {
  const target = new Set(ids);
  const additions: T[] = [];
  const newIds: string[] = [];
  for (const object of objects) {
    if (!target.has(object.id)) continue;
    const clone = {
      ...object,
      id: newId("obj"),
      x: object.x + offset,
      y: object.y + offset,
    } as T;
    additions.push(clone);
    newIds.push(clone.id);
  }
  return { objects: [...objects, ...additions], newIds };
}

export function serializeEditorObjects(objects: EditorObject[]): string {
  return JSON.stringify({ version: 1, objects });
}

export function parseEditorObjects(serialized: string): EditorObject[] {
  const parsed: unknown = JSON.parse(serialized);
  if (
    typeof parsed === "object" &&
    parsed !== null &&
    "objects" in parsed &&
    Array.isArray((parsed as { objects: unknown }).objects)
  ) {
    return (parsed as { objects: EditorObject[] }).objects;
  }
  return [];
}

export function copyObjects<T extends EditorObject>(objects: T[], ids: Iterable<string>): T[] {
  const target = new Set(ids);
  return objects.filter((object) => target.has(object.id));
}

export function pasteObjects<T extends EditorObject>(
  objects: T[],
  clipboard: EditorObject[],
  targetPageId: string,
  offset = 0.02,
): { objects: T[]; newIds: string[] } {
  const additions = clipboard.map(
    (object) =>
      ({
        ...object,
        id: newId("obj"),
        pageId: targetPageId,
        x: object.x + offset,
        y: object.y + offset,
      }) as T,
  );
  return { objects: [...objects, ...additions], newIds: additions.map((object) => object.id) };
}
