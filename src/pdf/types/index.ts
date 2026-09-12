export type Rotation = 0 | 90 | 180 | 270;

export interface PdfSourceDocument {
  id: string;
  name: string;
  size: number;
  bytes: Uint8Array;
  pageCount: number;
  encrypted: boolean;
}

export interface PdfPageModel {
  id: string;
  sourceDocumentId: string;
  sourcePageIndex: number;
  rotation: Rotation;
  width: number;
  height: number;
}

export interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
}

export interface DocumentOperation {
  kind: "reorder" | "delete" | "rotate" | "duplicate" | "insert-blank" | "insert-image";
  pageId: string;
  rotation?: Rotation;
  afterPageId?: string;
}

export type EditorObjectType =
  | "text"
  | "image"
  | "signature"
  | "drawing"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "rectangle"
  | "ellipse"
  | "line"
  | "arrow";

export interface EditorObjectBase {
  id: string;
  pageId: string;
  type: EditorObjectType;
  /** Normalized center position (0..1) in displayed page space, top-left origin. */
  x: number;
  y: number;
  /** Normalized size (0..1) relative to displayed page dimensions. */
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  locked?: boolean;
}

export interface TextObject extends EditorObjectBase {
  type: "text";
  text: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  align: "left" | "center" | "right";
  color: string;
  backgroundColor?: string;
  lineHeight: number;
}

export interface ImageObject extends EditorObjectBase {
  type: "image" | "signature";
  dataUrl: string;
  format: "png" | "jpeg" | "webp";
}

export interface DrawingPoint {
  x: number;
  y: number;
}

export interface DrawingObject extends EditorObjectBase {
  type: "drawing";
  points: DrawingPoint[];
  color: string;
  thickness: number;
  mode: "draw" | "eraser";
}

export interface ShapeObject extends EditorObjectBase {
  type: "rectangle" | "ellipse" | "line" | "arrow";
  stroke: string;
  fill: string;
  thickness: number;
}

export interface MarkupObject extends EditorObjectBase {
  type: "highlight" | "underline" | "strikethrough";
  color: string;
}

export type EditorObject =
  | TextObject
  | ImageObject
  | DrawingObject
  | ShapeObject
  | MarkupObject;

export interface EditorDocument {
  objects: EditorObject[];
}

export interface PageRangeSpec {
  ranges: PageRange[];
}

export interface PageRange {
  from: number;
  to: number;
}

export interface FileDescriptor {
  id: string;
  name: string;
  size: number;
  type: string;
}
