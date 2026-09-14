import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadMaterials, saveMaterials } from "@/components/cost-estimator/material-library";
import type { MaterialRecord } from "@/components/cost-estimator/shared";

const record = (overrides: Partial<MaterialRecord> = {}): MaterialRecord => ({
  id: "m1",
  name: "Paper",
  totalCost: "100",
  unit: "sheet",
  units: "10",
  ...overrides,
});

describe("material library persistence", () => {
  let store: Record<string, string>;

  beforeEach(() => {
    store = {};
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => {
          store[k] = v;
        },
        removeItem: (k: string) => {
          delete store[k];
        },
      },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns [] with no window (SSR)", async () => {
    vi.stubGlobal("window", undefined as never);
    // dynamic re-evaluation: module checks typeof window at call time
    expect(loadMaterials()).toEqual([]);
    expect(() => saveMaterials([record()])).not.toThrow();
    vi.unstubAllGlobals();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
      },
    });
  });

  it("returns [] for missing key and non-array payloads", () => {
    expect(loadMaterials()).toEqual([]);
    store["cb-materials"] = JSON.stringify({ not: "array" });
    expect(loadMaterials()).toEqual([]);
    store["cb-materials"] = JSON.stringify(null);
    expect(loadMaterials()).toEqual([]);
  });

  it("loads valid records merged with defaults", () => {
    store["cb-materials"] = JSON.stringify([record({ name: "Ink" })]);
    const out = loadMaterials();
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe("Ink");
    expect(out[0].unit).toBe("sheet");
  });

  it("filters invalid members", () => {
    store["cb-materials"] = JSON.stringify([
      record(),
      { id: 123, name: "bad" },
      null,
      "string",
      { id: "x" },
    ]);
    expect(loadMaterials()).toHaveLength(1);
  });

  it("returns [] on malformed JSON and storage exceptions", () => {
    store["cb-materials"] = "{broken";
    expect(loadMaterials()).toEqual([]);
    const win = window as unknown as { localStorage: Storage };
    vi.spyOn(win.localStorage, "getItem").mockImplementation(() => {
      throw new Error("denied");
    });
    expect(loadMaterials()).toEqual([]);
  });

  it("saves with the correct key and tolerates write failures", () => {
    saveMaterials([record()]);
    expect(JSON.parse(store["cb-materials"])).toHaveLength(1);
    const win = window as unknown as { localStorage: Storage };
    vi.spyOn(win.localStorage, "setItem").mockImplementation(() => {
      throw new Error("full");
    });
    expect(() => saveMaterials([record()])).not.toThrow();
  });
});
