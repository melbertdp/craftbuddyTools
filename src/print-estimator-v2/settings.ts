import type { V2Rates, V2Thresholds } from "./types";

export const V2_DEFAULT_THRESHOLDS: V2Thresholds = {
  backgroundLevel: 245,
  colorChromaThreshold: 18,
  colorSaturationThreshold: 0.12,
  bwMaxColorCoverage: 0.02,
  lightMaxColorCoverage: 0.15,
  semiMaxColorCoverage: 0.45,
  textMaxImageShare: 0.2,
  imageMinImageShare: 0.7,
  reviewConfidenceThreshold: 0.7,
  scannedImageCoverage: 0.8,
  scannedMaxColorCoverage: 0.02,
  scannedMaxInkCoverage: 0.35,
};

export const V2_DEFAULT_RATES: V2Rates = {
  bw: 3,
  light: 4,
  semi: 6,
  full: 10,
};

const RATES_KEY = "cb-print-v2-rates";
const THRESHOLDS_KEY = "cb-print-v2-thresholds";

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
}

export function loadV2Rates(): V2Rates {
  if (typeof window === "undefined") return V2_DEFAULT_RATES;
  try {
    return safeParse<V2Rates>(window.localStorage.getItem(RATES_KEY), V2_DEFAULT_RATES);
  } catch {
    return V2_DEFAULT_RATES;
  }
}

export function saveV2Rates(rates: V2Rates): void {
  try {
    window.localStorage.setItem(RATES_KEY, JSON.stringify(rates));
  } catch {
    // storage unavailable; estimator still works in-memory
  }
}

export function loadV2Thresholds(): V2Thresholds {
  if (typeof window === "undefined") return V2_DEFAULT_THRESHOLDS;
  try {
    return safeParse<V2Thresholds>(window.localStorage.getItem(THRESHOLDS_KEY), V2_DEFAULT_THRESHOLDS);
  } catch {
    return V2_DEFAULT_THRESHOLDS;
  }
}

export function saveV2Thresholds(thresholds: V2Thresholds): void {
  try {
    window.localStorage.setItem(THRESHOLDS_KEY, JSON.stringify(thresholds));
  } catch {
    // ignore
  }
}

export const V2_ANALYZER_VERSION = "v2.0.0";
export const V2_RENDER_DPI = 120;
