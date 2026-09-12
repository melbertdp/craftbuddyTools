import { describe, expect, it } from "vitest";
import {
  createImageObject,
  createTextObject,
  duplicateObjects,
  parseEditorObjects,
  pasteObjects,
  removeObjects,
  serializeEditorObjects,
  updateObjects,
} from "@/pdf/core/editor/model";
import type { EditorObject } from "@/pdf/types";

const geometry = { pageId: "page-1", x: 0.5, y: 0.5, width: 0.3, height: 0.1 };

describe("editor model", () => {
  it("creates text objects with defaults and overrides", () => {
    const object = createTextObject(geometry, { text: "Hello", fontSize: 22, bold: true });
    expect(object.type).toBe("text");
    expect(object.text).toBe("Hello");
    expect(object.fontSize).toBe(22);
    expect(object.bold).toBe(true);
    expect(object.id).toMatch(/^obj_/);
  });

  it("updates and removes objects", () => {
    const text = createTextObject(geometry);
    const image = createImageObject(geometry, "data:image/png;base64,AAAA", "png");
    const updated = updateObjects([text, image], [text.id], { opacity: 0.5 });
    expect(updated[0].opacity).toBe(0.5);
    expect(removeObjects(updated, [image.id])).toHaveLength(1);
  });

  it("duplicates objects with new ids and offset", () => {
    const text = createTextObject(geometry);
    const { objects, newIds } = duplicateObjects([text], [text.id], 0.05);
    expect(objects).toHaveLength(2);
    expect(newIds[0]).not.toBe(text.id);
    expect(objects[1].x).toBeCloseTo(0.55, 6);
  });

  it("round-trips serialization", () => {
    const objects: EditorObject[] = [createTextObject(geometry), createImageObject(geometry, "data:image/png;base64,AAAA", "png")];
    const serialized = serializeEditorObjects(objects);
    const parsed = parseEditorObjects(serialized);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe("text");
  });

  it("pastes clipboard onto a target page", () => {
    const text = createTextObject(geometry);
    const { objects, newIds } = pasteObjects([], [text], "page-2");
    expect(objects[0].pageId).toBe("page-2");
    expect(newIds).toHaveLength(1);
  });
});
