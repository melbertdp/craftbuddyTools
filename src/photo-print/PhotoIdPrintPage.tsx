"use client";

import * as React from "react";
import { Download, FlipHorizontal, ImagePlus, Loader2, Printer, Redo2, RotateCcw, RotateCw, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Cropper, CropperArea, CropperDescription, CropperImage } from "@/components/ui/image-crop";
import { PAPER_SIZES, PHOTO_SIZES, orientedPaper, packPhotoItems, type SheetCell } from "./layout";

const DPI = 300;
const MARGIN_MM = 4;
const GAP_MM = 2.5;
const QUALITIES = ["Epson Premium Glossy", "Epson Matte Paper", "Plain Paper", "Glossy Photo Paper"];
const BACKGROUNDS = [
  ["White", "#ffffff"], ["Light Blue", "#cfe6f4"], ["Light Green", "#d0ebd2"],
  ["Navy Blue", "#0a2463"], ["Red", "#c62828"], ["Yellow", "#ffe082"], ["Gray", "#bdbdbd"],
] as const;

type CropArea = { x: number; y: number; width: number; height: number };
type ImageSource = HTMLImageElement | HTMLCanvasElement;

const MATTING_SIZE = 512;
let modelPromise: Promise<{ session: any; ort: any }> | null = null;
async function getBackgroundModel() {
  if (!modelPromise) {
    modelPromise = (async () => {
      const ort = await import("onnxruntime-web");
      ort.env.wasm.wasmPaths = "/ort/";
      ort.env.wasm.numThreads = 1;
      const session = await ort.InferenceSession.create("/models/hivision_modnet.onnx", { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
      return { session, ort };
    })();
  }
  return modelPromise;
}

function resizeToMattingCanvas(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = MATTING_SIZE; canvas.height = MATTING_SIZE;
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

function fillMatteHoles(alpha: Uint8ClampedArray, width: number, height: number) {
  const solid = new Uint8Array(width * height);
  for (let index = 0; index < solid.length; index += 1) solid[index] = alpha[index] >= 127 ? 1 : 0;
  const reachable = new Uint8Array(width * height);
  const queue = new Int32Array(width * height);
  let head = 0;
  let tail = 0;
  const visit = (index: number) => {
    if (solid[index] === 0 && reachable[index] === 0) { reachable[index] = 1; queue[tail++] = index; }
  };
  for (let x = 0; x < width; x += 1) { visit(x); visit((height - 1) * width + x); }
  for (let y = 0; y < height; y += 1) { visit(y * width); visit(y * width + width - 1); }
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

function canvasFrom(source: ImageSource, width = source.width, height = source.height) {
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
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function rotateCanvas(source: HTMLCanvasElement, degrees: number) {
  const sideways = Math.abs(degrees % 180) === 90;
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

function adjustedCanvas(source: HTMLCanvasElement, brightness: number, contrast: number, saturation: number, background: string) {
  const canvas = canvasFrom(source);
  const context = canvas.getContext("2d");
  if (!context) return canvas;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  context.drawImage(source, 0, 0);
  void pixels;
  return canvas;
}

function drawCover(context: CanvasRenderingContext2D, image: CanvasImageSource & { width: number; height: number }, x: number, y: number, width: number, height: number) {
  const scale = Math.max(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  context.drawImage(image, x + (width - drawWidth) / 2, y + (height - drawHeight) / 2, drawWidth, drawHeight);
}

function maxCopies(widthMm: number, heightMm: number, photoWidthMm: number, photoHeightMm: number) {
  const columns = Math.max(0, Math.floor((widthMm - MARGIN_MM * 2 + GAP_MM) / (photoWidthMm + GAP_MM)));
  const rows = Math.max(0, Math.floor((heightMm - MARGIN_MM * 2 + GAP_MM) / (photoHeightMm + GAP_MM)));
  return columns * rows;
}

function cellsForCopies(widthMm: number, heightMm: number, copies: number, photoWidthMm: number, photoHeightMm: number, photoTypeId: string): SheetCell[] {
  const columns = Math.max(1, Math.floor((widthMm - MARGIN_MM * 2 + GAP_MM) / (photoWidthMm + GAP_MM)));
  const placedColumns = Math.min(copies, columns);
  const totalWidth = placedColumns * photoWidthMm + Math.max(0, placedColumns - 1) * GAP_MM;
  const rows = Math.ceil(copies / columns);
  const totalHeight = rows * photoHeightMm + Math.max(0, rows - 1) * GAP_MM;
  const startX = (widthMm - totalWidth) / 2;
  const startY = (heightMm - totalHeight) / 2;
  return Array.from({ length: copies }, (_, index) => ({
    id: `${photoTypeId}-${index}`,
    photoTypeId,
    xMm: startX + (index % columns) * (photoWidthMm + GAP_MM),
    yMm: startY + Math.floor(index / columns) * (photoHeightMm + GAP_MM),
    widthMm: photoWidthMm,
    heightMm: photoHeightMm,
  }));
}

export default function PhotoIdPrintPage() {
  const fileRef = React.useRef<HTMLInputElement>(null);
  const lastCropAreaRef = React.useRef<CropArea | null>(null);
  const processedCropRef = React.useRef<HTMLCanvasElement | null>(null);
  const processedCropSourceRef = React.useRef<HTMLCanvasElement | null>(null);
  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [crop, setCrop] = React.useState<HTMLCanvasElement | null>(null);
  const [processedCrop, setProcessedCrop] = React.useState<HTMLCanvasElement | null>(null);
  const [bgRemove, setBgRemove] = React.useState(false);
  const [bgLoading, setBgLoading] = React.useState(false);
  const [bgStatus, setBgStatus] = React.useState("");
  const [bgColor, setBgColor] = React.useState("#ffffff");
  const [paperId, setPaperId] = React.useState("4r");
  const [photoSizeId, setPhotoSizeId] = React.useState("standard");
  const [mixSizes, setMixSizes] = React.useState(false);
  const [mixQuantities, setMixQuantities] = React.useState<Record<string, number>>({ standard: 4 });
  const [landscape, setLandscape] = React.useState(false);
  const [quality, setQuality] = React.useState(0);
  const [copies, setCopies] = React.useState(4);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [brightness, setBrightness] = React.useState(100);
  const [contrast, setContrast] = React.useState(100);
  const [saturation, setSaturation] = React.useState(100);
  const [history, setHistory] = React.useState<string[]>([]);
  const [future, setFuture] = React.useState<string[]>([]);
  const [activeStep, setActiveStep] = React.useState(1);
  const [dragOver, setDragOver] = React.useState(false);
  const [cropArea, setCropArea] = React.useState<CropArea | null>(null);

  const basePaper = PAPER_SIZES.find((paper) => paper.id === paperId) ?? PAPER_SIZES[1];
  const paper = orientedPaper(basePaper, landscape ? "landscape" : "portrait");
  const photoSize = PHOTO_SIZES.find((size) => size.id === photoSizeId) ?? PHOTO_SIZES[0];
  const photoWidthMm = photoSize.widthMm;
  const photoHeightMm = photoSize.heightMm;
  const maximum = maxCopies(paper.widthMm, paper.heightMm, photoWidthMm, photoHeightMm);
  const cropSize = mixSizes ? PHOTO_SIZES.find((size) => (mixQuantities[size.id] ?? 0) > 0) ?? photoSize : photoSize;
  const cells = mixSizes
    ? packPhotoItems(
        paper.widthMm,
        paper.heightMm,
        PHOTO_SIZES.filter((size) => (mixQuantities[size.id] ?? 0) > 0).map((size) => ({ photoTypeId: size.id, widthMm: size.widthMm, heightMm: size.heightMm, quantity: mixQuantities[size.id] ?? 0 })),
        MARGIN_MM,
        GAP_MM,
      )
    : cellsForCopies(paper.widthMm, paper.heightMm, Math.min(copies, maximum), photoWidthMm, photoHeightMm, photoSize.id);
  const totalPhotos = cells.length;

  React.useEffect(() => {
    lastCropAreaRef.current = null;
  }, [photoSizeId, mixSizes, cropSize.widthMm, cropSize.heightMm]);

  React.useEffect(() => {
    setCopies((value) => Math.min(Math.max(1, value), Math.max(1, maximum)));
  }, [maximum]);

  React.useEffect(() => () => {
    if (imageSrc?.startsWith("blob:")) URL.revokeObjectURL(imageSrc);
  }, [imageSrc]);

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
         const output = await session.run({ [inputName]: mattingTensor(inference, ort) });
         const matte = output[session.outputNames[0]];
         const maskWidth = Number(matte.dims[matte.dims.length - 1]) || inference.width;
         const maskHeight = Number(matte.dims[matte.dims.length - 2]) || inference.height;
         const maskCanvas = document.createElement("canvas");
         maskCanvas.width = maskWidth; maskCanvas.height = maskHeight;
         const maskContext = maskCanvas.getContext("2d");
         if (!maskContext) throw new Error("Canvas is not available in this browser.");
         const maskPixels = maskContext.createImageData(maskWidth, maskHeight);
         const matteData = matte.data as Float32Array;
         for (let index = 0; index < maskWidth * maskHeight; index += 1) {
           const value = matteData[index] <= 1 ? matteData[index] * 255 : matteData[index];
           const alpha = Math.max(0, Math.min(255, value));
           const pixel = index * 4;
           maskPixels.data[pixel] = alpha; maskPixels.data[pixel + 1] = alpha; maskPixels.data[pixel + 2] = alpha; maskPixels.data[pixel + 3] = alpha;
         }
         maskContext.putImageData(maskPixels, 0, 0);
         const result = canvasFrom(source);
         const context = result.getContext("2d");
         if (!context) throw new Error("Canvas is not available in this browser.");
         const pixels = context.getImageData(0, 0, result.width, result.height);
         const scaledMask = document.createElement("canvas");
         scaledMask.width = result.width; scaledMask.height = result.height;
         const scaledContext = scaledMask.getContext("2d");
         if (!scaledContext) throw new Error("Canvas is not available in this browser.");
         scaledContext.imageSmoothingEnabled = true;
         scaledContext.imageSmoothingQuality = "high";
         scaledContext.drawImage(maskCanvas, 0, 0, result.width, result.height);
         const scaledPixels = scaledContext.getImageData(0, 0, result.width, result.height);
         const alpha = new Uint8ClampedArray(result.width * result.height);
         for (let index = 0; index < alpha.length; index += 1) alpha[index] = scaledPixels.data[index * 4 + 3];
         fillMatteHoles(alpha, result.width, result.height);
         for (let index = 0; index < alpha.length; index += 1) pixels.data[index * 4 + 3] = alpha[index];
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
          setBgStatus(reason instanceof Error ? `Error: ${reason.message}` : "Background removal failed.");
        }
      } finally {
        if (!cancelled) setBgLoading(false);
      }
      })();
    }, 250);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, [activeStep, bgRemove, crop]);

  const finalCanvas = React.useMemo(() => {
    if (!crop) return null;
    const source = processedCrop ?? crop;
    return adjustedCanvas(rotateCanvas(source, rotation), brightness, contrast, saturation, bgColor);
  }, [bgColor, brightness, contrast, crop, processedCrop, rotation, saturation]);
  const finalUrl = React.useMemo(() => finalCanvas?.toDataURL("image/png") ?? null, [finalCanvas]);

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
      void loadImage(value).then(setImage);
      lastCropAreaRef.current = null;
      setCrop(null); setProcessedCrop(null); setBgRemove(false); setZoom(1); setHistory([]); setFuture([]);
    };
    reader.readAsDataURL(file);
  }

  function changeImage(transform: (source: HTMLCanvasElement) => HTMLCanvasElement) {
    if (!imageSrc) return;
    rememberCurrent();
    void loadImage(imageSrc).then((loaded) => {
      const next = transform(canvasFrom(loaded)).toDataURL("image/jpeg", 0.92);
      setImageSrc(next); void loadImage(next).then(setImage); lastCropAreaRef.current = null; setCrop(null); setProcessedCrop(null);
    });
  }

  function undo() {
    const previous = history.at(-1);
    if (!previous || !imageSrc) return;
    setFuture((items) => [...items, imageSrc]); setHistory((items) => items.slice(0, -1)); setImageSrc(previous); void loadImage(previous).then(setImage); lastCropAreaRef.current = null; setCrop(null); setProcessedCrop(null);
  }

  function redo() {
    const next = future.at(-1);
    if (!next || !imageSrc) return;
    setHistory((items) => [...items, imageSrc]); setFuture((items) => items.slice(0, -1)); setImageSrc(next); void loadImage(next).then(setImage); lastCropAreaRef.current = null; setCrop(null); setProcessedCrop(null);
  }

  const handleCropChange = React.useCallback((area: CropArea | null) => {
    if (!area || !image) return;
    const previous = lastCropAreaRef.current;
    if (previous && previous.x === area.x && previous.y === area.y && previous.width === area.width && previous.height === area.height) return;
    lastCropAreaRef.current = area;
    setCropArea(area);
    setCrop(cropToCanvas(image, area));
  }, [image]);

  function downloadPng() {
    if (!finalCanvas) return;
    const scale = DPI / 25.4;
    const sheet = document.createElement("canvas"); sheet.width = Math.round(paper.widthMm * scale); sheet.height = Math.round(paper.heightMm * scale);
    const context = sheet.getContext("2d"); if (!context) return;
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, sheet.width, sheet.height);
    cells.forEach((cell) => { drawCover(context, finalCanvas, cell.xMm * scale, cell.yMm * scale, cell.widthMm * scale, cell.heightMm * scale); context.strokeStyle = "#000"; context.lineWidth = 2; context.strokeRect(cell.xMm * scale, cell.yMm * scale, cell.widthMm * scale, cell.heightMm * scale); });
    const link = document.createElement("a"); link.download = `${mixSizes ? "mixed" : photoSize.id}_${totalPhotos}x.png`; link.href = sheet.toDataURL("image/png"); link.click();
  }

  async function downloadPdf() {
    if (!finalCanvas) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: [paper.widthMm, paper.heightMm], orientation: paper.widthMm > paper.heightMm ? "landscape" : "portrait" });
    cells.forEach((cell) => pdf.addImage(finalCanvas.toDataURL("image/png"), "PNG", cell.xMm, cell.yMm, cell.widthMm, cell.heightMm));
    pdf.save(`${mixSizes ? "mixed" : photoSize.id}_${totalPhotos}x.pdf`);
  }

  function printPreview() {
    if (!finalCanvas) return;
    const data = document.createElement("canvas"); data.width = Math.round(paper.widthMm / 25.4 * DPI); data.height = Math.round(paper.heightMm / 25.4 * DPI);
    const context = data.getContext("2d"); if (!context) return;
    context.fillStyle = "#fff"; context.fillRect(0, 0, data.width, data.height);
    const scale = DPI / 25.4; cells.forEach((cell) => { drawCover(context, finalCanvas, cell.xMm * scale, cell.yMm * scale, cell.widthMm * scale, cell.heightMm * scale); context.strokeStyle = "#000"; context.strokeRect(cell.xMm * scale, cell.yMm * scale, cell.widthMm * scale, cell.heightMm * scale); });
    const popup = window.open("", "_blank", "width=900,height=1000"); if (!popup) return;
    const width = paper.widthMm / 25.4; const height = paper.heightMm / 25.4;
    popup.document.write(`<!doctype html><title>Print Preview</title><style>@page{size:${width}in ${height}in;margin:0}body{margin:0;background:#525659;font-family:system-ui}.bar{padding:14px 20px;background:#fff;display:flex;justify-content:space-between}.tip{padding:12px 20px;background:#fff8e1;font-size:13px}.sheet{display:flex;justify-content:center;padding:30px}.sheet img{width:${width}in;height:${height}in;background:#fff}</style><div class="bar"><b>Print Preview</b><button onclick="window.print()">Print</button></div><div class="tip"><b>Tip:</b> Use 100% scale / Actual size. ${QUALITIES[quality]}</div><div class="sheet"><img src="${data.toDataURL("image/png")}" alt="Print sheet"></div>`);
    popup.document.close();
  }

  return <main className="mx-auto w-full max-w-[1400px] px-4 py-8 text-ink md:px-7">
    <header className="mb-6"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">Creative tools / passport studio</p><h1 className="mt-2 font-heading text-4xl font-extrabold tracking-[-.055em]">Photo Print Maker</h1><p className="mt-2 text-sm text-muted-foreground">Create print-ready passport and ID photos locally in your browser.</p></header>
    <div className="mb-6 grid grid-cols-3 gap-2">{["Upload & Edit", "Background & Paper", "Preview & Print"].map((label, index) => <button key={label} type="button" onClick={() => setActiveStep(index + 1)} className={`rounded border px-3 py-2 text-left text-xs ${activeStep === index + 1 ? "border-primary bg-primary/10" : "border-line text-muted-foreground"}`}><b className="mr-1 text-primary">{index + 1}</b>{label}</button>)}</div>
    <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="space-y-4">
        {activeStep === 1 && <section className="space-y-4 rounded border border-line bg-paper p-5"><h2 className="text-sm font-bold">1. Upload Photo</h2><button type="button" onClick={() => fileRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); setDragOver(false); handleFile(event.dataTransfer.files?.[0]); }} className={`flex min-h-36 w-full flex-col items-center justify-center gap-2 rounded border-2 border-dashed p-5 text-center ${dragOver ? "border-primary bg-primary/10" : "border-line"}`}><ImagePlus className="text-muted-foreground" /><b>{imageSrc ? "Photo loaded" : "Click or drop photo"}</b>{imageSrc && image && <span className="text-xs text-muted-foreground">{image.naturalWidth} × {image.naturalHeight}px</span>}<input ref={fileRef} hidden type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} /></button>{imageSrc && <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => changeImage((source) => rotateCanvas(source, -90))}><RotateCcw className="mr-1 h-3.5 w-3.5" />Left</Button><Button variant="outline" size="sm" onClick={() => changeImage((source) => rotateCanvas(source, 90))}><RotateCw className="mr-1 h-3.5 w-3.5" />Right</Button><Button variant="outline" size="sm" onClick={() => changeImage(flipCanvas)}><FlipHorizontal className="mr-1 h-3.5 w-3.5" />Flip</Button><Button variant="outline" size="sm" disabled={!history.length} onClick={undo}><Undo2 className="mr-1 h-3.5 w-3.5" />Undo</Button><Button variant="outline" size="sm" disabled={!future.length} onClick={redo}><Redo2 className="mr-1 h-3.5 w-3.5" />Redo</Button></div>}</section>}
        {activeStep === 1 && imageSrc && <section className="space-y-3 rounded border border-line bg-paper p-5"><h2 className="text-sm font-bold">2. Crop & Adjust</h2><Cropper className="h-64" image={imageSrc} aspectRatio={cropSize.widthMm / cropSize.heightMm} zoom={zoom} minZoom={1} maxZoom={3} onZoomChange={setZoom} onCropChange={handleCropChange}><CropperDescription>Drag the image to position the face and use the crop area to frame the passport photo.</CropperDescription><CropperImage /><CropperArea /><div className="pointer-events-none absolute inset-[33%] border border-white/30" /></Cropper><label className="flex items-center gap-3 text-xs">Zoom <Slider value={[zoom]} min={1} max={3} step={0.05} onValueChange={(value) => setZoom(value[0])} aria-label="Zoom" /><b>{Math.round(zoom * 100)}%</b></label>{cropArea && <p className="text-[11px] text-muted-foreground">Crop ready at {Math.round(cropArea.width)} × {Math.round(cropArea.height)} source pixels.</p>}{[["Brightness", brightness, setBrightness, 50, 150], ["Contrast", contrast, setContrast, 50, 150], ["Saturation", saturation, setSaturation, 0, 200]].map(([label, value, setter, min, max]) => <label key={label as string} className="flex items-center gap-2 text-xs"><span className="w-20">{label as string}</span><Slider value={[value as number]} min={min as number} max={max as number} step={1} onValueChange={(next) => (setter as React.Dispatch<React.SetStateAction<number>>)(next[0])} aria-label={label as string} /><b>{value as number}%</b></label>)}</section>}
        {activeStep === 2 && <section className="space-y-4 rounded border border-line bg-paper p-5"><h2 className="text-sm font-bold">3. Background</h2><label className="flex items-center gap-3 rounded border border-line bg-background p-3 text-sm"><input type="checkbox" checked={bgRemove} onChange={(event) => setBgRemove(event.target.checked)} /><span><b>Remove Background</b><small className="block text-xs text-muted-foreground">AI · Hivision MODNet runs locally</small></span></label>{bgLoading && <p className="flex items-center gap-2 text-xs text-primary"><Loader2 className="h-3.5 w-3.5 animate-spin" />{bgStatus}</p>}{!bgLoading && bgStatus && <p className={`text-xs ${bgStatus.startsWith("Error") ? "text-red-600" : "text-green-700"}`}>{bgStatus}</p>}<div><p className="mb-2 text-xs font-semibold">Background color</p><div className="flex flex-wrap gap-2">{BACKGROUNDS.map(([label, value]) => <button key={value} type="button" title={label} onClick={() => setBgColor(value)} className={`h-8 w-8 rounded-full border-2 ${bgColor === value ? "border-primary ring-2 ring-primary/20" : "border-line"}`} style={{ background: value }} />)}</div><p className="mt-1 text-[11px] text-muted-foreground">{BACKGROUNDS.find(([, value]) => value === bgColor)?.[0]}</p></div></section>}
        {activeStep === 2 && <section className="space-y-4 rounded border border-line bg-paper p-5"><h2 className="text-sm font-bold">4. Photo Size & Paper</h2><label className="flex items-center gap-3 rounded border border-line bg-background p-3 text-sm"><input type="checkbox" checked={mixSizes} onChange={(event) => setMixSizes(event.target.checked)} /><span><b>Mix photo sizes</b><small className="block text-xs text-muted-foreground">Fill one sheet with different ID photo sizes</small></span></label>{mixSizes ? <div className="space-y-2"><p className="text-xs font-semibold">Quantities</p>{PHOTO_SIZES.map((size) => <div key={size.id} className="flex items-center justify-between rounded border border-line px-3 py-2 text-xs"><span>{size.label}<small className="ml-2 text-muted-foreground">{size.widthMm} × {size.heightMm} mm</small></span><div className="flex items-center gap-2"><Button variant="outline" size="sm" onClick={() => setMixQuantities((quantities) => ({ ...quantities, [size.id]: Math.max(0, (quantities[size.id] ?? 0) - 1) }))}>−</Button><b className="min-w-6 text-center">{mixQuantities[size.id] ?? 0}</b><Button variant="outline" size="sm" onClick={() => setMixQuantities((quantities) => ({ ...quantities, [size.id]: Math.min(99, (quantities[size.id] ?? 0) + 1) }))}>+</Button></div></div>)}</div> : <div className="space-y-2"><p className="text-xs font-semibold">Photo size</p><div className="grid grid-cols-2 gap-2">{PHOTO_SIZES.map((size) => <button key={size.id} type="button" onClick={() => setPhotoSizeId(size.id)} className={`rounded border px-3 py-2 text-left text-xs ${photoSizeId === size.id ? "border-primary bg-primary/10" : "border-line"}`}><span>{size.label}</span><small className="block text-muted-foreground">{size.widthMm} × {size.heightMm} mm</small></button>)}</div></div>}<div className="flex gap-2"><Button className="flex-1" variant={!landscape ? "secondary" : "outline"} onClick={() => setLandscape(false)}>Portrait</Button><Button className="flex-1" variant={landscape ? "secondary" : "outline"} onClick={() => setLandscape(true)}>Landscape</Button></div><div className="space-y-2">{PAPER_SIZES.filter((paperOption) => ["4r", "5r", "a4", "letter"].includes(paperOption.id)).map((paperOption) => <button key={paperOption.id} type="button" onClick={() => setPaperId(paperOption.id)} className={`flex w-full items-center justify-between rounded border px-3 py-2 text-left text-xs ${paperId === paperOption.id ? "border-primary bg-primary/10" : "border-line"}`}><span>{paperOption.label}<small className="ml-2 text-muted-foreground">{paperOption.widthMm} × {paperOption.heightMm} mm</small></span><b>{maxCopies(orientedPaper(paperOption, landscape ? "landscape" : "portrait").widthMm, orientedPaper(paperOption, landscape ? "landscape" : "portrait").heightMm, photoWidthMm, photoHeightMm)} max</b></button>)}</div>{!mixSizes && <><div className="flex items-center justify-center gap-4"><Button variant="outline" onClick={() => setCopies((value) => Math.max(1, value - 1))}>−</Button><strong className="min-w-12 text-center text-3xl text-primary">{copies}</strong><Button variant="outline" onClick={() => setCopies((value) => Math.min(maximum, value + 1))}>+</Button></div><p className="text-center text-[11px] text-muted-foreground">{photoSize.label} · {photoWidthMm} × {photoHeightMm} mm · Maximum {maximum}</p></>}<div className="space-y-2"><p className="text-xs font-semibold">Paper quality</p>{QUALITIES.map((label, index) => <button key={label} type="button" onClick={() => setQuality(index)} className={`block w-full rounded border px-3 py-2 text-left text-xs ${quality === index ? "border-primary bg-primary/10" : "border-line"}`}>{label}</button>)}</div></section>}
        {activeStep === 3 && <section className="space-y-2 rounded border border-line bg-paper p-5"><h2 className="mb-3 text-sm font-bold">5. Print</h2><p className="flex justify-between text-xs"><span>Paper</span><b>{basePaper.label} · {landscape ? "Landscape" : "Portrait"}</b></p><p className="flex justify-between text-xs"><span>Quality</span><b>{QUALITIES[quality]}</b></p><p className="flex justify-between text-xs"><span>Photos</span><b>{totalPhotos}</b></p><Button className="mt-3 w-full" disabled={!finalUrl || !totalPhotos} onClick={printPreview}><Printer className="mr-2 h-4 w-4" />Print Preview & Print</Button><div className="flex gap-2"><Button className="flex-1" variant="outline" disabled={!finalUrl || !totalPhotos} onClick={downloadPng}><Download className="mr-1 h-4 w-4" />PNG 300 DPI</Button><Button className="flex-1" variant="outline" disabled={!finalUrl || !totalPhotos} onClick={() => void downloadPdf()}><Download className="mr-1 h-4 w-4" />PDF</Button></div></section>}
        <div className="flex gap-2"><Button className="flex-1" variant="outline" disabled={activeStep === 1} onClick={() => setActiveStep((value) => value - 1)}>Back</Button>{activeStep < 3 && <Button className="flex-1" disabled={activeStep === 1 && !imageSrc} onClick={() => setActiveStep((value) => value + 1)}>Next</Button>}</div>
      </aside>
      <section className="rounded border border-line bg-[#f4f6f9] p-5"><div className="mb-4 flex flex-wrap gap-4 text-xs text-muted-foreground"><span><b className="text-foreground">{totalPhotos}</b> photos</span><span>{basePaper.label}</span><span>{paper.widthMm.toFixed(1)} × {paper.heightMm.toFixed(1)} mm</span></div><div className="flex flex-wrap items-start justify-center gap-8"><div className="text-center"><p className="mb-2 text-xs font-bold">Full print sheet</p><div className="overflow-auto rounded bg-white p-3 shadow-sm"><div className="relative mx-auto bg-white" style={{ width: `${paper.widthMm}mm`, height: `${paper.heightMm}mm` }}>{cells.map((cell) => <div key={cell.id} className="absolute overflow-hidden border border-black" style={{ left: `${cell.xMm}mm`, top: `${cell.yMm}mm`, width: `${cell.widthMm}mm`, height: `${cell.heightMm}mm` }}>{finalUrl && <img src={finalUrl} alt="" className="h-full w-full object-cover" />}</div>)}</div></div><p className="mt-2 text-[11px] text-muted-foreground">{totalPhotos} photos · drag position is controlled by the crop tool</p></div></div></section>
    </div>
  </main>;
}
