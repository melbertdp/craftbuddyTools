import { describe, expect, it } from "vitest";
import {
  COST_ACCENTS,
  createLabor,
  createMaterialRecord,
  createMaterials,
  createOtherCosts,
  formatPeso,
  MATERIAL_UNITS,
  materialCostPerUnit,
  METHODS,
  nextId,
  numberValue,
  roundPercent,
} from "@/components/cost-estimator/shared";

describe("numberValue", () => {
  it("parses numeric strings and coerces invalid to 0", () => {
    expect(numberValue("42")).toBe(42);
    expect(numberValue("3.5")).toBe(3.5);
    expect(numberValue("-4")).toBe(-4);
    expect(numberValue("")).toBe(0);
    expect(numberValue("   ")).toBe(0);
    expect(numberValue("abc")).toBe(0);
    expect(numberValue("NaN")).toBe(0);
    // "Infinity" coerces via Number() then || 0 keeps Infinity (truthy)
    expect(numberValue("Infinity")).toBe(Infinity);
  });
});

describe("formatPeso", () => {
  it("formats PHP currency", () => {
    expect(formatPeso(0)).toBe("₱0.00");
    expect(formatPeso(1234.5)).toBe("₱1,234.50");
    expect(formatPeso(-50)).toMatch(/-?₱?50/);
    expect(formatPeso(1000000)).toContain(",");
  });
});

describe("roundPercent", () => {
  it("rounds finite values and guards non-finite", () => {
    expect(roundPercent(12.6)).toBe(13);
    expect(roundPercent(12.4)).toBe(12);
    expect(roundPercent(-2.5)).toBe(-2);
    expect(roundPercent(NaN)).toBe(0);
    expect(roundPercent(Infinity)).toBe(0);
    expect(roundPercent(-Infinity)).toBe(0);
  });
});

describe("materialCostPerUnit", () => {
  it("divides total by units", () => {
    expect(materialCostPerUnit({ id: "1", name: "x", totalCost: "100", unit: "pc", units: "4" })).toBe(25);
    expect(materialCostPerUnit({ id: "1", name: "x", totalCost: "100", unit: "pc", units: "0" })).toBe(0);
    expect(materialCostPerUnit({ id: "1", name: "x", totalCost: "abc", unit: "pc", units: "4" })).toBe(0);
    expect(materialCostPerUnit({ id: "1", name: "x", totalCost: "100", unit: "pc", units: "-2" })).toBe(0);
    expect(materialCostPerUnit({ id: "1", name: "x", totalCost: "10", unit: "pc", units: "0.5" })).toBe(20);
  });
});

describe("factories and ids", () => {
  it("creates material records with uuid or fallback", () => {
    const r = createMaterialRecord();
    expect(r.name).toBe("");
    expect(r.unit).toBe("Unit");
    expect(typeof r.id).toBe("string");
    expect(r.id.length).toBeGreaterThan(0);
  });

  it("uses fallback id when crypto.randomUUID is unavailable", () => {
    const orig = (globalThis as { crypto?: unknown }).crypto;
    Object.defineProperty(globalThis, "crypto", { value: undefined, configurable: true });
    const r = createMaterialRecord();
    expect(r.id.startsWith("m-")).toBe(true);
    Object.defineProperty(globalThis, "crypto", { value: orig, configurable: true });
  });

  it("nextId is monotonic", () => {
    const a = nextId();
    const b = nextId();
    expect(b).toBeGreaterThan(a);
  });

  it("creates row arrays including edge counts", () => {
    expect(createMaterials(2)).toHaveLength(2);
    expect(createLabor(1)[0]).toMatchObject({ description: "", minutes: "" });
    expect(createOtherCosts(1)[0]).toMatchObject({ type: "", quantity: "" });
    expect(createMaterials(0)).toEqual([]);
    // Array.from with fractional length floors via ToLength
    expect(createMaterials(2.7)).toHaveLength(2);
    const many = createMaterials(5);
    expect(new Set(many.map((m) => m.id)).size).toBe(5);
  });

  it("exposes stable constants", () => {
    expect(MATERIAL_UNITS).toContain("pc");
    expect(METHODS.map((m) => m.value).sort()).toEqual(["amount", "margin", "price"]);
    expect(COST_ACCENTS.materials.solid).toMatch(/^#/);
    expect(COST_ACCENTS.labor.soft).toMatch(/^#/);
    expect(COST_ACCENTS.other.ink).toMatch(/^#/);
  });
});
