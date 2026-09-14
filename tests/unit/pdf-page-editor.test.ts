import { describe, expect, it } from "vitest";
import {
  clonePage,
  createBlankPage,
  createImagePage,
  deletePages,
  duplicatePages,
  extractPageNumbers,
  insertAfterPage,
  insertPagesAt,
  movePageById,
  reorderPage,
  rotatePages,
  rotationDelta,
  selectPageIdsByNumbers,
  setPageRotation,
} from "@/pdf/core/page-engine";
import {
  copyObjects,
  createDrawingObject,
  createImageObject,
  createMarkupObject,
  createShapeObject,
  createTextObject,
  duplicateObjects,
  parseEditorObjects,
  pasteObjects,
  removeObjects,
  serializeEditorObjects,
  updateObject,
  updateObjects,
} from "@/pdf/core/editor/model";
import { History } from "@/pdf/core/editor/history";
import type { EditorObject, PdfPageModel, Rotation } from "@/pdf/types";

const page = (id: string, extra: Partial<PdfPageModel> = {}): PdfPageModel => ({
  id,
  sourceDocumentId: "doc",
  sourcePageIndex: 0,
  rotation: 0,
  width: 600,
  height: 800,
  ...extra,
});

const pages = (n: number) => Array.from({ length: n }, (_, i) => page(`p${i + 1}`));

describe("page engine edges", () => {
  it("clones with a fresh id", () => {
    const c = clonePage(page("a"));
    expect(c.id).not.toBe("a");
    expect(c.sourcePageIndex).toBe(0);
  });

  it("handles invalid reorder indices", () => {
    const p = pages(3);
    expect(reorderPage(p, 5, 0)).toBe(p); // missing moved page returns same ref
    expect(reorderPage(p, 0, 0)).toBe(p);
    const moved = reorderPage(p, 0, 99);
    expect(moved.at(-1)!.id).toBe("p1");
    const neg = reorderPage(p, 2, -5);
    expect(neg[0].id).toBe("p3");
  });

  it("movePageById misses gracefully", () => {
    const p = pages(2);
    expect(movePageById(p, "nope", 0)).toBe(p);
  });

  it("deletePages protects the last page", () => {
    const p = pages(2);
    expect(deletePages(p, []).map((x) => x.id)).toEqual(["p1", "p2"]);
    const all = deletePages(p, ["p1", "p2"]);
    expect(all).toBe(p);
    expect(deletePages(p, ["missing"])).toHaveLength(2);
  });

  it("duplicates insert clones immediately after each original", () => {
    const p = pages(3);
    const next = duplicatePages(p, ["p3", "p1"]);
    expect(next).toHaveLength(5);
    expect(next[0].id).toBe("p1");
    expect(next[1].sourcePageIndex).toBe(0);
    expect(next[1].id).not.toBe("p1");
    expect(next[2].id).toBe("p2");
    expect(next[3].id).toBe("p3");
    expect(next[4].id).not.toBe("p3");
    expect(next[4].sourceDocumentId).toBe("doc");
    expect(duplicatePages(p, [])).toHaveLength(3);
  });

  it("rotates with wraparound and leaves others untouched", () => {
    const p = pages(2);
    const next = rotatePages(p, ["p1"], 270);
    expect(next[0].rotation).toBe(270);
    expect(next[1].rotation).toBe(0);
    expect(rotatePages(next, ["p1"], 90)[0].rotation).toBe(0);
    expect(rotatePages(p, ["missing"], 90)).toEqual(p);
  });

  it("setPageRotation and rotationDelta", () => {
    expect(setPageRotation(page("a"), 90 as Rotation).rotation).toBe(90);
    expect(rotationDelta(90 as Rotation, 180 as Rotation)).toBe(90);
    expect(rotationDelta(270 as Rotation, 0 as Rotation)).toBe(-270);
  });

  it("extract/select by 1-based numbers ignores out-of-range", () => {
    const p = pages(3);
    expect(extractPageNumbers(p, [2, 9])).toHaveLength(1);
    expect(selectPageIdsByNumbers(p, [])).toEqual([]);
    expect(selectPageIdsByNumbers(p, [0, -1])).toEqual([]);
  });

  it("blank/image page defaults and overrides", () => {
    const b = createBlankPage();
    expect(b.width).toBe(595.28);
    expect(b.sourcePageIndex).toBe(-1);
    const custom = createBlankPage({ width: 100, height: 200, rotation: 90 as Rotation, sourceDocumentId: "s" });
    expect(custom).toMatchObject({ width: 100, height: 200, rotation: 90, sourceDocumentId: "s" });
    const img = createImagePage(400, 500, 180 as Rotation);
    expect(img).toMatchObject({ width: 400, height: 500, rotation: 180, sourceDocumentId: "image" });
  });

  it("insertion clamps and appends on missing reference", () => {
    const p = pages(2);
    const blank = createBlankPage();
    expect(insertPagesAt(p, [blank], -5)[0].id).toBe(blank.id);
    expect(insertPagesAt(p, [blank], 99).at(-1)!.id).toBe(blank.id);
    expect(insertPagesAt(p, [], 1)).toHaveLength(2);
    expect(insertAfterPage(p, "missing", [blank]).at(-1)!.id).toBe(blank.id);
    expect(insertAfterPage(p, "p1", [blank])[1].id).toBe(blank.id);
  });
});

describe("editor model", () => {
  const geo = { pageId: "p1", x: 0.5, y: 0.5, width: 0.2, height: 0.1 };

  it("creates every object kind with defaults and overrides", () => {
    const text = createTextObject(geo);
    expect(text.type).toBe("text");
    expect(text.text).toBe("Text");
    const bold = createTextObject(geo, { text: "Hi", bold: true });
    expect(bold.bold).toBe(true);

    const img = createImageObject(geo, "data:image/png;base64,x", "png");
    expect(img.format).toBe("png");

    const drawing = createDrawingObject("p1");
    expect(drawing.points).toEqual([]);
    const rect = createShapeObject(geo, "rectangle");
    expect(rect.stroke).toBeDefined();
    const ellipse = createShapeObject(geo, "ellipse", { fill: "red" });
    expect(ellipse.fill).toBe("red");
    const hl = createMarkupObject(geo, "highlight");
    expect(hl.opacity).toBe(0.85);
    const ul = createMarkupObject(geo, "underline", { color: "red" });
    expect(ul.color).toBe("red");
  });

  it("updates single, multiple, and missing ids", () => {
    const objs = [createTextObject(geo, { text: "a" }), createTextObject(geo, { text: "b" })];
    const [first, second] = objs;
    const next = updateObject(objs, first.id, { x: 0.9 });
    expect(next[0].x).toBe(0.9);
    expect(next[1].x).toBe(0.5);
    expect(updateObject(objs, "missing", { x: 1 })).toEqual(objs);

    const multi = updateObjects(objs, [first.id, second.id, "missing"], { opacity: 0.5 });
    expect(multi.every((o) => o.opacity === 0.5)).toBe(true);
    const empty = updateObjects(objs, [], { opacity: 0.1 });
    expect(empty).toEqual(objs);
  });

  it("removes and copies by selection", () => {
    const objs = [createTextObject(geo), createTextObject(geo)];
    expect(removeObjects(objs, [objs[0].id])).toHaveLength(1);
    expect(removeObjects(objs, [])).toHaveLength(2);
    expect(copyObjects(objs, [objs[1].id])).toHaveLength(1);
    expect(copyObjects(objs, [])).toEqual([]);
  });

  it("duplicates with offset and fresh ids", () => {
    const objs = [createTextObject(geo)];
    const { objects, newIds } = duplicateObjects(objs, [objs[0].id]);
    expect(objects).toHaveLength(2);
    expect(newIds).toHaveLength(1);
    expect(objects[1].x).toBeCloseTo(objs[0].x + 0.02);
    expect(duplicateObjects(objs, []).newIds).toEqual([]);
    expect(duplicateObjects(objs, ["missing"]).objects).toHaveLength(1);
  });

  it("pastes onto a target page with offset", () => {
    const objs = [createTextObject({ ...geo, pageId: "p1" })];
    const clipboard: EditorObject[] = [{ ...objs[0] }];
    const { objects, newIds } = pasteObjects([], clipboard, "p2");
    expect(objects).toHaveLength(1);
    expect(objects[0].pageId).toBe("p2");
    expect(newIds).toHaveLength(1);
    expect(pasteObjects(objs, [], "p1").objects).toHaveLength(1);
  });

  it("serializes and parses, tolerating invalid payloads", () => {
    const objs = [createTextObject(geo)];
    const s = serializeEditorObjects(objs);
    expect(parseEditorObjects(s)).toHaveLength(1);
    expect(parseEditorObjects(JSON.stringify({ version: 1, objects: "nope" }))).toEqual([]);
    expect(parseEditorObjects(JSON.stringify({ version: 1 }))).toEqual([]);
    expect(parseEditorObjects(JSON.stringify({ objects: [] }))).toEqual([]);
    expect(() => parseEditorObjects("not json")).toThrow();
  });
});

describe("History", () => {
  it("ignores identity commits", () => {
    const h = new History({ n: 1 });
    const present = h.current;
    h.commit(present);
    expect(h.canUndo).toBe(false);
  });

  it("undo/redo at boundaries return present", () => {
    const h = new History(1);
    expect(h.undo()).toBe(1);
    expect(h.redo()).toBe(1);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it("commits, undoes, redoes and invalidates redo", () => {
    const h = new History(1);
    h.commit(2);
    h.commit(3);
    expect(h.undo()).toBe(2);
    expect(h.canRedo).toBe(true);
    expect(h.redo()).toBe(3);
    h.undo();
    h.commit(99);
    expect(h.canRedo).toBe(false);
    expect(h.current).toBe(99);
  });

  it("resets and evicts beyond limit", () => {
    const h = new History(0, 3);
    h.commit(1);
    h.commit(2);
    h.commit(3);
    h.commit(4);
    expect(h.snapshot().past).toHaveLength(3);
    h.reset(10);
    expect(h.current).toBe(10);
    expect(h.canUndo).toBe(false);
    expect(h.canRedo).toBe(false);
  });

  it("snapshot copies arrays", () => {
    const h = new History(1);
    h.commit(2);
    const s = h.snapshot();
    expect(s.present).toBe(2);
    expect(s.past).toEqual([1]);
    expect(s.future).toEqual([]);
  });
});
