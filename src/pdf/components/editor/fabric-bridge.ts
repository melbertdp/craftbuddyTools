import type { EditorObject, DrawingPoint } from "@/pdf/types";

export interface Viewport {
  viewWidth: number;
  viewHeight: number;
  scale: number;
}

interface GeometryObject {
  left: number;
  top: number;
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  angle: number;
  set: (options: Record<string, unknown>) => void;
  setCoords: () => void;
}

export const EDITOR_ID_KEY = "editorId";

export interface FabricObjectWithId {
  editorId?: string;
}

export function setEditorId(object: unknown, id: string): void {
  (object as FabricObjectWithId).editorId = id;
}

export function getEditorId(object: unknown): string | undefined {
  return (object as FabricObjectWithId).editorId;
}

export function drawingBounds(points: DrawingPoint[]): {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
} {
  let minX = 1;
  let minY = 1;
  let maxX = 0;
  let maxY = 0;
  for (const point of points) {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Convert absolute page-normalized points into a local 0..1 bounding box. */
export function normalizeDrawingPoints(points: DrawingPoint[]): {
  points: DrawingPoint[];
  x: number;
  y: number;
  width: number;
  height: number;
} {
  const bounds = drawingBounds(points);
  const width = Math.max(0.0001, bounds.maxX - bounds.minX);
  const height = Math.max(0.0001, bounds.maxY - bounds.minY);
  const local = points.map((point) => ({
    x: (point.x - bounds.minX) / width,
    y: (point.y - bounds.minY) / height,
  }));
  return {
    points: local,
    x: (bounds.minX + bounds.maxX) / 2,
    y: (bounds.minY + bounds.maxY) / 2,
    width,
    height,
  };
}

export function buildSvgPathFromPoints(points: DrawingPoint[], viewport: Viewport): string {
  if (points.length === 0) return "";
  const commands: string[] = [];
  points.forEach((point, index) => {
    const px = point.x * viewport.viewWidth;
    const py = point.y * viewport.viewHeight;
    commands.push(`${index === 0 ? "M" : "L"} ${px.toFixed(2)} ${py.toFixed(2)}`);
  });
  return commands.join(" ");
}

/** Build an arrow path centered on the object's local box. */
export function buildArrowPath(length: number, head: number): string {
  const half = length / 2;
  const wing = head * 0.9;
  return [
    `M ${-half} 0`,
    `L ${half} 0`,
    `M ${half} 0`,
    `L ${half - wing} ${-head / 2}`,
    `M ${half} 0`,
    `L ${half - wing} ${head / 2}`,
  ].join(" ");
}

export interface GeometryPatch {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export function fabricToGeometry(object: GeometryObject, viewport: Viewport): GeometryPatch {
  const width = (object.width * Math.abs(object.scaleX)) / viewport.viewWidth;
  const height = (object.height * Math.abs(object.scaleY)) / viewport.viewHeight;
  return {
    x: object.left / viewport.viewWidth,
    y: object.top / viewport.viewHeight,
    width: Math.max(0, width),
    height: Math.max(0, height),
    rotation: object.angle,
  };
}

export function geometryToPixels(object: EditorObject, viewport: Viewport): {
  left: number;
  top: number;
  width: number;
  height: number;
} {
  return {
    left: object.x * viewport.viewWidth,
    top: object.y * viewport.viewHeight,
    width: object.width * viewport.viewWidth,
    height: object.height * viewport.viewHeight,
  };
}

export const FONT_FAMILIES = [
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Times", value: "'Times New Roman', Times, serif" },
  { label: "Courier", value: "'Courier New', Courier, monospace" },
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
];

export const SIGNATURE_FONTS = [
  { label: "Elegant", value: "'Georgia', 'Times New Roman', serif", italic: true, weight: "400" },
  { label: "Script", value: "'Segoe Script', 'Brush Script MT', cursive", italic: false, weight: "400" },
  { label: "Formal", value: "'Times New Roman', Times, serif", italic: true, weight: "600" },
  { label: "Casual", value: "'Comic Sans MS', cursive", italic: false, weight: "400" },
];

export function fabricFill(fill: string): string {
  return !fill || fill === "transparent" || fill === "none" ? "" : fill;
}

export async function createFabricObject(
  object: EditorObject,
  viewport: Viewport,
  fabric: typeof import("fabric"),
): Promise<import("fabric").FabricObject | undefined> {
  const px = geometryToPixels(object, viewport);
  const common = {
    left: px.left,
    top: px.top,
    originX: "center" as const,
    originY: "center" as const,
    angle: object.rotation,
    opacity: object.opacity,
    borderColor: "#2563eb",
    cornerColor: "#2563eb",
    cornerStyle: "circle" as const,
    transparentCorners: false,
    strokeUniform: true,
  };
  const scaled = (value: number) => Math.max(1, value * viewport.scale);

  switch (object.type) {
    case "text": {
      return new fabric.Textbox(object.text || " ", {
        ...common,
        width: Math.max(24, px.width),
        fontSize: Math.max(4, object.fontSize * viewport.scale),
        fontFamily: object.fontFamily,
        fontWeight: object.bold ? "bold" : "normal",
        fontStyle: object.italic ? "italic" : "normal",
        underline: object.underline,
        textAlign: object.align,
        fill: object.color,
        backgroundColor: object.backgroundColor ?? "",
        lineHeight: object.lineHeight,
        editable: true,
      });
    }
    case "image":
    case "signature": {
      const image = await fabric.FabricImage.fromURL(object.dataUrl, { crossOrigin: "anonymous" });
      image.set({
        ...common,
        scaleX: px.width / (image.width || 1),
        scaleY: px.height / (image.height || 1),
      });
      return image;
    }
    case "drawing": {
      const widthPx = object.width * viewport.viewWidth;
      const heightPx = object.height * viewport.viewHeight;
      const commands = object.points
        .map((point, index) =>
          `${index === 0 ? "M" : "L"} ${(point.x * widthPx).toFixed(2)} ${(point.y * heightPx).toFixed(2)}`,
        )
        .join(" ");
      if (!commands) return undefined;
      return new fabric.Path(commands, {
        ...common,
        stroke: object.color,
        strokeWidth: scaled(object.thickness),
        fill: "",
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });
    }
    case "highlight": {
      return new fabric.Rect({
        ...common,
        width: Math.max(4, px.width),
        height: Math.max(4, px.height),
        fill: object.color,
        stroke: "",
        strokeWidth: 0,
      });
    }
    case "underline":
    case "strikethrough": {
      const width = Math.max(4, px.width);
      const height = Math.max(4, px.height);
      const backdrop = new fabric.Rect({ width, height, fill: "", stroke: "", strokeWidth: 0 });
      const y = object.type === "underline" ? height / 2 : 0;
      const line = new fabric.Line([0, y, width, y], {
        stroke: object.color,
        strokeWidth: Math.max(1, scaled(2)),
        strokeLineCap: "round",
      });
      return new fabric.Group([backdrop, line], { ...common });
    }
    case "rectangle": {
      return new fabric.Rect({
        ...common,
        width: Math.max(4, px.width),
        height: Math.max(4, px.height),
        fill: fabricFill(object.fill),
        stroke: object.stroke,
        strokeWidth: Math.max(0, object.thickness * viewport.scale),
      });
    }
    case "ellipse": {
      return new fabric.Ellipse({
        ...common,
        rx: Math.max(2, px.width / 2),
        ry: Math.max(2, px.height / 2),
        fill: fabricFill(object.fill),
        stroke: object.stroke,
        strokeWidth: Math.max(0, object.thickness * viewport.scale),
      });
    }
    case "line": {
      const length = Math.max(4, px.width);
      const line = new fabric.Line([-length / 2, 0, length / 2, 0], {
        ...common,
        stroke: object.stroke,
        strokeWidth: scaled(object.thickness),
        fill: "",
        lockScalingY: true,
      });
      return line;
    }
    case "arrow": {
      const length = Math.max(8, px.width);
      const head = Math.max(6, object.thickness * 4 * viewport.scale);
      return new fabric.Path(buildArrowPath(length, head), {
        ...common,
        stroke: object.stroke,
        strokeWidth: scaled(object.thickness),
        fill: "",
        strokeLineCap: "round",
        strokeLineJoin: "round",
      });
    }
    default:
      return undefined;
  }
}
