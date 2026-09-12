import { create } from "zustand";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import {
  createBlankPage,
  createImagePage,
  deletePages,
  duplicatePages,
  insertAfterPage,
  insertPagesAt,
  movePageById,
  reorderPage,
  rotatePages,
  selectPageIdsByNumbers,
} from "@/pdf/core/page-engine";
import {
  createImageObject,
  createMarkupObject,
  createShapeObject,
  createTextObject,
  duplicateObjects,
  pasteObjects,
  removeObjects,
  updateObject,
  updateObjects,
} from "@/pdf/core/editor/model";
import { displaySize } from "@/pdf/core/coordinates";
import type { LoadedImage } from "@/pdf/core/image";
import type {
  EditorObject,
  PdfMetadata,
  PdfPageModel,
  PdfSourceDocument,
  ShapeObject,
  TextObject,
} from "@/pdf/types";

export type EditorTool =
  | "select"
  | "text"
  | "image"
  | "draw"
  | "eraser"
  | "highlight"
  | "underline"
  | "strikethrough"
  | "shape"
  | "signature";

export interface ToolSettings {
  text: Pick<
    TextObject,
    "fontFamily" | "fontSize" | "bold" | "italic" | "underline" | "align" | "color" | "lineHeight"
  >;
  draw: { color: string; thickness: number };
  shape: Pick<ShapeObject, "type" | "stroke" | "fill" | "thickness">;
  markup: { color: string; opacity: number };
}

interface Snapshot {
  pages: PdfPageModel[];
  objects: Record<string, EditorObject[]>;
}

interface WorkspaceState {
  sources: PdfSourceDocument[];
  pages: PdfPageModel[];
  objects: Record<string, EditorObject[]>;
  metadata: PdfMetadata;
  activePageId?: string;
  selectedPageIds: string[];
  selectedObjectIds: string[];
  clipboard: EditorObject[];
  tool: EditorTool;
  settings: ToolSettings;
  past: Snapshot[];
  future: Snapshot[];

  reset(): void;
  hydrate(document: LoadedDocument, mode?: "replace" | "append"): void;
  setMetadata(metadata: Partial<PdfMetadata>): void;
  setTool(tool: EditorTool): void;
  setSettings(patch: Partial<ToolSettings>): void;
  setActivePage(pageId: string): void;

  selectPages(pageIds: string[], additive?: boolean): void;
  selectPageNumbers(numbers: number[]): void;
  selectObjects(ids: string[], additive?: boolean): void;
  clearSelection(): void;

  reorderPages(fromIndex: number, toIndex: number): void;
  movePage(pageId: string, toIndex: number): void;
  deleteSelectedPages(): void;
  rotateSelectedPages(delta: number): void;
  duplicateSelectedPages(): void;
  insertBlankPage(afterPageId?: string): void;
  insertImagePage(image: LoadedImage, afterPageId?: string): void;
  insertDocuments(documents: LoadedDocument[], atIndex?: number): void;

  addObject(object: EditorObject): void;
  addObjects(objects: EditorObject[]): void;
  updateObjectById(id: string, patch: Partial<EditorObject>, options?: { history?: boolean }): void;
  updateSelectedObjects(patch: Partial<EditorObject>): void;
  deleteSelectedObjects(): void;
  deleteObjectsByIds(ids: string[]): void;
  duplicateSelectedObjects(): void;
  copySelection(): void;
  pasteClipboard(): void;
  reorderObject(id: string, direction: "forward" | "backward" | "front" | "back"): void;

  undo(): void;
  redo(): void;
  markExported(): void;
  edited: boolean;
}

const DEFAULT_SETTINGS: ToolSettings = {
  text: {
    fontFamily: "Helvetica, Arial, sans-serif",
    fontSize: 16,
    bold: false,
    italic: false,
    underline: false,
    align: "left",
    color: "#0f172a",
    lineHeight: 1.3,
  },
  draw: { color: "#2563eb", thickness: 3 },
  shape: { type: "rectangle", stroke: "#2563eb", fill: "transparent", thickness: 2 },
  markup: { color: "#fde047", opacity: 0.85 },
};

const HISTORY_LIMIT = 60;

function snapshot(state: Pick<WorkspaceState, "pages" | "objects">): Snapshot {
  return {
    pages: state.pages.map((page) => ({ ...page })),
    objects: Object.fromEntries(
      Object.entries(state.objects).map(([key, value]) => [key, [...value]]),
    ),
  };
}

function firstPageId(pages: PdfPageModel[]): string | undefined {
  return pages[0]?.id;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => {
  const pushHistory = () => {
    const state = get();
    const entry = snapshot(state);
    const past = [...state.past, entry].slice(-HISTORY_LIMIT);
    set({ past, future: [], edited: true });
  };

  const apply = (updater: (state: WorkspaceState) => Partial<WorkspaceState>) => {
    pushHistory();
    set((state) => updater(state));
  };

  return {
    sources: [],
    pages: [],
    objects: {},
    metadata: {},
    activePageId: undefined,
    selectedPageIds: [],
    selectedObjectIds: [],
    clipboard: [],
    tool: "select",
    settings: DEFAULT_SETTINGS,
    past: [],
    future: [],
    edited: false,

    reset: () =>
      set({
        sources: [],
        pages: [],
        objects: {},
        metadata: {},
        activePageId: undefined,
        selectedPageIds: [],
        selectedObjectIds: [],
        clipboard: [],
        tool: "select",
        past: [],
        future: [],
        edited: false,
      }),

    hydrate: (document, mode = "replace") =>
      set((state) => {
        if (mode === "replace") {
          return {
            sources: [document.source],
            pages: document.pages,
            objects: {},
            metadata: document.metadata,
            activePageId: firstPageId(document.pages),
            selectedPageIds: [],
            selectedObjectIds: [],
            past: [],
            future: [],
            edited: false,
          };
        }
        const pages = [...state.pages, ...document.pages];
        return {
          sources: [...state.sources, document.source],
          pages,
          metadata: state.metadata.title ? state.metadata : document.metadata,
          activePageId: state.activePageId ?? firstPageId(pages),
          past: [],
          future: [],
          edited: true,
        };
      }),

    setMetadata: (metadata) => set((state) => ({ metadata: { ...state.metadata, ...metadata } })),
    setTool: (tool) => set({ tool }),
    setSettings: (patch) => set((state) => ({ settings: { ...state.settings, ...patch } })),
    setActivePage: (pageId) => set({ activePageId: pageId }),

    selectPages: (pageIds, additive = false) =>
      set((state) => ({
        selectedPageIds: additive
          ? [...new Set([...state.selectedPageIds, ...pageIds])]
          : pageIds,
      })),
    selectPageNumbers: (numbers) =>
      set((state) => ({ selectedPageIds: selectPageIdsByNumbers(state.pages, numbers) })),
    selectObjects: (ids, additive = false) =>
      set((state) => ({
        selectedObjectIds: additive
          ? [...new Set([...state.selectedObjectIds, ...ids])]
          : ids,
      })),
    clearSelection: () => set({ selectedPageIds: [], selectedObjectIds: [] }),

    reorderPages: (fromIndex, toIndex) =>
      apply((state) => ({ pages: reorderPage(state.pages, fromIndex, toIndex) })),
    movePage: (pageId, toIndex) =>
      apply((state) => ({ pages: movePageById(state.pages, pageId, toIndex) })),
    deleteSelectedPages: () =>
      apply((state) => {
        if (state.selectedPageIds.length === 0) return {};
        if (state.selectedPageIds.length >= state.pages.length) return {};
        const pages = deletePages(state.pages, state.selectedPageIds);
        const objects = { ...state.objects };
        for (const id of state.selectedPageIds) delete objects[id];
        return {
          pages,
          objects,
          selectedPageIds: [],
          activePageId: pages.some((page) => page.id === state.activePageId)
            ? state.activePageId
            : firstPageId(pages),
        };
      }),
    rotateSelectedPages: (delta) =>
      apply((state) => ({
        pages: rotatePages(state.pages, state.selectedPageIds, delta),
      })),
    duplicateSelectedPages: () =>
      apply((state) => ({ pages: duplicatePages(state.pages, state.selectedPageIds) })),
    insertBlankPage: (afterPageId) =>
      apply((state) => {
        const reference = afterPageId ?? state.activePageId;
        const source = state.pages.find((page) => page.id === reference);
        const blank = createBlankPage({
          width: source?.width,
          height: source?.height,
        });
        return reference
          ? { pages: insertAfterPage(state.pages, reference, [blank]), activePageId: blank.id }
          : { pages: [...state.pages, blank], activePageId: blank.id };
      }),
    insertImagePage: (image, afterPageId) =>
      apply((state) => {
        const landscape = image.width > image.height;
        const width = landscape ? 841.89 : 595.28;
        const height = landscape ? 595.28 : 841.89;
        const page = createImagePage(width, height);
        const display = displaySize(width, height, 0);
        const aspect = image.width / image.height;
        const pageAspect = display.width / display.height;
        let objectWidth = 0.9;
        let objectHeight = (objectWidth * display.width) / aspect / display.height;
        if (objectHeight > 0.9) {
          objectHeight = 0.9;
          objectWidth = (objectHeight * display.height * aspect) / display.width;
        }
        const object = createImageObject(
          { pageId: page.id, x: 0.5, y: 0.5, width: objectWidth, height: objectHeight },
          image.dataUrl,
          image.format,
        );
        const reference = afterPageId ?? state.activePageId;
        const pages = reference
          ? insertAfterPage(state.pages, reference, [page])
          : [...state.pages, page];
        return {
          pages,
          objects: { ...state.objects, [page.id]: [object] },
          activePageId: page.id,
        };
      }),
    insertDocuments: (documents, atIndex) =>
      apply((state) => {
        const newPages = documents.flatMap((document) => document.pages);
        const index = atIndex ?? state.pages.length;
        return {
          sources: [...state.sources, ...documents.map((document) => document.source)],
          pages: insertPagesAt(state.pages, newPages, index),
          edited: true,
        };
      }),

    addObject: (object) =>
      apply((state) => ({
        objects: {
          ...state.objects,
          [object.pageId]: [...(state.objects[object.pageId] ?? []), object],
        },
        selectedObjectIds: [object.id],
      })),
    addObjects: (objects) =>
      apply((state) => {
        const next = { ...state.objects };
        for (const object of objects) {
          next[object.pageId] = [...(next[object.pageId] ?? []), object];
        }
        return { objects: next, selectedObjectIds: objects.map((object) => object.id) };
      }),
    updateObjectById: (id, patch, options) => {
      if (options?.history) pushHistory();
      set((state) => {
        const next: Record<string, EditorObject[]> = {};
        for (const [key, value] of Object.entries(state.objects)) {
          next[key] = updateObject(value, id, patch);
        }
        return { objects: next };
      });
    },
    updateSelectedObjects: (patch) => {
      const ids = get().selectedObjectIds;
      if (ids.length === 0) return;
      set((state) => {
        const next: Record<string, EditorObject[]> = {};
        for (const [key, value] of Object.entries(state.objects)) {
          next[key] = updateObjects(value, ids, patch);
        }
        return { objects: next };
      });
    },
    deleteSelectedObjects: () =>
      apply((state) => {
        if (state.selectedObjectIds.length === 0) return {};
        const next: Record<string, EditorObject[]> = {};
        for (const [key, value] of Object.entries(state.objects)) {
          next[key] = removeObjects(value, state.selectedObjectIds);
        }
        return { objects: next, selectedObjectIds: [] };
      }),
    deleteObjectsByIds: (ids) =>
      apply((state) => {
        if (ids.length === 0) return {};
        const next: Record<string, EditorObject[]> = {};
        const target = new Set(ids);
        for (const [key, value] of Object.entries(state.objects)) {
          next[key] = value.filter((object) => !target.has(object.id));
        }
        return { objects: next, selectedObjectIds: state.selectedObjectIds.filter((id) => !target.has(id)) };
      }),
    duplicateSelectedObjects: () =>
      apply((state) => {
        if (state.selectedObjectIds.length === 0) return {};
        const next = { ...state.objects };
        const newIds: string[] = [];
        const seen = new Set<string>();
        for (const [key, value] of Object.entries(state.objects)) {
          const target = value.filter((object) => state.selectedObjectIds.includes(object.id));
          if (target.length === 0) continue;
          const result = duplicateObjects(value, target.map((object) => object.id));
          next[key] = result.objects;
          for (const id of result.newIds) if (!seen.has(id)) newIds.push(id);
        }
        return { objects: next, selectedObjectIds: newIds };
      }),
    copySelection: () =>
      set((state) => {
        const copied: EditorObject[] = [];
        for (const value of Object.values(state.objects)) {
          for (const object of value) {
            if (state.selectedObjectIds.includes(object.id)) copied.push(object);
          }
        }
        return { clipboard: copied };
      }),
    pasteClipboard: () =>
      apply((state) => {
        if (state.clipboard.length === 0) return {};
        const pageId = state.activePageId ?? firstPageId(state.pages);
        if (!pageId) return {};
        const result = pasteObjects(
          state.objects[pageId] ?? [],
          state.clipboard,
          pageId,
        );
        return {
          objects: { ...state.objects, [pageId]: result.objects },
          selectedObjectIds: result.newIds,
        };
      }),
    reorderObject: (id, direction) =>
      apply((state) => {
        const next = { ...state.objects };
        for (const [key, value] of Object.entries(state.objects)) {
          const index = value.findIndex((object) => object.id === id);
          if (index < 0) continue;
          const copy = [...value];
          const [item] = copy.splice(index, 1);
          if (direction === "forward") copy.splice(Math.min(index + 1, copy.length), 0, item);
          else if (direction === "backward") copy.splice(Math.max(index - 1, 0), 0, item);
          else if (direction === "front") copy.push(item);
          else copy.unshift(item);
          next[key] = copy;
        }
        return { objects: next };
      }),

    undo: () =>
      set((state) => {
        const previous = state.past[state.past.length - 1];
        if (!previous) return {};
        return {
          past: state.past.slice(0, -1),
          future: [snapshot(state), ...state.future].slice(0, HISTORY_LIMIT),
          pages: previous.pages,
          objects: previous.objects,
          selectedObjectIds: [],
        };
      }),
    redo: () =>
      set((state) => {
        const next = state.future[0];
        if (!next) return {};
        return {
          past: [...state.past, snapshot(state)].slice(-HISTORY_LIMIT),
          future: state.future.slice(1),
          pages: next.pages,
          objects: next.objects,
          selectedObjectIds: [],
        };
      }),

    markExported: () => set({ edited: false }),
  };
});

export function activePageObjects(state: Pick<WorkspaceState, "objects" | "activePageId">): EditorObject[] {
  if (!state.activePageId) return [];
  return state.objects[state.activePageId] ?? [];
}

export function createMarkupForTool(
  tool: Extract<EditorTool, "highlight" | "underline" | "strikethrough">,
  geometry: { pageId: string; x: number; y: number; width: number; height: number },
  color: string,
  opacity: number,
): EditorObject {
  return createMarkupObject(geometry, tool, { color, opacity });
}

export {
  createTextObject,
  createShapeObject,
  createImageObject,
  updateObject,
  updateObjects,
  removeObjects,
};
