import { beforeEach, describe, expect, it } from "vitest";
import { activePageObjects, createMarkupForTool, useWorkspaceStore } from "@/pdf/stores/workspace-store";
import { createTextObject } from "@/pdf/core/editor/model";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import type { PdfPageModel } from "@/pdf/types";

const mkPage = (id: string): PdfPageModel => ({
  id,
  sourceDocumentId: "doc",
  sourcePageIndex: 0,
  rotation: 0,
  width: 600,
  height: 800,
});

const mkDoc = (ids: string[], title?: string): LoadedDocument =>
  ({
    source: { id: `src-${ids.join("-")}`, bytes: new Uint8Array([1]), name: "d.pdf", pageCount: ids.length, sizeBytes: 10 },
    pages: ids.map(mkPage),
    metadata: title ? { title } : {},
    warnings: [],
  }) as unknown as LoadedDocument;

beforeEach(() => {
  useWorkspaceStore.getState().reset();
});

describe("workspace store lifecycle", () => {
  it("hydrates replace and append with metadata precedence", () => {
    const s = useWorkspaceStore.getState();
    s.hydrate(mkDoc(["a", "b"], "First"));
    expect(useWorkspaceStore.getState().pages.map((p) => p.id)).toEqual(["a", "b"]);
    expect(useWorkspaceStore.getState().activePageId).toBe("a");
    expect(useWorkspaceStore.getState().metadata.title).toBe("First");

    useWorkspaceStore.getState().hydrate(mkDoc(["c"], "Second"), "append");
    expect(useWorkspaceStore.getState().pages.map((p) => p.id)).toEqual(["a", "b", "c"]);
    // existing title wins on append
    expect(useWorkspaceStore.getState().metadata.title).toBe("First");

    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().hydrate(mkDoc(["x"]));
    useWorkspaceStore.getState().hydrate(mkDoc(["y"], "Second"), "append");
    // empty existing metadata adopts appended metadata
    expect(useWorkspaceStore.getState().metadata.title).toBe("Second");
  });

  it("manages page and object selection", () => {
    const s = useWorkspaceStore.getState();
    s.hydrate(mkDoc(["a", "b"]));
    s.selectPages(["a"]);
    expect(useWorkspaceStore.getState().selectedPageIds).toEqual(["a"]);
    s.selectPages(["b"], true);
    expect(useWorkspaceStore.getState().selectedPageIds).toEqual(["a", "b"]);
    s.selectPageNumbers([2]);
    expect(useWorkspaceStore.getState().selectedPageIds).toEqual(["b"]);
    s.selectObjects(["o1"]);
    s.selectObjects(["o2"], true);
    expect(useWorkspaceStore.getState().selectedObjectIds).toEqual(["o1", "o2"]);
    s.clearSelection();
    expect(useWorkspaceStore.getState().selectedPageIds).toEqual([]);
    s.setActivePage("b");
    expect(useWorkspaceStore.getState().activePageId).toBe("b");
    s.setTool("text");
    expect(useWorkspaceStore.getState().tool).toBe("text");
    s.setMetadata({ author: "me" });
    expect(useWorkspaceStore.getState().metadata.author).toBe("me");
  });

  it("guards delete-all pages and reassigns active page", () => {
    const s = useWorkspaceStore.getState();
    s.hydrate(mkDoc(["a", "b"]));
    s.selectPages(["a", "b"]);
    s.deleteSelectedPages();
    expect(useWorkspaceStore.getState().pages).toHaveLength(2); // guard
    s.selectPages(["a"]);
    s.deleteSelectedPages();
    expect(useWorkspaceStore.getState().pages.map((p) => p.id)).toEqual(["b"]);
    expect(useWorkspaceStore.getState().activePageId).toBe("b");
    // no selection = no-op but still pushes history; pages unchanged
    useWorkspaceStore.getState().deleteSelectedPages();
    expect(useWorkspaceStore.getState().pages).toHaveLength(1);
  });

  it("rotates, duplicates, moves and reorders pages", () => {
    const s = useWorkspaceStore.getState();
    s.hydrate(mkDoc(["a", "b", "c"]));
    s.selectPages(["b"]);
    s.rotateSelectedPages(90);
    expect(useWorkspaceStore.getState().pages.find((p) => p.id === "b")!.rotation).toBe(90);
    s.duplicateSelectedPages();
    expect(useWorkspaceStore.getState().pages).toHaveLength(4);
    s.movePage("c", 0);
    expect(useWorkspaceStore.getState().pages[0].id).toBe("c");
    s.reorderPages(0, 2);
    expect(useWorkspaceStore.getState().pages).toHaveLength(4);
  });

  it("inserts blank and image pages", () => {
    const s = useWorkspaceStore.getState();
    s.hydrate(mkDoc(["a"]));
    s.insertBlankPage("a");
    expect(useWorkspaceStore.getState().pages).toHaveLength(2);
    expect(useWorkspaceStore.getState().activePageId).not.toBe("a");

    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().insertBlankPage(); // no reference -> append
    expect(useWorkspaceStore.getState().pages).toHaveLength(1);

    useWorkspaceStore.getState().insertImagePage(
      { width: 800, height: 400, dataUrl: "data:image/png;base64,x", format: "png" } as never,
    );
    const st = useWorkspaceStore.getState();
    expect(st.pages).toHaveLength(2);
    const imgPage = st.pages.find((p) => p.sourceDocumentId === "image")!;
    expect(imgPage.width).toBeGreaterThan(imgPage.height); // landscape source
    expect(st.objects[imgPage.id]).toHaveLength(1);

    useWorkspaceStore.getState().insertImagePage(
      { width: 400, height: 800, dataUrl: "data:image/png;base64,x", format: "png" } as never,
      "missing-ref", // unknown reference appends after? implementation inserts at end
    );
    expect(useWorkspaceStore.getState().pages).toHaveLength(3);
  });

  it("inserts documents at index and end", () => {
    const s = useWorkspaceStore.getState();
    s.hydrate(mkDoc(["a"]));
    s.insertDocuments([mkDoc(["b", "c"])]);
    expect(useWorkspaceStore.getState().pages.map((p) => p.id)).toEqual(["a", "b", "c"]);
    s.insertDocuments([mkDoc(["z"])], 0);
    expect(useWorkspaceStore.getState().pages[0].id).toBe("z");
  });

  it("manages objects, clipboard, undo/redo and export flag", () => {
    const s = useWorkspaceStore.getState();
    s.hydrate(mkDoc(["p1"]));
    const obj = createTextObject({ pageId: "p1", x: 0.5, y: 0.5, width: 0.2, height: 0.1 });
    s.addObject(obj);
    expect(useWorkspaceStore.getState().objects["p1"]).toHaveLength(1);

    s.addObjects([createTextObject({ pageId: "p1", x: 0.1, y: 0.1, width: 0.1, height: 0.1 })]);
    expect(useWorkspaceStore.getState().objects["p1"]).toHaveLength(2);

    const firstId = useWorkspaceStore.getState().objects["p1"][0].id;
    useWorkspaceStore.getState().updateObjectById(firstId, { x: 0.9 });
    expect(useWorkspaceStore.getState().objects["p1"][0].x).toBe(0.9);

    useWorkspaceStore.getState().selectObjects([firstId]);
    useWorkspaceStore.getState().updateSelectedObjects({ opacity: 0.3 });
    expect(useWorkspaceStore.getState().objects["p1"][0].opacity).toBe(0.3);

    useWorkspaceStore.getState().duplicateSelectedObjects();
    expect(useWorkspaceStore.getState().objects["p1"]).toHaveLength(3);

    useWorkspaceStore.getState().copySelection();
    useWorkspaceStore.getState().pasteClipboard();
    expect(useWorkspaceStore.getState().objects["p1"].length).toBeGreaterThanOrEqual(4);

    useWorkspaceStore.getState().reorderObject(firstId, "front");
    const ids = useWorkspaceStore.getState().objects["p1"].map((o) => o.id);
    expect(ids.at(-1)).toBe(firstId);
    useWorkspaceStore.getState().reorderObject(firstId, "back");
    expect(useWorkspaceStore.getState().objects["p1"][0].id).toBe(firstId);
    useWorkspaceStore.getState().reorderObject("missing", "front");

    useWorkspaceStore.getState().deleteSelectedObjects();
    useWorkspaceStore.getState().deleteObjectsByIds([]);
    expect(useWorkspaceStore.getState().objects["p1"].length).toBeLessThan(6);

    const beforeUndo = useWorkspaceStore.getState().pages.length;
    useWorkspaceStore.getState().undo();
    useWorkspaceStore.getState().redo();
    expect(useWorkspaceStore.getState().pages.length).toBe(beforeUndo);
    useWorkspaceStore.getState().markExported();
    expect(useWorkspaceStore.getState().edited).toBe(false);

    // empty clipboard / missing page no-ops
    useWorkspaceStore.getState().reset();
    useWorkspaceStore.getState().pasteClipboard();
    useWorkspaceStore.getState().duplicateSelectedObjects();
    useWorkspaceStore.getState().updateSelectedObjects({ x: 1 });
    useWorkspaceStore.getState().undo();
    useWorkspaceStore.getState().redo();
    expect(useWorkspaceStore.getState().pages).toEqual([]);
  });

  it("exposes active page objects and markup factory", () => {
    expect(activePageObjects({ objects: {}, activePageId: undefined })).toEqual([]);
    expect(activePageObjects({ objects: {}, activePageId: "x" })).toEqual([]);
    const obj = createTextObject({ pageId: "x", x: 0, y: 0, width: 1, height: 1 });
    expect(activePageObjects({ objects: { x: [obj] }, activePageId: "x" })).toHaveLength(1);
    const mk = createMarkupForTool("highlight", { pageId: "p", x: 0, y: 0, width: 1, height: 1 }, "#fff", 0.5);
    expect(mk.type).toBe("highlight");
  });
});
