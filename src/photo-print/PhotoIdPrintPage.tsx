"use client";

import * as React from "react";
import {
  Download,
  Eraser,
  FlipHorizontal,
  ImagePlus,
  ImageUp,
  Loader2,
  Move,
  Paintbrush,
  Printer,
  Redo2,
  RotateCcw,
  RotateCw,
  Shirt,
  Sparkles,
  Trash2,
  Undo2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  Cropper,
  CropperArea,
  CropperDescription,
  CropperImage,
} from "@/components/ui/image-crop";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  PAPER_SIZES,
  PHOTO_SIZES,
  fitCropArea,
  orientedPaper,
  packPhotoItems,
  type SheetCell,
} from "./layout";
import { SHIRT_PRESETS } from "./shirts";
import { computeAutoFit, rotateKeypoints } from "./autofit";
import {
  DEFAULT_GARMENT_META,
  deriveGarmentMeta,
  isTransparent,
  type GarmentMeta,
} from "./garments";
import { detectPose } from "./pose";
import { toolAsset } from "./assets";

const DPI = 300;
// Use the full paper by default. Margins and gaps are optional printer-safe
// spacing, and enabling them can reduce the number of photos that fit.
const DEFAULT_MARGIN_MM = 0;
const DEFAULT_GAP_MM = 0;
const BACKGROUNDS = [
  ["White", "#ffffff"],
  ["Light Blue", "#cfe6f4"],
  ["Light Green", "#d0ebd2"],
  ["Navy Blue", "#0a2463"],
  ["Red", "#c62828"],
  ["Yellow", "#ffe082"],
  ["Gray", "#bdbdbd"],
] as const;

type CropArea = { x: number; y: number; width: number; height: number };
type ImageSource = HTMLImageElement | HTMLCanvasElement;

const MATTING_SIZE = 512;
let modelPromise: Promise<{ session: any; ort: any }> | null = null;
async function getBackgroundModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = toolAsset("/ort/");
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create(
        toolAsset("/models/hivision_modnet.onnx"),
        { executionProviders: ["wasm"], graphOptimizationLevel: "all" },
      );
      return { session, ort };
    })();
  }
  return modelPromise;
}

function resizeToMattingCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = MATTING_SIZE;
  canvas.height = MATTING_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, MATTING_SIZE, MATTING_SIZE);
  return canvas;
}

function mattingTensor(canvas: HTMLCanvasElement, ort: any) {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  const plane = canvas.width * canvas.height;
  const input = new Float32Array(plane * 3);
  for (let index = 0; index < plane; index += 1) {
    const pixel = index * 4;
    input[index] = data[pixel] / 127.5 - 1;
    input[plane + index] = data[pixel + 1] / 127.5 - 1;
    input[plane * 2 + index] = data[pixel + 2] / 127.5 - 1;
  }
  return new ort.Tensor("float32", input, [1, 3, canvas.height, canvas.width]);
}

function fillMatteHoles(
  alpha: Uint8ClampedArray,
  width: number,
  height: number,
) {
  const solid = new Uint8Array(width * height);
  for (let index = 0; index < solid.length; index += 1)
    solid[index] = alpha[index] >= 127 ? 1 : 0;
  const reachable = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const visit = (index: number) => {
    if (solid[index] === 0 && reachable[index] === 0) {
      reachable[index] = 1;
      queue[tail++] = index;
    }
  };
  for (let x = 0; x < width; x += 1) {
    visit(x);
    visit((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    visit(y * width);
    visit(y * width + width - 1);
  }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    const y = Math.floor(index / width);
    if (x > 0) visit(index - 1);
    if (x < width - 1) visit(index + 1);
    if (y > 0) visit(index - width);
    if (y < height - 1) visit(index + width);
  }
  for (let index = 0; index < solid.length; index += 1) {
    if (solid[index] === 0 && reachable[index] === 0) alpha[index] = 255;
  }
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not read that image."));
    image.src = url;
  });
}

function canvasFrom(
  source: ImageSource,
  width = source.width,
  height = source.height,
) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function cropToCanvas(image: HTMLImageElement, area: CropArea) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.drawImage(
    image,
    area.x,
    area.y,
    area.width,
    area.height,
    0,
    0,
    canvas.width,
    canvas.height,
  );
  return canvas;
}

function rotateCanvas(source: HTMLCanvasElement, degrees: number) {
  const normalized = ((degrees % 360) + 360) % 360;
  if (normalized === 0) return source;
  const sideways = normalized === 90 || normalized === 270;
  const canvas = document.createElement("canvas");
  canvas.width = sideways ? source.height : source.width;
  canvas.height = sideways ? source.width : source.height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((degrees * Math.PI) / 180);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function flipCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.translate(canvas.width, 0);
  context.scale(-1, 1);
  context.drawImage(source, 0, 0);
  return canvas;
}

function adjustedCanvas(
  source: HTMLCanvasElement,
  brightness: number,
  contrast: number,
  saturation: number,
  background: string,
) {
  const canvas = canvasFrom(source);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  context.drawImage(source, 0, 0);
  return canvas;
}

/**
 * Hides the parts of the person the user brushed away. The original photo is
 * never modified: the mask is a separate layer where opaque means "keep" and
 * transparent means "hide" (revealing the background colour underneath).
 */
function applyPersonMask(
  source: HTMLCanvasElement,
  mask: HTMLCanvasElement | null,
  feather: number,
) {
  if (!mask) return source;
  const canvas = canvasFrom(source);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  context.globalCompositeOperation = "destination-in";
  if (feather > 0) context.filter = `blur(${feather}px)`;
  context.drawImage(mask, 0, 0, canvas.width, canvas.height);
  context.filter = "none";
  context.globalCompositeOperation = "source-over";
  return canvas;
}

type ShirtTransform = {
  /** Garment collar point in normalized canvas coordinates (0..1). */
  anchorX: number;
  anchorY: number;
  scale: number;
  /** Garment rotation in degrees. */
  rotation: number;
};

const DEFAULT_SHIRT_TRANSFORM: ShirtTransform = {
  anchorX: 0.5,
  anchorY: 0.45,
  scale: 1,
  rotation: 0,
};

/**
 * Draws the garment so its collar anchor lands on the transform's anchor
 * point, then rotates about that anchor. Normalized coordinates keep the
 * alignment preview and the print-resolution export identical.
 */
function drawShirt(
  context: CanvasRenderingContext2D,
  shirt: HTMLImageElement,
  width: number,
  height: number,
  transform: ShirtTransform,
  meta: GarmentMeta | null,
) {
  const ratio = shirt.naturalWidth
    ? shirt.naturalHeight / shirt.naturalWidth
    : 1;
  const drawWidth = width * transform.scale;
  const drawHeight = drawWidth * ratio;
  const anchor = meta?.anchor ?? { x: 0.5, y: 0 };
  const anchorPxX = anchor.x * drawWidth;
  const anchorPxY = anchor.y * drawHeight;
  context.save();
  context.translate(transform.anchorX * width, transform.anchorY * height);
  if (transform.rotation) {
    context.rotate((transform.rotation * Math.PI) / 180);
  }
  context.drawImage(shirt, -anchorPxX, -anchorPxY, drawWidth, drawHeight);
  context.restore();
}

function addShirtOverlay(
  source: HTMLCanvasElement,
  shirt: HTMLImageElement | null,
  transform: ShirtTransform,
  meta: GarmentMeta | null,
) {
  if (!shirt) return source;
  const canvas = canvasFrom(source);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  drawShirt(context, shirt, canvas.width, canvas.height, transform, meta);
  return canvas;
}

function drawCover(
  context: CanvasRenderingContext2D,
  image: CanvasImageSource & { width: number; height: number },
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(
    image,
    x + (width - drawWidth) / 2,
    y + (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
}

function maxCopies(
  widthMm: number,
  heightMm: number,
  photoWidthMm: number,
  photoHeightMm: number,
  marginMm: number,
  gapMm: number,
) {
  const columns = Math.max(
    0,
    Math.floor((widthMm - marginMm * 2 + gapMm) / (photoWidthMm + gapMm)),
  );
  const rows = Math.max(
    0,
    Math.floor((heightMm - marginMm * 2 + gapMm) / (photoHeightMm + gapMm)),
  );
  return columns * rows;
}

function cellsForCopies(
  widthMm: number,
  heightMm: number,
  copies: number,
  photoWidthMm: number,
  photoHeightMm: number,
  photoTypeId: string,
  marginMm: number,
  gapMm: number,
): SheetCell[] {
  const columns = Math.max(
    1,
    Math.floor((widthMm - marginMm * 2 + gapMm) / (photoWidthMm + gapMm)),
  );
  const startX = marginMm;
  const startY = marginMm;
  return Array.from({ length: copies }, (_, index) => ({
    id: `${photoTypeId}-${index}`,
    photoTypeId,
    xMm: startX + (index % columns) * (photoWidthMm + gapMm),
    yMm: startY + Math.floor(index / columns) * (photoHeightMm + gapMm),
    widthMm: photoWidthMm,
    heightMm: photoHeightMm,
  }));
}

function drawTrimMarks(
  context: CanvasRenderingContext2D,
  cell: SheetCell,
  scale: number,
  markMm = 3,
) {
  const x = cell.xMm * scale;
  const y = cell.yMm * scale;
  const width = cell.widthMm * scale;
  const height = cell.heightMm * scale;
  const mark = markMm * scale;
  context.save();
  context.strokeStyle = "#000000";
  context.lineWidth = Math.max(1, Math.round(scale * 0.2));
  context.beginPath();
  context.moveTo(x - mark, y);
  context.lineTo(x, y);
  context.moveTo(x, y - mark);
  context.lineTo(x, y);
  context.moveTo(x + width, y);
  context.lineTo(x + width + mark, y);
  context.moveTo(x + width, y - mark);
  context.lineTo(x + width, y);
  context.moveTo(x - mark, y + height);
  context.lineTo(x, y + height);
  context.moveTo(x, y + height);
  context.lineTo(x, y + height + mark);
  context.moveTo(x + width, y + height);
  context.lineTo(x + width + mark, y + height);
  context.moveTo(x + width, y + height);
  context.lineTo(x + width, y + height + mark);
  context.stroke();
  context.restore();
}

export default function PhotoIdPrintPage() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const lastCropAreaRef = React.useRef<CropArea | null>(null);
  const processedCropRef = React.useRef<HTMLCanvasElement | null>(null);
  const processedCropSourceRef = React.useRef<HTMLCanvasElement | null>(null);
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = React.useState<HTMLCanvasElement | null>(null);
  const [processedCrop, setProcessedCrop] =
    React.useState<HTMLCanvasElement | null>(null);
  const [bgRemove, setBgRemove] = React.useState(false);
  const [bgLoading, setBgLoading] = React.useState(false);
  const [bgStatus, setBgStatus] = React.useState("");
  const [bgColor, setBgColor] = React.useState("#ffffff");
  const [paperId, setPaperId] = React.useState("4r");
  const [photoSizeId, setPhotoSizeId] = React.useState("standard");
  const [mixSizes, setMixSizes] = React.useState(false);
  const [mixQuantities, setMixQuantities] = React.useState<
    Record<string, number>
  >({ standard: 4 });
  const [landscape, setLandscape] = React.useState(false);
  const [marginMm, setMarginMm] = React.useState(DEFAULT_MARGIN_MM);
  const [gapMm, setGapMm] = React.useState(DEFAULT_GAP_MM);
  const [cutMarks, setCutMarks] = React.useState(true);
  const [copies, setCopies] = React.useState(4);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [brightness, setBrightness] = React.useState(100);
  const [contrast, setContrast] = React.useState(100);
  const [saturation, setSaturation] = React.useState(100);
  const [shirtId, setShirtId] = React.useState("none");
  const [shirtImage, setShirtImage] = React.useState<HTMLImageElement | null>(
    null,
  );
  const [shirtTransform, setShirtTransform] = React.useState<ShirtTransform>(
    DEFAULT_SHIRT_TRANSFORM,
  );
  const [garmentMeta, setGarmentMeta] = React.useState<GarmentMeta | null>(
    null,
  );
  const [autoFitBusy, setAutoFitBusy] = React.useState(false);
  const [autoFitStatus, setAutoFitStatus] = React.useState("");
  const [availableShirts, setAvailableShirts] = React.useState(SHIRT_PRESETS);
  const [editMode, setEditMode] = React.useState<"move" | "erase" | "restore">(
    "move",
  );
  const [brushSize, setBrushSize] = React.useState(26);
  const [feather, setFeather] = React.useState(1.5);
  const [maskVersion, setMaskVersion] = React.useState(0);
  const [shirtOpen, setShirtOpen] = React.useState(false);
  const [editorReady, setEditorReady] = React.useState(0);
  const editorPreviewRef = React.useRef<HTMLCanvasElement | null>(null);
  const setEditorCanvas = React.useCallback((node: HTMLCanvasElement | null) => {
    editorPreviewRef.current = node;
    if (node) setEditorReady((value) => value + 1);
  }, []);
  const maskRef = React.useRef<HTMLCanvasElement | null>(null);
  const maskHistoryRef = React.useRef<string[]>([]);
  const maskFrameRef = React.useRef<number | null>(null);
  const maskStrokeRef = React.useRef<{ x: number; y: number } | null>(null);
  const shirtDragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);
  const [history, setHistory] = React.useState<string[]>([]);
  const [future, setFuture] = React.useState<string[]>([]);
  const [activeStep, setActiveStep] = React.useState(1);
  const [dragOver, setDragOver] = React.useState(false);
  const [cropArea, setCropArea] = React.useState<CropArea | null>(null);

  const basePaper =
    PAPER_SIZES.find((paper) => paper.id === paperId) ?? PAPER_SIZES[1];
  const paper = orientedPaper(basePaper, landscape ? "landscape" : "portrait");
  const photoSize =
    PHOTO_SIZES.find((size) => size.id === photoSizeId) ?? PHOTO_SIZES[0];
  const photoWidthMm = photoSize.widthMm;
  const photoHeightMm = photoSize.heightMm;
  const maximum = maxCopies(
    paper.widthMm,
    paper.heightMm,
    photoWidthMm,
    photoHeightMm,
    marginMm,
    gapMm,
  );
  const cropSize = mixSizes
    ? (PHOTO_SIZES.find((size) => (mixQuantities[size.id] ?? 0) > 0) ??
      photoSize)
    : photoSize;
  const cells = mixSizes
    ? packPhotoItems(
        paper.widthMm,
        paper.heightMm,
        PHOTO_SIZES.filter((size) => (mixQuantities[size.id] ?? 0) > 0).map(
          (size) => ({
            photoTypeId: size.id,
            widthMm: size.widthMm,
            heightMm: size.heightMm,
            quantity: mixQuantities[size.id] ?? 0,
          }),
        ),
        marginMm,
        gapMm,
      )
    : cellsForCopies(
        paper.widthMm,
        paper.heightMm,
        Math.min(copies, maximum),
        photoWidthMm,
        photoHeightMm,
        photoSize.id,
        marginMm,
        gapMm,
      );
  const totalPhotos = cells.length;
  const cuttingMarksEnabled = cutMarks && (gapMm > 0 || marginMm > 0);
  const selectedShirt = availableShirts.find((item) => item.id === shirtId);
  const shirtLabel = selectedShirt
    ? `${selectedShirt.group} · ${selectedShirt.label}`
    : "No shirt";

  React.useEffect(() => {
    const area = lastCropAreaRef.current;
    if (!image || !area) return;
    const next = fitCropArea(
      area,
      cropSize.widthMm / cropSize.heightMm,
      image.naturalWidth,
      image.naturalHeight,
    );
    lastCropAreaRef.current = next;
    setCropArea(next);
    setCrop(cropToCanvas(image, next));
  }, [image, cropSize.widthMm, cropSize.heightMm]);

  React.useEffect(() => {
    setCopies((value) => Math.min(Math.max(1, value), Math.max(1, maximum)));
  }, [maximum]);

  React.useEffect(
    () => () => {
      if (imageSrc?.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
    },
    [imageSrc],
  );

  React.useEffect(() => {
    if (!bgRemove || !crop) {
      processedCropRef.current = null;
      processedCropSourceRef.current = null;
      setProcessedCrop(null);
      setBgStatus("");
      setBgLoading(false);
      return;
    }
    if (processedCropRef.current && processedCropSourceRef.current === crop) {
      setBgLoading(false);
      return;
    }
    if (activeStep === 1) {
      processedCropRef.current = null;
      processedCropSourceRef.current = null;
      setProcessedCrop(null);
      setBgStatus("");
      setBgLoading(false);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      if (cancelled) return;
      setBgLoading(true);
      setBgStatus("Loading local background model…");
      void (async () => {
        try {
          const { session, ort } = await getBackgroundModel();
          if (cancelled) return;
          setBgStatus("Removing background…");
          const source = crop;
          const inference = resizeToMattingCanvas(source);
          const inputName = session.inputNames[0];
          const output = await session.run({
            [inputName]: mattingTensor(inference, ort),
          });
          const matte = output[session.outputNames[0]];
          const maskWidth =
            Number(matte.dims[matte.dims.length - 1]) || inference.width;
          const maskHeight =
            Number(matte.dims[matte.dims.length - 2]) || inference.height;
          const maskCanvas = document.createElement("canvas");
          maskCanvas.width = maskWidth;
          maskCanvas.height = maskHeight;
          const maskContext = maskCanvas.getContext("2d");
          if (!maskContext)
            throw new Error("Canvas is not available in this browser.");
          const maskPixels = maskContext.createImageData(maskWidth, maskHeight);
          const matteData = matte.data as Float32Array;
          for (let index = 0; index < maskWidth * maskHeight; index += 1) {
            const value =
              matteData[index] <= 1 ? matteData[index] * 255 : matteData[index];
            const alpha = Math.max(0, Math.min(255, value));
            const pixel = index * 4;
            maskPixels.data[pixel] = alpha;
            maskPixels.data[pixel + 1] = alpha;
            maskPixels.data[pixel + 2] = alpha;
            maskPixels.data[pixel + 3] = alpha;
          }
          maskContext.putImageData(maskPixels, 0, 0);
          const result = canvasFrom(source);
          const context = result.getContext("2d");
          if (!context)
            throw new Error("Canvas is not available in this browser.");
          const pixels = context.getImageData(
            0,
            0,
            result.width,
            result.height,
          );
          const scaledMask = document.createElement("canvas");
          scaledMask.width = result.width;
          scaledMask.height = result.height;
          const scaledContext = scaledMask.getContext("2d");
          if (!scaledContext)
            throw new Error("Canvas is not available in this browser.");
          scaledContext.imageSmoothingEnabled = true;
          scaledContext.imageSmoothingQuality = "high";
          scaledContext.drawImage(
            maskCanvas,
            0,
            0,
            result.width,
            result.height,
          );
          const scaledPixels = scaledContext.getImageData(
            0,
            0,
            result.width,
            result.height,
          );
          const alpha = new Uint8ClampedArray(result.width * result.height);
          for (let index = 0; index < alpha.length; index += 1)
            alpha[index] = scaledPixels.data[index * 4 + 3];
          fillMatteHoles(alpha, result.width, result.height);
          for (let index = 0; index < alpha.length; index += 1)
            pixels.data[index * 4 + 3] = alpha[index];
          context.putImageData(pixels, 0, 0);
          if (!cancelled) {
            processedCropRef.current = result;
            processedCropSourceRef.current = crop;
            setProcessedCrop(result);
            setBgStatus("Background removed. Color changes are instant.");
          }
        } catch (reason: unknown) {
          if (!cancelled) {
            processedCropRef.current = null;
            processedCropSourceRef.current = null;
            setProcessedCrop(null);
            setBgStatus(
              reason instanceof Error
                ? `Error: ${reason.message}`
                : "Background removal failed.",
            );
          }
        } finally {
          if (!cancelled) setBgLoading(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [activeStep, bgRemove, crop]);

  React.useEffect(() => {
    setShirtTransform(DEFAULT_SHIRT_TRANSFORM);
    setAutoFitStatus("");
    const preset = SHIRT_PRESETS.find((item) => item.id === shirtId);
    if (!preset) {
      setShirtImage(null);
      setGarmentMeta(null);
      return;
    }
    let cancelled = false;
    void loadImage(preset.src)
      .then((image) => {
        if (cancelled) return;
        setShirtImage(image);
        setGarmentMeta(deriveGarmentMeta(image));
      })
      .catch(() => {
        if (cancelled) return;
        setShirtImage(null);
        setGarmentMeta(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shirtId]);

  React.useEffect(() => {
    setEditMode(shirtId === "none" ? "erase" : "move");
  }, [shirtId]);

  // Hide any asset that is missing or has no transparency, so the selector
  // only ever offers garments that can actually be composited.
  React.useEffect(() => {
    let cancelled = false;
    void Promise.all(
      SHIRT_PRESETS.map(async (preset) => {
        try {
          const image = await loadImage(preset.src);
          return isTransparent(image) ? preset : null;
        } catch {
          return null;
        }
      }),
    ).then((list) => {
      if (cancelled) return;
      setAvailableShirts(
        list.filter(
          (preset): preset is (typeof SHIRT_PRESETS)[number] => preset !== null,
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the alignment proportional, but reset when the crop changes.
  React.useEffect(() => {
    setShirtTransform(DEFAULT_SHIRT_TRANSFORM);
  }, [crop]);

  // The person mask lives in the rotated crop space. Opaque = keep the
  // original pixels, transparent = hide them so the background shows through.
  React.useEffect(() => {
    if (!crop) {
      maskRef.current = null;
      maskHistoryRef.current = [];
      setMaskVersion((value) => value + 1);
      return;
    }
    const source = rotateCanvas(processedCrop ?? crop, rotation);
    const maxMaskDim = 1600;
    const maskScale = Math.min(
      1,
      maxMaskDim / Math.max(source.width, source.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.width * maskScale));
    canvas.height = Math.max(1, Math.round(source.height * maskScale));
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    maskRef.current = canvas;
    maskHistoryRef.current = [];
    setMaskVersion((value) => value + 1);
  }, [crop, processedCrop, rotation]);

  const baseCanvas = React.useMemo(() => {
    if (!crop) return null;
    const source = processedCrop ?? crop;
    const rotated = rotateCanvas(source, rotation);
    const masked = applyPersonMask(rotated, maskRef.current, feather);
    return adjustedCanvas(masked, brightness, contrast, saturation, bgColor);
  }, [
    bgColor,
    brightness,
    contrast,
    crop,
    feather,
    maskVersion,
    processedCrop,
    rotation,
    saturation,
  ]);

  const finalCanvas = React.useMemo(
    () =>
      baseCanvas
        ? addShirtOverlay(baseCanvas, shirtImage, shirtTransform, garmentMeta)
        : null,
    [baseCanvas, garmentMeta, shirtImage, shirtTransform],
  );

  function scheduleMaskRender() {
    if (maskFrameRef.current != null) return;
    maskFrameRef.current = window.requestAnimationFrame(() => {
      maskFrameRef.current = null;
      setMaskVersion((value) => value + 1);
    });
  }

  function pushMaskHistory() {
    const mask = maskRef.current;
    if (!mask) return;
    maskHistoryRef.current = [
      ...maskHistoryRef.current.slice(-11),
      mask.toDataURL("image/png"),
    ];
  }

  function brushMask(
    from: { x: number; y: number } | null,
    to: { x: number; y: number },
  ) {
    const mask = maskRef.current;
    if (!mask) return;
    const context = mask.getContext("2d");
    if (!context) return;
    const displayWidth = editorPreviewRef.current?.width || mask.width;
    const lineWidth = Math.max(1, (brushSize / displayWidth) * mask.width);
    const erasing = editMode === "erase";
    context.globalCompositeOperation = erasing
      ? "destination-out"
      : "source-over";
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#ffffff";
    context.lineWidth = lineWidth;
    context.lineCap = "round";
    context.lineJoin = "round";
    const x = to.x * mask.width;
    const y = to.y * mask.height;
    if (from) {
      context.beginPath();
      context.moveTo(from.x * mask.width, from.y * mask.height);
      context.lineTo(x, y);
      context.stroke();
    } else {
      context.beginPath();
      context.arc(x, y, lineWidth / 2, 0, Math.PI * 2);
      context.fill();
    }
    context.globalCompositeOperation = "source-over";
    scheduleMaskRender();
  }

  async function undoMask() {
    const previous = maskHistoryRef.current.at(-1);
    const mask = maskRef.current;
    if (!previous || !mask) return;
    maskHistoryRef.current = maskHistoryRef.current.slice(0, -1);
    try {
      const image = await loadImage(previous);
      const context = mask.getContext("2d");
      if (!context) return;
      context.globalCompositeOperation = "source-over";
      context.clearRect(0, 0, mask.width, mask.height);
      context.drawImage(image, 0, 0, mask.width, mask.height);
      setMaskVersion((value) => value + 1);
    } catch {
      // Ignore a failed restore and keep the current mask.
    }
  }

  function resetMask() {
    const mask = maskRef.current;
    if (!mask) return;
    pushMaskHistory();
    const context = mask.getContext("2d");
    if (!context) return;
    context.globalCompositeOperation = "source-over";
    context.clearRect(0, 0, mask.width, mask.height);
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, mask.width, mask.height);
    setMaskVersion((value) => value + 1);
  }

  React.useEffect(() => {
    const canvas = editorPreviewRef.current;
    if (!canvas || !finalCanvas) return;
    const ratio = finalCanvas.width / finalCanvas.height;
    const maxWidth = 460;
    const maxHeight = 560;
    let width = maxWidth;
    let height = Math.round(maxWidth / ratio);
    if (height > maxHeight) {
      height = maxHeight;
      width = Math.round(maxHeight * ratio);
    }
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, width, height);
    context.drawImage(finalCanvas, 0, 0, width, height);
  }, [editorReady, finalCanvas, shirtOpen]);

  function editorPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: rect.width ? (event.clientX - rect.left) / rect.width : 0,
      y: rect.height ? (event.clientY - rect.top) / rect.height : 0,
    };
  }

  function handleEditorPointerDown(
    event: React.PointerEvent<HTMLCanvasElement>,
  ) {
    const canvas = event.currentTarget;
    if (editMode === "move") {
      if (!shirtImage) return;
      canvas.setPointerCapture(event.pointerId);
      shirtDragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: shirtTransform.anchorX,
        originY: shirtTransform.anchorY,
      };
      return;
    }
    if (!maskRef.current) return;
    canvas.setPointerCapture(event.pointerId);
    pushMaskHistory();
    const point = editorPoint(event);
    maskStrokeRef.current = point;
    brushMask(null, point);
  }

  function handleEditorPointerMove(
    event: React.PointerEvent<HTMLCanvasElement>,
  ) {
    if (editMode === "move") {
      const drag = shirtDragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const canvas = event.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width ? canvas.width / rect.width : 1;
      const scaleY = rect.height ? canvas.height / rect.height : 1;
      const deltaX =
        ((event.clientX - drag.startX) * scaleX) / (canvas.width || 1);
      const deltaY =
        ((event.clientY - drag.startY) * scaleY) / (canvas.height || 1);
      setShirtTransform((value) => ({
        ...value,
        anchorX: drag.originX + deltaX,
        anchorY: drag.originY + deltaY,
      }));
      return;
    }
    const stroke = maskStrokeRef.current;
    if (!stroke) return;
    const point = editorPoint(event);
    brushMask(stroke, point);
    maskStrokeRef.current = point;
  }

  function handleEditorPointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    if (shirtDragRef.current?.pointerId === event.pointerId) {
      shirtDragRef.current = null;
    }
    if (maskStrokeRef.current) maskStrokeRef.current = null;
    const canvas = event.currentTarget;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  async function runAutoFit() {
    if (!crop || !shirtImage || autoFitBusy) return;
    setAutoFitBusy(true);
    setAutoFitStatus("Detecting pose…");
    try {
      const keypoints = await detectPose(crop);
      if (!keypoints) {
        setAutoFitStatus("No person detected. Align the shirt manually.");
        return;
      }
      const mapped = rotateKeypoints(
        keypoints,
        crop.width,
        crop.height,
        rotation,
      );
      const rotated = rotation ? rotateCanvas(crop, rotation) : crop;
      const fit = computeAutoFit({
        keypoints: mapped,
        width: rotated.width,
        height: rotated.height,
        garment: garmentMeta ?? DEFAULT_GARMENT_META,
      });
      if (!fit) {
        setAutoFitStatus("Shoulders not detected. Align the shirt manually.");
        return;
      }
      setShirtTransform(fit);
      setAutoFitStatus(
        fit.approximate
          ? "Approximate fit from the head - fine-tune as needed."
          : "Auto fit applied. Fine-tune as needed.",
      );
    } catch (error) {
      setAutoFitStatus(
        error instanceof Error
          ? `Auto fit failed: ${error.message}`
          : "Auto fit failed.",
      );
    } finally {
      setAutoFitBusy(false);
    }
  }

  const finalUrl = React.useMemo(() => {
    if (!finalCanvas) return null;
    const maxDim = 720;
    const scale = Math.min(
      1,
      maxDim / Math.max(finalCanvas.width, finalCanvas.height),
    );
    const preview = document.createElement("canvas");
    preview.width = Math.max(1, Math.round(finalCanvas.width * scale));
    preview.height = Math.max(1, Math.round(finalCanvas.height * scale));
    const context = preview.getContext("2d");
    if (!context) return null;
    context.drawImage(finalCanvas, 0, 0, preview.width, preview.height);
    return preview.toDataURL("image/jpeg", 0.85);
  }, [finalCanvas]);

  function rememberCurrent() {
    if (imageSrc) {
      setHistory((items) => [...items.slice(-14), imageSrc]);
      setFuture([]);
    }
  }

  function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result);
      setImageSrc(value);
      setFileName(file.name);
      void loadImage(value).then(setImage);
      lastCropAreaRef.current = null;
      setCrop(null);
      setProcessedCrop(null);
      setBgRemove(false);
      setShirtId("none");
      setShirtImage(null);
      setShirtTransform(DEFAULT_SHIRT_TRANSFORM);
      setZoom(1);
      setHistory([]);
      setFuture([]);
    };
    reader.readAsDataURL(file);
  }

  function removePhoto() {
    setImageSrc(null);
    setFileName(null);
    setImage(null);
    lastCropAreaRef.current = null;
    processedCropRef.current = null;
    processedCropSourceRef.current = null;
    setCrop(null);
    setCropArea(null);
    setProcessedCrop(null);
    setBgRemove(false);
    setShirtId("none");
    setShirtImage(null);
    setShirtTransform(DEFAULT_SHIRT_TRANSFORM);
    setBgStatus("");
    setHistory([]);
    setFuture([]);
    setZoom(1);
    setRotation(0);
    if (fileRef.current) fileRef.current.value = "";
  }

  function changeImage(
    transform: (source: HTMLCanvasElement) => HTMLCanvasElement,
  ) {
    if (!imageSrc) return;
    rememberCurrent();
    void loadImage(imageSrc).then((loaded) => {
      const next = transform(canvasFrom(loaded)).toDataURL("image/jpeg", 0.92);
      setImageSrc(next);
      void loadImage(next).then(setImage);
      lastCropAreaRef.current = null;
      setCrop(null);
      setProcessedCrop(null);
    });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous || !imageSrc) return;
    setFuture((items) => [...items, imageSrc]);
    setHistory((items) => items.slice(0, -1));
    setImageSrc(previous);
    void loadImage(previous).then(setImage);
    lastCropAreaRef.current = null;
    setCrop(null);
    setProcessedCrop(null);
  }

  function redo() {
    const next = future.at(-1);
    if (!next || !imageSrc) return;
    setHistory((items) => [...items, imageSrc]);
    setFuture((items) => items.slice(0, -1));
    setImageSrc(next);
    void loadImage(next).then(setImage);
    lastCropAreaRef.current = null;
    setCrop(null);
    setProcessedCrop(null);
  }

  const handleCropChange = React.useCallback(
    (area: CropArea | null) => {
      if (!area || !image) return;
      const previous = lastCropAreaRef.current;
      if (
        previous &&
        previous.x === area.x &&
        previous.y === area.y &&
        previous.width === area.width &&
        previous.height === area.height
      )
        return;
      lastCropAreaRef.current = area;
      setCropArea(area);
      setCrop(cropToCanvas(image, area));
    },
    [image],
  );

  function downloadPng() {
    if (!finalCanvas) return;
    const scale = DPI / 25.4;
    const sheet = document.createElement("canvas");
    sheet.width = Math.round(paper.widthMm * scale);
    sheet.height = Math.round(paper.heightMm * scale);
    const context = sheet.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sheet.width, sheet.height);
    cells.forEach((cell) => {
      if (cuttingMarksEnabled) drawTrimMarks(context, cell, scale);
      drawCover(
        context,
        finalCanvas,
        cell.xMm * scale,
        cell.yMm * scale,
        cell.widthMm * scale,
        cell.heightMm * scale,
      );
    });
    const link = document.createElement("a");
    link.download = `${mixSizes ? "mixed" : photoSize.id}_${totalPhotos}x.png`;
    link.href = sheet.toDataURL("image/png");
    link.click();
  }

  async function downloadPdf() {
    if (!finalCanvas) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({
      unit: "mm",
      format: [paper.widthMm, paper.heightMm],
      orientation: paper.widthMm > paper.heightMm ? "landscape" : "portrait",
    });
    if (cuttingMarksEnabled) {
      pdf.setDrawColor(0);
      pdf.setLineWidth(0.2);
      const mark = 3;
      cells.forEach((cell) => {
        const x = cell.xMm,
          y = cell.yMm,
          w = cell.widthMm,
          h = cell.heightMm;
        pdf.line(x - mark, y, x, y);
        pdf.line(x, y - mark, x, y);
        pdf.line(x + w, y, x + w + mark, y);
        pdf.line(x + w, y - mark, x + w, y);
        pdf.line(x - mark, y + h, x, y + h);
        pdf.line(x, y + h, x, y + h + mark);
        pdf.line(x + w, y + h, x + w + mark, y + h);
        pdf.line(x + w, y + h, x + w, y + h + mark);
      });
    }
    cells.forEach((cell) =>
      pdf.addImage(
        finalCanvas.toDataURL("image/png"),
        "PNG",
        cell.xMm,
        cell.yMm,
        cell.widthMm,
        cell.heightMm,
      ),
    );
    pdf.save(`${mixSizes ? "mixed" : photoSize.id}_${totalPhotos}x.pdf`);
  }

  async function printPreview() {
    if (!finalCanvas) return;
    const data = document.createElement("canvas");
    data.width = Math.round((paper.widthMm / 25.4) * DPI);
    data.height = Math.round((paper.heightMm / 25.4) * DPI);
    const context = data.getContext("2d");
    if (!context) return;
    context.fillStyle = "#fff";
    context.fillRect(0, 0, data.width, data.height);
    const scale = DPI / 25.4;
    if (cuttingMarksEnabled) cells.forEach((cell) => drawTrimMarks(context, cell, scale));
    cells.forEach((cell) => {
      drawCover(
        context,
        finalCanvas,
        cell.xMm * scale,
        cell.yMm * scale,
        cell.widthMm * scale,
        cell.heightMm * scale,
      );
    });
    // A blob URL prints far more reliably than a multi-megabyte data URL,
    // which Chrome can render as a blank/grey box in the print preview.
    const blob = await new Promise<Blob | null>((resolve) =>
      data.toBlob((value) => resolve(value), "image/png"),
    );
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const popup = window.open("", "_blank", "width=900,height=1000");
    if (!popup) {
      URL.revokeObjectURL(url);
      return;
    }
    const width = paper.widthMm;
    const height = paper.heightMm;
    popup.document.write(
      `<!doctype html><html><head><meta charset="utf-8"><title>Print Preview</title><style>
        @page{size:${width}mm ${height}mm;margin:0}
        *{box-sizing:border-box}
        html,body{margin:0;padding:0;background:#525659;font-family:system-ui}
        .bar{padding:14px 20px;background:#fff;display:flex;justify-content:space-between;align-items:center}
        .bar button{padding:6px 14px;cursor:pointer}
        .tip{padding:12px 20px;background:#fff8e1;font-size:13px}
        .sheet{display:flex;justify-content:center;padding:30px}
        .sheet img{display:block;width:${width}mm;height:${height}mm;background:#fff;
          -webkit-print-color-adjust:exact;print-color-adjust:exact}
        @media print{
          html,body{width:${width}mm;height:${height}mm;margin:0;padding:0;background:#fff;overflow:hidden}
          .bar,.tip{display:none!important}
          .sheet{position:fixed;inset:0;display:block;width:${width}mm;height:${height}mm;padding:0;margin:0;overflow:hidden}
          .sheet img{width:${width}mm;height:${height}mm}
        }
      </style></head><body>
        <div class="bar"><b>Print Preview</b><button onclick="window.print()">Print</button></div>
        <div class="tip"><b>Tip:</b> Use 100% scale / Actual size and turn off headers and footers for a borderless sheet.</div>
        <div class="sheet"><img id="sheet" src="${url}" alt="Print sheet"></div>
      </body></html>`,
    );
    popup.document.close();
    const image = popup.document.getElementById(
      "sheet",
    ) as HTMLImageElement | null;
    if (image) {
      const focus = () => {
        popup.focus();
        void image.decode?.().catch(() => {});
      };
      if (image.complete) focus();
      else image.addEventListener("load", focus);
    }
    popup.addEventListener("beforeunload", () => URL.revokeObjectURL(url));
  }

  return (
    <main className="mx-auto w-full max-w-[1400px] px-4 py-8 text-ink md:px-7">
      <header className="mb-6">
        <p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">
          Creative tools / passport studio
        </p>
        <h1 className="mt-2 font-heading text-4xl font-extrabold tracking-[-.055em]">
          Photo Print Maker
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Create print-ready passport and ID photos locally in your browser.
        </p>
      </header>

      <div className="mb-6 grid gap-4 md:grid-cols-2">
        {[
          ["Edit & Layout", "Crop, adjust and arrange your photo"],
          ["Background & Print", "Choose background and print settings"],
        ].map(([title, subtitle], index) => {
          const isActive = activeStep === index + 1;
          return (
            <button
              key={title}
              type="button"
              onClick={() => setActiveStep(index + 1)}
              className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                isActive ? "border-line bg-paper" : "border-line/70 bg-muted/50"
              }`}
            >
              <span
                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold text-white ${
                  isActive ? "bg-primary" : "bg-muted-foreground/40"
                }`}
              >
                {index + 1}
              </span>
              <span className="min-w-0">
                <b className="block text-sm">{title}</b>
                <small className="block text-xs text-muted-foreground">
                  {subtitle}
                </small>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)_320px]">
        {/* LEFT: source photo */}
        <div className="space-y-5">
          <section className="space-y-4 rounded-lg border border-line bg-paper p-4">
            <h2 className="text-sm font-bold">1. Upload Photo</h2>
            <input
              ref={fileRef}
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            {imageSrc ? (
              <>
                <div className="flex items-center gap-3">
                  <img
                    src={imageSrc}
                    alt="Uploaded photo"
                    className="h-16 w-16 shrink-0 rounded-md border border-line object-cover"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {fileName ?? "photo.jpg"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {image
                        ? `${image.naturalWidth} × ${image.naturalHeight} px`
                        : "Photo loaded"}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => fileRef.current?.click()}
                  >
                    <ImageUp className="mr-1 h-4 w-4" />
                    Replace
                  </Button>
                  <Button variant="outline" size="sm" onClick={removePhoto}>
                    <Trash2 className="mr-1 h-4 w-4" />
                    Remove
                  </Button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      changeImage((source) => rotateCanvas(source, -90))
                    }
                  >
                    <RotateCcw className="mr-1 h-4 w-4" />
                    Left
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      changeImage((source) => rotateCanvas(source, 90))
                    }
                  >
                    <RotateCw className="mr-1 h-4 w-4" />
                    Right
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => changeImage(flipCanvas)}
                  >
                    <FlipHorizontal className="mr-1 h-4 w-4" />
                    Flip
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!history.length}
                    onClick={undo}
                  >
                    <Undo2 className="mr-1 h-4 w-4" />
                    Undo
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!future.length}
                    onClick={redo}
                  >
                    <Redo2 className="mr-1 h-4 w-4" />
                    Redo
                  </Button>
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(event) => {
                  event.preventDefault();
                  setDragOver(false);
                  handleFile(event.dataTransfer.files?.[0]);
                }}
                className={`flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-5 text-center ${
                  dragOver ? "border-primary bg-primary/10" : "border-line"
                }`}
              >
                <ImagePlus className="text-muted-foreground" />
                <b>Click or drop photo</b>
              </button>
            )}
          </section>

          {imageSrc && (
            <section className="space-y-3 rounded-lg border border-line bg-paper p-4">
              <h2 className="text-sm font-bold">2. Crop & Adjust</h2>
              <Cropper
                className="h-56"
                image={imageSrc}
                aspectRatio={cropSize.widthMm / cropSize.heightMm}
                zoom={zoom}
                minZoom={1}
                maxZoom={3}
                onZoomChange={setZoom}
                onCropChange={handleCropChange}
              >
                <CropperDescription>
                  Drag the image to position the face and use the crop area to
                  frame the passport photo.
                </CropperDescription>
                <CropperImage />
                <CropperArea />
                <div className="pointer-events-none absolute inset-[33%] border border-white/30" />
              </Cropper>
              <label className="flex items-center gap-3 text-xs">
                <span className="w-20">Zoom</span>
                <Slider
                  value={[zoom]}
                  min={1}
                  max={3}
                  step={0.05}
                  onValueChange={(value) => setZoom(value[0])}
                  aria-label="Zoom"
                />
                <b className="min-w-10 text-right">{Math.round(zoom * 100)}%</b>
              </label>
              {cropArea && (
                <p className="text-[11px] text-muted-foreground">
                  Crop ready at {Math.round(cropArea.width)} ×{" "}
                  {Math.round(cropArea.height)} source pixels
                </p>
              )}
              {[
                ["Brightness", brightness, setBrightness, 50, 150],
                ["Contrast", contrast, setContrast, 50, 150],
                ["Saturation", saturation, setSaturation, 0, 200],
              ].map(([label, value, setter, min, max]) => (
                <label
                  key={label as string}
                  className="flex items-center gap-3 text-xs"
                >
                  <span className="w-20">{label as string}</span>
                  <Slider
                    value={[value as number]}
                    min={min as number}
                    max={max as number}
                    step={1}
                    onValueChange={(next) =>
                      (setter as React.Dispatch<React.SetStateAction<number>>)(
                        next[0],
                      )
                    }
                    aria-label={label as string}
                  />
                  <b className="min-w-10 text-right">{value as number}%</b>
                </label>
              ))}
            </section>
          )}
        </div>

        {/* CENTER: preview */}
        <section className="rounded-lg border border-line bg-[#f4f6f9] p-6">
          <p className="text-xs text-muted-foreground">
            {totalPhotos} photos · {basePaper.label} ({paper.widthMm} ×{" "}
            {paper.heightMm} mm)
          </p>
          <p className="mb-4 mt-2 text-center text-sm font-bold">
            Full print sheet ({basePaper.label})
          </p>
          <div className="overflow-auto rounded bg-[#e5e7eb] p-3 shadow-sm">
            <div
              className="relative mx-auto bg-white"
              style={{
                width: `${paper.widthMm}mm`,
                height: `${paper.heightMm}mm`,
              }}
            >
              {cells.map((cell) => (
                <React.Fragment key={cell.id}>
                  <div
                    className="absolute z-10 overflow-hidden"
                    style={{
                      left: `${cell.xMm}mm`,
                      top: `${cell.yMm}mm`,
                      width: `${cell.widthMm}mm`,
                      height: `${cell.heightMm}mm`,
                    }}
                  >
                    {finalUrl && (
                      <img
                        src={finalUrl}
                        alt=""
                        className="h-full w-full object-cover"
                        style={{
                          objectFit: "cover",
                          objectPosition: "center",
                        }}
                      />
                    )}
                  </div>
                  {cuttingMarksEnabled && (
                    <div
                      className="pointer-events-none absolute z-0"
                      style={{
                        left: `${cell.xMm}mm`,
                        top: `${cell.yMm}mm`,
                        width: `${cell.widthMm}mm`,
                        height: `${cell.heightMm}mm`,
                      }}
                    >
                      <span
                        className="absolute bg-black"
                        style={{
                          left: "-3mm",
                          top: 0,
                          width: "3mm",
                          height: "0.2mm",
                        }}
                      />
                      <span
                        className="absolute bg-black"
                        style={{
                          left: 0,
                          top: "-3mm",
                          width: "0.2mm",
                          height: "3mm",
                        }}
                      />
                      <span
                        className="absolute bg-black"
                        style={{
                          right: "-3mm",
                          top: 0,
                          width: "3mm",
                          height: "0.2mm",
                        }}
                      />
                      <span
                        className="absolute bg-black"
                        style={{
                          right: 0,
                          top: "-3mm",
                          width: "0.2mm",
                          height: "3mm",
                        }}
                      />
                      <span
                        className="absolute bg-black"
                        style={{
                          left: "-3mm",
                          bottom: 0,
                          width: "3mm",
                          height: "0.2mm",
                        }}
                      />
                      <span
                        className="absolute bg-black"
                        style={{
                          left: 0,
                          bottom: "-3mm",
                          width: "0.2mm",
                          height: "3mm",
                        }}
                      />
                      <span
                        className="absolute bg-black"
                        style={{
                          right: "-3mm",
                          bottom: 0,
                          width: "3mm",
                          height: "0.2mm",
                        }}
                      />
                      <span
                        className="absolute bg-black"
                        style={{
                          right: 0,
                          bottom: "-3mm",
                          width: "0.2mm",
                          height: "3mm",
                        }}
                      />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
          <p className="mt-4 text-center text-[11px] text-muted-foreground">
            {totalPhotos} photos · drag position is controlled by the crop tool
          </p>
        </section>

        {/* RIGHT: settings */}
        <div className="space-y-5">
          {activeStep === 1 && (
            <section className="space-y-4 rounded-lg border border-line bg-paper p-4">
              <h2 className="text-sm font-bold">4. Photo Size & Paper</h2>
              <label className="flex items-start gap-3 rounded-md border border-line bg-background p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={mixSizes}
                  onChange={(event) => setMixSizes(event.target.checked)}
                />
                <span>
                  <b>Mix photo sizes</b>
                  <small className="block text-xs text-muted-foreground">
                    Fill one sheet with different ID photo sizes
                  </small>
                </span>
              </label>
              {mixSizes ? (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Quantities</p>
                  {PHOTO_SIZES.map((size) => (
                    <div
                      key={size.id}
                      className="flex items-center justify-between rounded border border-line px-3 py-2 text-xs"
                    >
                      <span>
                        {size.label}
                        <small className="ml-2 text-muted-foreground">
                          {size.widthMm} × {size.heightMm} mm
                        </small>
                      </span>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setMixQuantities((quantities) => ({
                              ...quantities,
                              [size.id]: Math.max(
                                0,
                                (quantities[size.id] ?? 0) - 1,
                              ),
                            }))
                          }
                        >
                          −
                        </Button>
                        <b className="min-w-6 text-center">
                          {mixQuantities[size.id] ?? 0}
                        </b>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            setMixQuantities((quantities) => ({
                              ...quantities,
                              [size.id]: Math.min(
                                99,
                                (quantities[size.id] ?? 0) + 1,
                              ),
                            }))
                          }
                        >
                          +
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs font-semibold">Photo size</p>
                  <div className="grid grid-cols-2 gap-2">
                    {PHOTO_SIZES.map((size) => (
                      <button
                        key={size.id}
                        type="button"
                        onClick={() => setPhotoSizeId(size.id)}
                        className={`rounded-md border px-3 py-2 text-left text-xs ${
                          photoSizeId === size.id
                            ? "border-primary bg-primary/10"
                            : "border-line"
                        }`}
                      >
                        <span className="font-medium">{size.label}</span>
                        <small className="block text-muted-foreground">
                          {size.widthMm} × {size.heightMm} mm
                        </small>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant={!landscape ? "secondary" : "outline"}
                  onClick={() => setLandscape(false)}
                >
                  Portrait
                </Button>
                <Button
                  size="sm"
                  variant={landscape ? "secondary" : "outline"}
                  onClick={() => setLandscape(true)}
                >
                  Landscape
                </Button>
              </div>
              <div className="space-y-2">
                {PAPER_SIZES.filter((paperOption) =>
                  ["4r", "5r", "a4", "letter"].includes(paperOption.id),
                ).map((paperOption) => (
                  <button
                    key={paperOption.id}
                    type="button"
                    onClick={() => setPaperId(paperOption.id)}
                    className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-xs ${
                      paperId === paperOption.id
                        ? "border-primary bg-primary/10"
                        : "border-line"
                    }`}
                  >
                    <span>
                      {paperOption.label}
                      <small className="ml-2 text-muted-foreground">
                        {paperOption.widthMm} × {paperOption.heightMm} mm
                      </small>
                    </span>
                    <b>
                      {maxCopies(
                        orientedPaper(
                          paperOption,
                          landscape ? "landscape" : "portrait",
                        ).widthMm,
                        orientedPaper(
                          paperOption,
                          landscape ? "landscape" : "portrait",
                        ).heightMm,
                        photoWidthMm,
                        photoHeightMm,
                        marginMm,
                        gapMm,
                      )}{" "}
                      max
                    </b>
                  </button>
                ))}
              </div>
              {!mixSizes && (
                <>
                  <div className="flex items-center justify-center gap-4 py-1">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCopies((value) => Math.max(1, value - 1))
                      }
                    >
                      −
                    </Button>
                    <strong className="min-w-10 text-center text-3xl text-primary">
                      {copies}
                    </strong>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() =>
                        setCopies((value) => Math.min(maximum, value + 1))
                      }
                    >
                      +
                    </Button>
                  </div>
                  <p className="text-center text-[11px] text-muted-foreground">
                    {photoSize.label} · {photoWidthMm} × {photoHeightMm} mm ·
                    Maximum {maximum}
                  </p>
                </>
              )}
              <div className="space-y-2">
                <p className="text-xs font-semibold">Spacing</p>
                <label className="flex items-center gap-3 text-xs">
                  <span className="w-14">Gap</span>
                  <Slider
                    value={[gapMm]}
                    min={0}
                    max={10}
                    step={0.5}
                    onValueChange={(value) => setGapMm(value[0])}
                    aria-label="Gap"
                  />
                  <b className="min-w-12 text-right">{gapMm} mm</b>
                </label>
                <label className="flex items-center gap-3 text-xs">
                  <span className="w-14">Margin</span>
                  <Slider
                    value={[marginMm]}
                    min={0}
                    max={15}
                    step={0.5}
                    onValueChange={(value) => setMarginMm(value[0])}
                    aria-label="Margin"
                  />
                  <b className="min-w-12 text-right">{marginMm} mm</b>
                </label>
              </div>
              <label className="flex items-start gap-3 rounded-md border border-line bg-background p-3 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={cuttingMarksEnabled}
                  disabled={gapMm === 0 && marginMm === 0}
                  onChange={(event) => setCutMarks(event.target.checked)}
                />
                <span>
                  <b>Cutting marks</b>
                  <small className="block text-xs text-muted-foreground">
                    Corner guides for trimming
                  </small>
                </span>
              </label>
            </section>
          )}

          {activeStep === 2 && (
            <>
              <section className="space-y-4 rounded-lg border border-line bg-paper p-4">
                <h2 className="text-sm font-bold">3. Background</h2>
                <label className="flex items-start gap-3 rounded-md border border-line bg-background p-3 text-sm">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={bgRemove}
                    onChange={(event) => setBgRemove(event.target.checked)}
                  />
                  <span>
                    <b>Remove Background</b>
                  </span>
                </label>
                {bgLoading && (
                  <p className="flex items-center gap-2 text-xs text-primary">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {bgStatus}
                  </p>
                )}
                {!bgLoading && bgStatus && (
                  <p
                    className={`text-xs ${bgStatus.startsWith("Error") ? "text-red-600" : "text-green-700"}`}
                  >
                    {bgStatus}
                  </p>
                )}
                <div>
                  <p className="mb-2 text-xs font-semibold">Background color</p>
                  <div className="flex flex-wrap gap-2">
                    {BACKGROUNDS.map(([label, value]) => (
                      <button
                        key={value}
                        type="button"
                        title={label}
                        onClick={() => setBgColor(value)}
                        className={`h-8 w-8 rounded-full border-2 ${bgColor === value ? "border-primary ring-2 ring-primary/20" : "border-line"}`}
                        style={{ background: value }}
                      />
                    ))}
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {BACKGROUNDS.find(([, value]) => value === bgColor)?.[0]}
                  </p>
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-semibold">Formal clothing</p>
                    {shirtId !== "none" && (
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline"
                        onClick={() => setShirtId("none")}
                      >
                        Remove shirt
                      </button>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => setShirtOpen(true)}
                    disabled={!crop}
                  >
                    <span className="flex items-center gap-2">
                      <Shirt className="h-4 w-4" />
                      {shirtLabel}
                    </span>
                    <span className="text-muted-foreground">Open studio</span>
                  </Button>
                  <p className="mt-2 text-[11px] leading-[1.4] text-muted-foreground">
                    Attire and clean edges, in a larger offline editor.
                  </p>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border border-line bg-paper p-4">
                <h2 className="text-sm font-bold">5. Print</h2>
                <p className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Paper</span>
                  <b>
                    {basePaper.label} · {landscape ? "Landscape" : "Portrait"}
                  </b>
                </p>
                <p className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Photos</span>
                  <b>{totalPhotos}</b>
                </p>
                <Button
                  className="w-full"
                  disabled={!finalUrl || !totalPhotos}
                  onClick={printPreview}
                >
                  <Printer className="mr-2 h-4 w-4" />
                  Print Preview & Print
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    disabled={!finalUrl || !totalPhotos}
                    onClick={downloadPng}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    PNG
                  </Button>
                  <Button
                    variant="outline"
                    disabled={!finalUrl || !totalPhotos}
                    onClick={() => void downloadPdf()}
                  >
                    <Download className="mr-1 h-4 w-4" />
                    PDF
                  </Button>
                </div>
              </section>
            </>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              disabled={activeStep === 1}
              onClick={() => setActiveStep((value) => value - 1)}
            >
              Back
            </Button>
            {activeStep < 2 && (
              <Button
                disabled={activeStep === 1 && !imageSrc}
                onClick={() => setActiveStep((value) => value + 1)}
              >
                Next
              </Button>
            )}
          </div>
        </div>
      </div>

      <Dialog open={shirtOpen} onOpenChange={setShirtOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Formal clothing and clean edges</DialogTitle>
            <DialogDescription>
              Choose attire, line it up, then brush away the old clothing. Runs
              entirely in your browser.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Formal clothing</p>
                {shirtId !== "none" && (
                  <button
                    type="button"
                    className="text-[11px] text-muted-foreground underline"
                    onClick={() => setShirtId("none")}
                  >
                    Remove shirt
                  </button>
                )}
              </div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setShirtId("none")}
                  className={`rounded-md border p-1.5 text-left text-[11px] ${
                    shirtId === "none"
                      ? "border-primary bg-primary/10"
                      : "border-line"
                  }`}
                >
                  <div className="grid aspect-square place-items-center rounded bg-background text-center text-muted-foreground">
                    None
                  </div>
                  <span className="mt-1 block">No shirt</span>
                </button>
                {availableShirts.map((shirt) => (
                  <button
                    key={shirt.id}
                    type="button"
                    onClick={() => setShirtId(shirt.id)}
                    className={`rounded-md border p-1.5 text-left text-[11px] ${
                      shirtId === shirt.id
                        ? "border-primary bg-primary/10"
                        : "border-line"
                    }`}
                  >
                    <div className="aspect-square overflow-hidden rounded bg-background">
                      <img
                        src={shirt.src}
                        alt=""
                        className="h-full w-full object-contain"
                      />
                    </div>
                    <span className="mt-1 block truncate">
                      {shirt.group} · {shirt.label}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">Clean edges</p>
                <span className="text-[11px] text-muted-foreground">
                  Runs offline
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                <Button
                  size="sm"
                  variant={editMode === "move" ? "secondary" : "outline"}
                  disabled={!shirtImage}
                  onClick={() => setEditMode("move")}
                >
                  <Move className="mr-1 h-3.5 w-3.5" />
                  Move
                </Button>
                <Button
                  size="sm"
                  variant={editMode === "erase" ? "secondary" : "outline"}
                  onClick={() => setEditMode("erase")}
                >
                  <Eraser className="mr-1 h-3.5 w-3.5" />
                  Erase
                </Button>
                <Button
                  size="sm"
                  variant={editMode === "restore" ? "secondary" : "outline"}
                  onClick={() => setEditMode("restore")}
                >
                  <Paintbrush className="mr-1 h-3.5 w-3.5" />
                  Restore
                </Button>
              </div>
              <canvas
                ref={setEditorCanvas}
                onPointerDown={handleEditorPointerDown}
                onPointerMove={handleEditorPointerMove}
                onPointerUp={handleEditorPointerUp}
                onPointerCancel={handleEditorPointerUp}
                className={`mx-auto block h-auto w-full max-w-[460px] touch-none rounded-md border border-line bg-white ${
                  editMode === "move" ? "cursor-move" : "cursor-crosshair"
                }`}
              />
              <p className="text-center text-[11px] text-muted-foreground">
                {editMode === "move"
                  ? "Drag the shirt to line it up with the neck and shoulders."
                  : editMode === "erase"
                    ? "Brush over the old clothing you want to hide."
                    : "Brush to bring the original pixels back."}
              </p>
              {editMode === "move" ? (
                <>
                  <label className="flex items-center gap-3 text-xs">
                    <span className="w-12">Scale</span>
                    <Slider
                      value={[shirtTransform.scale]}
                      min={0.4}
                      max={2}
                      step={0.01}
                      onValueChange={(value) =>
                        setShirtTransform((transform) => ({
                          ...transform,
                          scale: value[0],
                        }))
                      }
                      aria-label="Shirt scale"
                    />
                    <b className="min-w-12 text-right">
                      {Math.round(shirtTransform.scale * 100)}%
                    </b>
                  </label>
                  <label className="flex items-center gap-3 text-xs">
                    <span className="w-12">Rotate</span>
                    <Slider
                      value={[shirtTransform.rotation]}
                      min={-45}
                      max={45}
                      step={0.5}
                      onValueChange={(value) =>
                        setShirtTransform((transform) => ({
                          ...transform,
                          rotation: value[0],
                        }))
                      }
                      aria-label="Shirt rotation"
                    />
                    <b className="min-w-12 text-right">
                      {shirtTransform.rotation.toFixed(1)}°
                    </b>
                  </label>
                  <Button
                    className="w-full"
                    variant="secondary"
                    size="sm"
                    disabled={!shirtImage || autoFitBusy}
                    onClick={() => void runAutoFit()}
                  >
                    {autoFitBusy ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="mr-1 h-3.5 w-3.5" />
                    )}
                    {autoFitBusy ? "Fitting…" : "Auto fit"}
                  </Button>
                  {autoFitStatus && (
                    <p className="text-[11px] leading-[1.4] text-muted-foreground">
                      {autoFitStatus}
                    </p>
                  )}
                </>
              ) : (
                <label className="flex items-center gap-3 text-xs">
                  <span className="w-12">Brush</span>
                  <Slider
                    value={[brushSize]}
                    min={4}
                    max={90}
                    step={1}
                    onValueChange={(value) => setBrushSize(value[0])}
                    aria-label="Brush size"
                  />
                  <b className="min-w-12 text-right">{brushSize}px</b>
                </label>
              )}
              <label className="flex items-center gap-3 text-xs">
                <span className="w-12">Feather</span>
                <Slider
                  value={[feather]}
                  min={0}
                  max={10}
                  step={0.5}
                  onValueChange={(value) => setFeather(value[0])}
                  aria-label="Edge feather"
                />
                <b className="min-w-12 text-right">{feather}px</b>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!shirtImage}
                  onClick={() => setShirtTransform(DEFAULT_SHIRT_TRANSFORM)}
                >
                  Reset fit
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void undoMask()}
                >
                  <Undo2 className="mr-1 h-3.5 w-3.5" />
                  Undo
                </Button>
                <Button variant="outline" size="sm" onClick={resetMask}>
                  Reset mask
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
