import { createMaterialRecord, type MaterialRecord } from "./shared";

const STORAGE_KEY = "cb-materials";

function isMaterialRecord(value: unknown): value is MaterialRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.id === "string" && typeof record.name === "string";
}

export function loadMaterials(): MaterialRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isMaterialRecord).map((record) => ({
      ...createMaterialRecord(),
      ...record,
    }));
  } catch {
    return [];
  }
}

export function saveMaterials(materials: MaterialRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(materials));
  } catch {
    // Ignore write failures (e.g. storage disabled or full).
  }
}
