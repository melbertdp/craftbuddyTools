import type { Keypoint } from "./autofit";
import { toolAsset } from "./assets";

const POSE_MODEL_URL = toolAsset("/models/movenet-lightning.onnx");
const DEFAULT_INPUT_SIZE = 192;
const DEFAULT_CHANNELS = 4;
const KEYPOINT_COUNT = 17;

export type PoseRuntime = {
  session: any;
  ort: any;
  inputName: string;
  outputName: string;
  size: number;
  channels: number;
};

let runtimePromise: Promise<PoseRuntime> | null = null;

/**
 * Loads the MoveNet SinglePose Lightning session once. Tensor names, input
 * size, and channel count are read from the model so the loader keeps working
 * if the vendored file is swapped for another export.
 */
export async function getPoseRuntime(): Promise<PoseRuntime> {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = toolAsset("/ort/");
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(POSE_MODEL_URL, {
        executionProviders: ["wasm"],
        graphOptimizationLevel: "all",
      });
      const inputName: string = session.inputNames[0];
      const outputName: string = session.outputNames[0];
      let size = DEFAULT_INPUT_SIZE;
      let channels = DEFAULT_CHANNELS;
      const meta: { dimensions?: unknown } | undefined = (
        session as unknown as {
          inputMetadata?: Record<string, { dimensions?: unknown }>;
        }
      ).inputMetadata?.[inputName];
      const dims = Array.isArray(meta?.dimensions)
        ? (meta!.dimensions as unknown[]).filter(
            (value): value is number => typeof value === "number" && value > 0,
          )
        : [];
      if (dims.length >= 3) {
        size = dims[dims.length - 3];
        channels = dims[dims.length - 1];
      }
      return { session, ort, inputName, outputName, size, channels };
    })().catch((error) => {
      runtimePromise = null;
      throw error;
    });
  }
  return runtimePromise;
}

export function isPoseRuntimeLoaded() {
  return runtimePromise !== null;
}

function toChannels(
  data: Uint8ClampedArray,
  size: number,
  channels: number,
): Uint8Array {
  if (channels === 4) return new Uint8Array(data);
  const pixels = size * size;
  const output = new Uint8Array(pixels * channels);
  for (let index = 0; index < pixels; index += 1) {
    const source = index * 4;
    const target = index * channels;
    output[target] = data[source];
    output[target + 1] = data[source + 1];
    output[target + 2] = data[source + 2];
  }
  return output;
}

/**
 * Runs pose detection on a source canvas and returns keypoints in the source's
 * pixel coordinates. The image is letterboxed into the model's square input,
 * so landmarks are de-letterboxed back to source space.
 */
export async function detectPose(
  source: HTMLCanvasElement,
): Promise<Keypoint[] | null> {
  if (source.width < 1 || source.height < 1) return null;
  const { session, ort, inputName, outputName, size, channels } =
    await getPoseRuntime();

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.fillStyle = "#000000";
  context.fillRect(0, 0, size, size);

  const scale = Math.min(size / source.width, size / source.height);
  const drawWidth = Math.max(1, Math.round(source.width * scale));
  const drawHeight = Math.max(1, Math.round(source.height * scale));
  const offsetX = (size - drawWidth) / 2;
  const offsetY = (size - drawHeight) / 2;
  context.drawImage(source, offsetX, offsetY, drawWidth, drawHeight);

  const imageData = context.getImageData(0, 0, size, size);
  const input = toChannels(imageData.data, size, channels);
  const tensor = new ort.Tensor("uint8", input, [1, size, size, channels]);
  const output = await session.run({ [inputName]: tensor });
  const result = output[outputName];
  const data = result.data as Float32Array;
  const dims: number[] = result.dims ?? [];
  const count = dims.length >= 3 ? dims[dims.length - 2] : KEYPOINT_COUNT;
  if (!data || data.length < count * 3) return null;

  const keypoints: Keypoint[] = [];
  for (let index = 0; index < count; index += 1) {
    // MoveNet emits [y, x, score] normalized to the square input.
    const y = data[index * 3 + 0];
    const x = data[index * 3 + 1];
    const score = data[index * 3 + 2];
    keypoints.push({
      x: (x * size - offsetX) / scale,
      y: (y * size - offsetY) / scale,
      score,
    });
  }
  return keypoints;
}
