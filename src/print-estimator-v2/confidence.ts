export interface ConfidenceInputs {
  colorBoundaryDistance: number;
  contentBoundaryDistance: number;
  modelConfidence: number | null;
  detectedCoverage: number;
  conflictingSignals: boolean;
}

/**
 * Engine confidence 0..1. Never copies raw ONNX detection confidence directly.
 *
 * Distance from the decision thresholds drives the score: a page sitting
 * mid-tier scores near 1.0 before modifiers, one sitting on a threshold
 * near 0.5. Model strength and detected coverage only shave points off,
 * so clear-cut pages are not dragged into review by modest detector scores.
 */
export function scoreConfidence(input: ConfidenceInputs): number {
  const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
  const modelPart = input.modelConfidence == null ? 0.6 : clamp01(input.modelConfidence);
  const boundaryPart = clamp01((input.colorBoundaryDistance + input.contentBoundaryDistance) / 2);
  const coveragePart = clamp01(input.detectedCoverage * 2);
  let score = 0.5 + 0.5 * boundaryPart;
  score -= 0.15 * (1 - modelPart);
  score -= 0.1 * (1 - coveragePart);
  if (input.conflictingSignals) score -= 0.18;
  if (input.detectedCoverage < 0.02) score -= 0.1;
  return Math.max(0.05, Math.min(0.99, score));
}
