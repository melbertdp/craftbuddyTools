import type { CalculationMethod } from "@/lib/calculator";

export const numberValue = (value: string) => Number(value) || 0;

export const formatPeso = (value: number) =>
  `₱${value.toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const roundPercent = (value: number) =>
  Number.isFinite(value) ? Math.round(value) : 0;

export type MaterialRow = {
  id: number;
  name: string;
  quantity: string;
  unit: string;
  unitCost: string;
};

export type MaterialRecord = {
  id: string;
  name: string;
  totalCost: string;
  unit: string;
  units: string;
};

export const MATERIAL_UNITS = [
  "Unit",
  "pc",
  "sheet",
  "roll",
  "pack",
  "bottle",
  "box",
  "yard",
];

export const materialCostPerUnit = (material: MaterialRecord) => {
  const units = numberValue(material.units);
  return units > 0 ? numberValue(material.totalCost) / units : 0;
};

export function createMaterialRecord(): MaterialRecord {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `m-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    name: "",
    totalCost: "",
    unit: "Unit",
    units: "",
  };
}

export type LaborRow = {
  id: number;
  description: string;
  minutes: string;
  ratePerHour: string;
};

export type OtherRow = {
  id: number;
  type: string;
  quantity: string;
  cost: string;
};

let rowId = 0;
export const nextId = () => ++rowId;

export function createMaterials(count: number): MaterialRow[] {
  return Array.from({ length: count }, () => ({
    id: nextId(),
    name: "",
    quantity: "",
    unit: "",
    unitCost: "",
  }));
}

export function createLabor(count: number): LaborRow[] {
  return Array.from({ length: count }, () => ({
    id: nextId(),
    description: "",
    minutes: "",
    ratePerHour: "",
  }));
}

export function createOtherCosts(count: number): OtherRow[] {
  return Array.from({ length: count }, () => ({
    id: nextId(),
    type: "",
    quantity: "",
    cost: "",
  }));
}

export const METHODS: { value: CalculationMethod; label: string }[] = [
  { value: "margin", label: "Margin" },
  { value: "amount", label: "Profit amount" },
  { value: "price", label: "Selling price" },
];

export type CostAccent = { solid: string; soft: string; ink: string };

export const COST_ACCENTS: {
  materials: CostAccent;
  labor: CostAccent;
  other: CostAccent;
} = {
  materials: { solid: "#8FA688", soft: "#EDF2E9", ink: "#3C5A3A" },
  labor: { solid: "#E7A98C", soft: "#F4DFD3", ink: "#8A4E38" },
  other: { solid: "#D9C27E", soft: "#EFE6CF", ink: "#7A6420" },
};
