"use client";

import * as React from "react";
import * as fabric from "fabric";
import type { DrawingPoint, EditorObject, PdfPageModel } from "@/pdf/types";
import { displaySize } from "@/pdf/core/coordinates";
import {
  createDrawingObject,
  createMarkupObject,
  createShapeObject,
  createTextObject,
} from "@/pdf/core/editor/model";
import { useWorkspaceStore } from "@/pdf/stores/workspace-store";
import {
  EDITOR_ID_KEY,
  createFabricObject,
  fabricToGeometry,
  getEditorId,
  normalizeDrawingPoints,
  setEditorId,
} from "./fabric-bridge";

interface EditorCanvasProps {
  page: PdfPageModel;
  scale: number;
}

interface PendingShape {
  start: DrawingPoint;
  temp: fabric.Rect;
}

interface PendingDrawing {
  points: { x: number; y: number }[];
  temp?: fabric.Path;
  eraser: boolean;
}

const ERASE_TOLERANCE = 0.012;

export function EditorCanvas({ page, scale }: EditorCanvasProps) {
  const hostRef = React.useRef<HTMLDivElement>(null);
  const canvasRef = React.useRef<fabric.Canvas | undefined>(undefined);
  const pendingShape = React.useRef<PendingShape | undefined>(undefined);
  const pendingDrawing = React.useRef<PendingDrawing | undefined>(undefined);
  const editIdRef = React.useRef<string | undefined>(undefined);
  const syncingSelection = React.useRef(false);

  const tool = useWorkspaceStore((state) => state.tool);
  const settings = useWorkspaceStore((state) => state.settings);
  const objects = useWorkspaceStore((state) => state.objects[page.id]) ?? [];
  const selectedObjectIds = useWorkspaceStore((state) => state.selectedObjectIds);
  const selectionKey = selectedObjectIds.join(",");

  const display = displaySize(page.width, page.height, page.rotation);
  const viewWidth = display.width * scale;
  const viewHeight = display.height * scale;
  const viewport = { viewWidth, viewHeight, scale };

  const refs = React.useRef({ tool, settings, viewport, page });
  refs.current = { tool, settings, viewport, page };

  const applySelection = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ids = useWorkspaceStore.getState().selectedObjectIds;
    syncingSelection.current = true;
    canvas.discardActiveObject();
    const targets = canvas
      .getObjects()
      .filter((object) => ids.includes(getEditorId(object) ?? ""));
    if (targets.length === 1) canvas.setActiveObject(targets[0]);
    else if (targets.length > 1) {
      canvas.setActiveObject(new fabric.ActiveSelection(targets, { canvas }));
    }
    canvas.requestRenderAll();
    syncingSelection.current = false;
  }, []);

  const applyToolMode = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const currentTool = useWorkspaceStore.getState().tool;
    const selectable = currentTool === "select";
    canvas.selection = selectable;
    canvas.skipTargetFind = !selectable;
    for (const object of canvas.getObjects()) {
      object.selectable = selectable;
      object.evented = selectable;
    }
    canvas.defaultCursor = selectable ? "default" : "crosshair";
    canvas.requestRenderAll();
  }, []);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // Remove any canvas left behind by a previous mount (e.g. StrictMode).
    host.replaceChildren();
    const element = document.createElement("canvas");
    host.appendChild(element);
    const canvas = new fabric.Canvas(element, {
      selection: true,
      preserveObjectStacking: true,
      stopContextMenu: true,
      fireRightClick: false,
    });
    canvasRef.current = canvas;

    // Fabric wraps the canvas in its own container. Ensure that wrapper fills the
    // overlay host and that no stray element can offset it in normal flow.
    const wrapper = host.querySelector('div[data-fabric="wrapper"]');
    if (wrapper instanceof HTMLElement) {
      wrapper.style.position = "absolute";
      wrapper.style.inset = "0";
      wrapper.style.width = "100%";
      wrapper.style.height = "100%";
    }
    for (const child of Array.from(host.children)) {
      if (child !== wrapper && child.tagName === "CANVAS") child.remove();
    }

    const onSelectionChanged = () => {
      if (syncingSelection.current) return;
      const ids = canvas
        .getActiveObjects()
        .map((object) => getEditorId(object))
        .filter((id): id is string => Boolean(id));
      useWorkspaceStore.getState().selectObjects(ids);
    };
    canvas.on("selection:created", onSelectionChanged);
    canvas.on("selection:updated", onSelectionChanged);
    canvas.on("selection:cleared", () => {
      if (!syncingSelection.current) useWorkspaceStore.getState().selectObjects([]);
    });

    const syncObject = (object: fabric.FabricObject | undefined, history: boolean) => {
      if (!object) return;
      const id = getEditorId(object);
      if (!id) return;
      const store = useWorkspaceStore.getState();
      const geometry = fabricToGeometry(
        object as unknown as Parameters<typeof fabricToGeometry>[0],
        refs.current.viewport,
      );
      const patch: Partial<EditorObject> = { ...geometry };
      const maybeText = object as unknown as { text?: string };
      if (typeof maybeText.text === "string") {
        (patch as { text?: string }).text = maybeText.text;
      }
      store.updateObjectById(id, patch, { history });
    };

    canvas.on("object:modified", (event) => syncObject(event.target, true));
    canvas.on("text:editing:exited", (event) => syncObject(event.target, true));

    const point = (event: fabric.TPointerEvent) => canvas.getScenePoint(event);

    const handleDown = (event: fabric.TPointerEventInfo) => {
      const { tool: currentTool, settings: currentSettings, viewport: currentViewport, page: currentPage } =
        refs.current;
      if (currentTool === "select") return;
      const pointer = point(event.e);
      const nx = pointer.x / currentViewport.viewWidth;
      const ny = pointer.y / currentViewport.viewHeight;
      const store = useWorkspaceStore.getState();

      if (currentTool === "text") {
        const object = createTextObject(
          {
            pageId: currentPage.id,
            x: nx,
            y: ny,
            width: 0.28,
            height: Math.max(0.02, (currentSettings.text.fontSize * 1.5) / display.height),
          },
          currentSettings.text,
        );
        editIdRef.current = object.id;
        store.addObject(object);
        return;
      }

      if (currentTool === "draw" || currentTool === "eraser") {
        pendingDrawing.current = { points: [{ x: pointer.x, y: pointer.y }], eraser: currentTool === "eraser" };
        return;
      }

      if (currentTool === "image" || currentTool === "signature") return;

      const temp = new fabric.Rect({
        left: pointer.x,
        top: pointer.y,
        width: 1,
        height: 1,
        fill: "rgba(37,99,235,0.12)",
        stroke: "#2563eb",
        strokeDashArray: [4, 4],
        strokeWidth: 1,
        selectable: false,
        evented: false,
        originX: "left",
        originY: "top",
      });
      pendingShape.current = { start: { x: nx, y: ny }, temp };
      canvas.add(temp);
    };

    const handleMove = (event: fabric.TPointerEventInfo) => {
      const pointer = point(event.e);
      const drawing = pendingDrawing.current;
      if (drawing) {
        const last = drawing.points[drawing.points.length - 1];
        if (!last || Math.hypot(pointer.x - last.x, pointer.y - last.y) > 2) {
          drawing.points.push({ x: pointer.x, y: pointer.y });
          if (drawing.temp) canvas.remove(drawing.temp);
          const path = drawing.points
            .map((p, index) => `${index === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
            .join(" ");
          drawing.temp = new fabric.Path(path, {
            stroke: drawing.eraser ? "#dc2626" : refs.current.settings.draw.color,
            strokeWidth: Math.max(1, refs.current.settings.draw.thickness * refs.current.viewport.scale),
            fill: "",
            selectable: false,
            evented: false,
            strokeLineCap: "round",
            strokeLineJoin: "round",
            opacity: drawing.eraser ? 0.5 : 1,
          });
          canvas.add(drawing.temp);
        }
        canvas.requestRenderAll();
        return;
      }

      const shape = pendingShape.current;
      if (shape) {
        const { viewport: currentViewport } = refs.current;
        const startX = shape.start.x * currentViewport.viewWidth;
        const startY = shape.start.y * currentViewport.viewHeight;
        shape.temp.set({
          left: Math.min(startX, pointer.x),
          top: Math.min(startY, pointer.y),
          width: Math.abs(pointer.x - startX),
          height: Math.abs(pointer.y - startY),
        });
        shape.temp.setCoords();
        canvas.requestRenderAll();
      }
    };

    const finishDrawing = (pointer: { x: number; y: number }) => {
      const drawing = pendingDrawing.current;
      if (!drawing) return;
      pendingDrawing.current = undefined;
      if (drawing.temp) canvas.remove(drawing.temp);
      const { viewport: currentViewport, page: currentPage, settings: currentSettings } = refs.current;
      const normalized = drawing.points.map((p) => ({
        x: p.x / currentViewport.viewWidth,
        y: p.y / currentViewport.viewHeight,
      }));
      const store = useWorkspaceStore.getState();
      if (drawing.eraser) {
        const erasePoints = normalized;
        const targets = (store.objects[currentPage.id] ?? [])
          .filter((object) => object.type === "drawing")
          .filter((object) => {
            const points = (object as { points: DrawingPoint[] }).points;
            return points.some((point) =>
              erasePoints.some((erase) => Math.hypot(point.x - erase.x, point.y - erase.y) < ERASE_TOLERANCE),
            );
          })
          .map((object) => object.id);
        store.deleteObjectsByIds(targets);
        canvas.requestRenderAll();
        return;
      }
      if (drawing.points.length < 2) {
        canvas.requestRenderAll();
        return;
      }
      const local = normalizeDrawingPoints(normalized);
      const object = createDrawingObject(currentPage.id, {
        points: local.points,
        x: local.x,
        y: local.y,
        width: local.width,
        height: local.height,
        color: currentSettings.draw.color,
        thickness: currentSettings.draw.thickness,
        mode: "draw",
      });
      store.addObject(object);
    };

    const handleUp = (event: fabric.TPointerEventInfo) => {
      const { tool: currentTool, settings: currentSettings, viewport: currentViewport, page: currentPage } =
        refs.current;
      const pointer = point(event.e);
      const store = useWorkspaceStore.getState();

      if (pendingDrawing.current) {
        finishDrawing(pointer);
        return;
      }

      const shape = pendingShape.current;
      if (shape) {
        pendingShape.current = undefined;
        canvas.remove(shape.temp);
        const nx = pointer.x / currentViewport.viewWidth;
        const ny = pointer.y / currentViewport.viewHeight;
        const x = (shape.start.x + nx) / 2;
        const y = (shape.start.y + ny) / 2;
        const width = Math.abs(nx - shape.start.x);
        const height = Math.abs(ny - shape.start.y);
        if (width < 0.005 || height < 0.005) {
          canvas.requestRenderAll();
          return;
        }
        const geometry = { pageId: currentPage.id, x, y, width, height };
        if (
          currentTool === "highlight" ||
          currentTool === "underline" ||
          currentTool === "strikethrough"
        ) {
          store.addObject(
            createMarkupObject(geometry, currentTool, {
              color: currentSettings.markup.color,
              opacity: currentSettings.markup.opacity,
            }),
          );
        } else if (currentTool === "shape") {
          if (currentSettings.shape.type === "line" || currentSettings.shape.type === "arrow") {
            const dx = (nx - shape.start.x) * currentViewport.viewWidth;
            const dy = (ny - shape.start.y) * currentViewport.viewHeight;
            const length = Math.hypot(dx, dy) / currentViewport.viewWidth;
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            store.addObject(
              createShapeObject(
                { pageId: currentPage.id, x, y, width: length, height: 0 },
                currentSettings.shape.type,
                { ...currentSettings.shape, rotation: angle },
              ),
            );
          } else {
            store.addObject(
              createShapeObject(geometry, currentSettings.shape.type, currentSettings.shape),
            );
          }
        }
        canvas.requestRenderAll();
      }
    };

    canvas.on("mouse:down", handleDown);
    canvas.on("mouse:move", handleMove);
    canvas.on("mouse:up", handleUp);

    return () => {
      canvas.dispose();
      canvasRef.current = undefined;
      host.replaceChildren();
    };
  }, []);

  // Reconcile store objects into the Fabric canvas.
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const rebuild = async () => {
      canvas.getObjects().slice().forEach((object) => canvas.remove(object));
      for (const object of objects) {
        if (cancelled) return;
        const fabricObject = await createFabricObject(object, viewport, fabric);
        if (!fabricObject || cancelled) continue;
        setEditorId(fabricObject, object.id);
        fabricObject.set({ [EDITOR_ID_KEY]: object.id } as Record<string, unknown>);
        canvas.add(fabricObject);
      }
      applyToolMode();
      applySelection();
      canvas.requestRenderAll();
      const editId = editIdRef.current;
      if (editId) {
        editIdRef.current = undefined;
        const target = canvas.getObjects().find((object) => getEditorId(object) === editId);
        const editable = target as unknown as { enterEditing?: () => void; selectAll?: () => void };
        if (editable?.enterEditing) {
          canvas.setActiveObject(target as fabric.FabricObject);
          editable.enterEditing();
          editable.selectAll?.();
          canvas.requestRenderAll();
        }
      }
    };
    void rebuild();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [objects, page.id, viewWidth, viewHeight]);

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setDimensions({ width: viewWidth, height: viewHeight });
    canvas.requestRenderAll();
  }, [viewWidth, viewHeight]);

  React.useEffect(() => {
    applyToolMode();
  }, [tool, applyToolMode]);

  React.useEffect(() => {
    applySelection();
  }, [selectionKey, applySelection]);

  return (
    <div
      ref={hostRef}
      className="absolute left-0 top-0"
      style={{ width: viewWidth, height: viewHeight }}
      aria-hidden
    />
  );
}
