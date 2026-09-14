import type { LayoutBox } from "./content-classifier";
import { toolAsset } from "@/photo-print/assets";

export type LayoutModelKind = "pp-doclayout" | "heuristic-fallback" | "none";

export interface LayoutDetection {
  boxes: LayoutBox[];
  model: LayoutModelKind;
  modelConfidence: number | null;
}

export const PP_DOCLAYOUT_MODEL_PATH = toolAsset("/models/pp-doclayout-s.onnx");
export const PP_DOCLAYOUT_INPUT_SIZE = 480;
export const PP_DOCLAYOUT_SCORE_THRESHOLD = 0.3;

/** Official 23-class label list from PP-DocLayout-S inference.yml, in id order. */
export const PP_DOCLAYOUT_LABELS = [
  "paragraph_title",
  "image",
  "text",
  "number",
  "abstract",
  "content",
  "figure_title",
  "formula",
  "table",
  "table_title",
  "reference",
  "doc_title",
  "footnote",
  "header",
  "algorithm",
  "footer",
  "seal",
  "chart_title",
  "chart",
  "formula_number",
  "header_image",
  "footer_image",
  "aside_text",
] as const;

/** Image-like classes map to IMAGE; everything else (incl. tables) maps to TEXT. */
const IMAGE_LABELS = new Set(["image", "chart", "header_image", "footer_image"]);

export function docLayoutKindForClassId(classId: number): "text" | "image" {
  const label = PP_DOCLAYOUT_LABELS[classId];
  if (label && IMAGE_LABELS.has(label)) return "image";
  return "text";
}

/** Map raw PP-DocLayout labels to text/image buckets. Unknown labels -> text. */
export function mapDocLayoutLabel(label: string): "text" | "image" {
  const normalized = label.trim().toLowerCase();
  if (IMAGE_LABELS.has(normalized)) return "image";
  return "text";
}

interface OrtLike {
  env: { wasm: { wasmPaths: string; numThreads: number }; logLevel: string };
  InferenceSession: {
    create(modelPath: string, options?: Record<string, unknown>): Promise<OrtSession>;
  };
  Tensor: new (type: string, data: Float32Array, dims: readonly number[]) => unknown;
}

type OrtSession = {
  inputNames: string[];
  outputNames: string[];
  run(feeds: Record<string, unknown>): Promise<Record<string, { data: ArrayLike<number>; dims: readonly number[] }>>;
};

let cachedSession: OrtSession | null = null;
let attemptedLoad = false;

/**
 * PP-DocLayout-S via onnxruntime-web. The model asset resolves through
 * toolAsset("/models/pp-doclayout-s.onnx"), i.e. the R2-hosted file under
 * NEXT_PUBLIC_TOOL_ASSET_BASE_URL. There is no local copy; if the hosted
 * file is unreachable the detector falls back (see below).
 * PicoDet/GFL graph: inputs image[1,3,480,480] + scale_factor[1,2],
 * outputs boxes[N,6] as [classId, score, x1, y1, x2, y2] + num_dets.
 * When the asset or runtime is unavailable, callers receive a heuristic
 * fallback so V2 remains usable.
 */
export async function detectLayout(
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
): Promise<LayoutDetection> {
  try {
    const ort = (await import("onnxruntime-web")) as unknown as OrtLike;
    try {
      // The ORT WASM runtime (*.mjs/*.wasm) is not vendored under public/ort/,
      // so resolve it from the jsDelivr CDN pinned to the installed version.
      // A same-origin "/ort/" path returns an HTML 404 page here, which the
      // browser rejects with a strict-MIME error for module scripts.
      ort.env.wasm.wasmPaths = "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.29.0/dist/";
      ort.env.wasm.numThreads = 1;
      // The paddle2onnx export carries unused initializers that ORT prunes
      // with [W:] warnings during session creation. Those warnings are routed
      // through console.error and trip the dev overlay, so keep only real
      // errors. Warnings do not indicate a load failure.
      ort.env.logLevel = "error";
    } catch {
      // env tweak is best-effort
    }
    if (!attemptedLoad) {
      attemptedLoad = true;
      // The paddle2onnx export carries unused initializers that ORT prunes
      // with [W:] notes during session creation. Those notes are emitted
      // from inside the WASM module straight to console.error, which trips
      // the dev overlay even though the load succeeds. Mute that exact
      // pattern for the duration of create(); real failures still throw and
      // are caught below.
      const ortWarning = /\[W:onnxruntime:|\[I:onnxruntime:|CleanUnusedInitializersAndNodeArgs/;
      const originalError = console.error;
      const mutedError = (...args: unknown[]) => {
        if (args.some((arg) => typeof arg === "string" && ortWarning.test(arg))) return;
        originalError(...(args as Parameters<typeof console.error>));
      };
      try {
        console.error = mutedError as typeof console.error;
        cachedSession = await ort.InferenceSession.create(PP_DOCLAYOUT_MODEL_PATH, {
          executionProviders: ["wasm"],
          logSeverityLevel: 3, // error and above; session-level mute for the same notes
        });
      } catch {
        cachedSession = null;
      } finally {
        console.error = originalError;
      }
    }
    if (cachedSession) {
      return runDocLayoutSession(ort, cachedSession, canvas, pageWidth, pageHeight);
    }
  } catch {
    // onnxruntime-web unavailable (SSR/tests) -> fallback below
  }
  return { boxes: [], model: "heuristic-fallback", modelConfidence: null };
}

async function runDocLayoutSession(
  ort: OrtLike,
  session: OrtSession,
  canvas: HTMLCanvasElement,
  pageWidth: number,
  pageHeight: number,
): Promise<LayoutDetection> {
  const size = PP_DOCLAYOUT_INPUT_SIZE;
  const offscreen = document.createElement("canvas");
  offscreen.width = size;
  offscreen.height = size;
  const ctx = offscreen.getContext("2d");
  if (!ctx) return { boxes: [], model: "heuristic-fallback", modelConfidence: null };
  // PicoDet preprocess: stretch to 480x480 (keep_ratio=false), ImageNet normalize.
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(canvas, 0, 0, size, size);
  const imageData = ctx.getImageData(0, 0, size, size);
  const mean = [0.485, 0.456, 0.406];
  const std = [0.229, 0.224, 0.225];
  const input = new Float32Array(1 * 3 * size * size);
  for (let i = 0; i < size * size; i += 1) {
    const r = imageData.data[i * 4] / 255;
    const g = imageData.data[i * 4 + 1] / 255;
    const b = imageData.data[i * 4 + 2] / 255;
    input[i] = (r - mean[0]) / std[0];
    input[size * size + i] = (g - mean[1]) / std[1];
    input[2 * size * size + i] = (b - mean[2]) / std[2];
  }
  const imageTensor = new ort.Tensor("float32", input, [1, 3, size, size]);
  const scaleTensor = new ort.Tensor("float32", new Float32Array([1, 1]), [1, 2]);
  const inputName = session.inputNames.includes("image") ? "image" : session.inputNames[0];
  const scaleName = session.inputNames.includes("scale_factor")
    ? "scale_factor"
    : session.inputNames[1] ?? session.inputNames[0];
  let outputs: Record<string, { data: ArrayLike<number>; dims: readonly number[] }>;
  try {
    outputs = await session.run({ [inputName]: imageTensor, [scaleName]: scaleTensor });
  } catch {
    return { boxes: [], model: "heuristic-fallback", modelConfidence: null };
  }
  // Boxes output is the [N,6] tensor; num output is scalar count.
  let boxesTensor: { data: ArrayLike<number>; dims: readonly number[] } | null = null;
  for (const key of session.outputNames) {
    const candidate = outputs[key];
    if (candidate && candidate.dims.length === 2 && candidate.dims[1] === 6) {
      boxesTensor = candidate;
      break;
    }
  }
  boxesTensor ??= outputs[session.outputNames[0]];
  if (!boxesTensor || boxesTensor.data.length === 0) {
    return { boxes: [], model: "heuristic-fallback", modelConfidence: null };
  }
  const rowSize = 6;
  const rows = Math.floor(boxesTensor.data.length / rowSize);
  const sx = pageWidth / size;
  const sy = pageHeight / size;
  const boxes: LayoutBox[] = [];
  let confSum = 0;
  for (let r = 0; r < Math.min(rows, 100); r += 1) {
    const base = r * rowSize;
    const classId = Math.round(Number(boxesTensor.data[base]));
    const score = Number(boxesTensor.data[base + 1]);
    if (!Number.isFinite(score) || score < PP_DOCLAYOUT_SCORE_THRESHOLD) continue;
    if (!Number.isFinite(classId) || classId < 0 || classId >= PP_DOCLAYOUT_LABELS.length) continue;
    const x1 = Number(boxesTensor.data[base + 2]) * sx;
    const y1 = Number(boxesTensor.data[base + 3]) * sy;
    const x2 = Number(boxesTensor.data[base + 4]) * sx;
    const y2 = Number(boxesTensor.data[base + 5]) * sy;
    if (![x1, y1, x2, y2].every(Number.isFinite) || x2 <= x1 || y2 <= y1) continue;
    const left = Math.max(0, x1);
    const top = Math.max(0, y1);
    const right = Math.min(pageWidth, x2);
    const bottom = Math.min(pageHeight, y2);
    if (right <= left || bottom <= top) continue;
    boxes.push({
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
      kind: docLayoutKindForClassId(classId),
      confidence: Math.max(0, Math.min(1, score)),
    });
    confSum += Math.max(0, Math.min(1, score));
  }
  if (boxes.length === 0) return { boxes: [], model: "heuristic-fallback", modelConfidence: null };
  return { boxes, model: "pp-doclayout", modelConfidence: confSum / boxes.length };
}

export function resetLayoutCacheForTests(): void {
  cachedSession = null;
  attemptedLoad = false;
}
