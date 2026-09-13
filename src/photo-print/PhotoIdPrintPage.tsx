"use client";

import * as React from "react";
import { Download, ImagePlus, Printer, RotateCcw, RotateCw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Cropper, CropperArea, CropperImage } from "@/components/ui/image-crop";
import { PAPER_SIZES, PHOTO_SIZES, orientedPaper, packPhotoItems, type SheetCell } from "./layout";

type CropArea = { x: number; y: number; width: number; height: number };
type QuantityState = { "1x1in": number; "2x2in": number; passport: number };

const defaultQuantities: QuantityState = { "1x1in": 0, "2x2in": 0, passport: 5 };
const colorOptions = [
  ["white", "#ffffff"],
  ["blue", "#d8e8ff"],
  ["red", "#ffe1e1"],
  ["gray", "#e8eaed"],
] as const;

function photoSize(id: string) {
  return PHOTO_SIZES.find((photo) => photo.id === id) ?? PHOTO_SIZES[1];
}

function loadImage(file: File) {
  return new Promise<{ url: string; image: HTMLImageElement }>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ url, image });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read that image."));
    };
    image.src = url;
  });
}

function cropImage(image: HTMLImageElement, area: CropArea) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(area.width));
  canvas.height = Math.max(1, Math.round(area.height));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not available in this browser.");
  context.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function adjustImage(source: HTMLCanvasElement, brightness: number, contrast: number, saturation: number) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
  context.drawImage(source, 0, 0);
  return canvas;
}

function rotateImage(source: HTMLCanvasElement, degrees: number) {
  if (degrees % 360 === 0) return source;
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

function addNameTag(source: HTMLCanvasElement, name: string, secondary: string, background: string, foreground: string) {
  if (!name.trim() && !secondary.trim()) return source;
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) return source;
  context.drawImage(source, 0, 0);
  const height = Math.max(28, Math.round(canvas.height * 0.16));
  context.fillStyle = background;
  context.fillRect(0, canvas.height - height, canvas.width, height);
  context.fillStyle = foreground;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `600 ${Math.max(12, Math.round(height * 0.34))}px sans-serif`;
  context.fillText(name.trim(), canvas.width / 2, canvas.height - height * (secondary.trim() ? 0.64 : 0.5));
  if (secondary.trim()) {
    context.font = `${Math.max(9, Math.round(height * 0.22))}px sans-serif`;
    context.fillText(secondary.trim(), canvas.width / 2, canvas.height - height * 0.22);
  }
  return canvas;
}

export default function PhotoIdPrintPage() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const cropTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);
  const [image, setImage] = React.useState<HTMLImageElement | null>(null);
  const [error, setError] = React.useState("");
  const [dragOver, setDragOver] = React.useState(false);
  const [crop, setCrop] = React.useState<HTMLCanvasElement | null>(null);
  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [sizeId, setSizeId] = React.useState("2x2in");
  const [brightness, setBrightness] = React.useState(100);
  const [contrast, setContrast] = React.useState(100);
  const [saturation, setSaturation] = React.useState(100);
  const [paperId, setPaperId] = React.useState("a4");
  const [orientation, setOrientation] = React.useState<"portrait" | "landscape">("portrait");
  const [quantities, setQuantities] = React.useState<QuantityState>(defaultQuantities);
  const [marginMm, setMarginMm] = React.useState(4);
  const [gapMm, setGapMm] = React.useState(1);
  const [cutLines, setCutLines] = React.useState(true);
  const [background, setBackground] = React.useState("#ffffff");
  const [nameTagEnabled, setNameTagEnabled] = React.useState(false);
  const [name, setName] = React.useState("");
  const [secondary, setSecondary] = React.useState("");
  const [activeStep, setActiveStep] = React.useState(1);

  React.useEffect(() => () => {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    if (cropTimer.current) clearTimeout(cropTimer.current);
  }, [imageUrl]);

  const paper = orientedPaper(PAPER_SIZES.find((item) => item.id === paperId) ?? PAPER_SIZES[4], orientation);
  const cells = React.useMemo(() => packPhotoItems(paper.widthMm, paper.heightMm, Object.entries(quantities).map(([id, quantity]) => {
    const size = photoSize(id);
    return { photoTypeId: id, widthMm: size.widthMm, heightMm: size.heightMm, quantity };
  }), marginMm, gapMm), [gapMm, marginMm, paper.heightMm, paper.widthMm, quantities]);

  const finalCanvas = React.useMemo(() => {
    if (!crop) return null;
    const adjusted = adjustImage(rotateImage(crop, rotation), brightness, contrast, saturation);
    const result = document.createElement("canvas");
    result.width = adjusted.width;
    result.height = adjusted.height;
    const context = result.getContext("2d");
    if (!context) return adjusted;
    context.fillStyle = background;
    context.fillRect(0, 0, result.width, result.height);
    context.drawImage(adjusted, 0, 0);
    return nameTagEnabled ? addNameTag(result, name, secondary, "#ffffff", "#111827") : result;
  }, [background, brightness, contrast, crop, name, nameTagEnabled, rotation, secondary, saturation]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    void loadImage(file).then(({ url, image: loaded }) => {
      setImageUrl((previous) => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      setImage(loaded);
      setCrop(null);
      setZoom(1);
      setRotation(0);
      setError("");
    }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Could not load the image."));
  }

  function handleCropChange(area: CropArea | null) {
    if (!area || !image) return;
    if (cropTimer.current) clearTimeout(cropTimer.current);
    cropTimer.current = setTimeout(() => setCrop(cropImage(image, area)), 80);
  }

  function resetPhoto() {
    if (imageUrl) URL.revokeObjectURL(imageUrl);
    setImageUrl(null);
    setImage(null);
    setCrop(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  function downloadPng() {
    if (!finalCanvas) return;
    const scale = 300 / 25.4;
    const sheet = document.createElement("canvas");
    sheet.width = Math.round(paper.widthMm * scale);
    sheet.height = Math.round(paper.heightMm * scale);
    const context = sheet.getContext("2d");
    if (!context) return;
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, sheet.width, sheet.height);
    cells.forEach((cell) => context.drawImage(finalCanvas, cell.xMm * scale, cell.yMm * scale, cell.widthMm * scale, cell.heightMm * scale));
    const link = document.createElement("a");
    link.download = "id-photo-sheet-300dpi.png";
    link.href = sheet.toDataURL("image/png");
    link.click();
  }

  async function downloadPdf() {
    if (!finalCanvas) return;
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF({ unit: "mm", format: [paper.widthMm, paper.heightMm], orientation: paper.widthMm > paper.heightMm ? "landscape" : "portrait" });
    cells.forEach((cell) => {
      pdf.addImage(finalCanvas.toDataURL("image/jpeg", 0.95), "JPEG", cell.xMm, cell.yMm, cell.widthMm, cell.heightMm);
      if (cutLines) pdf.rect(cell.xMm, cell.yMm, cell.widthMm, cell.heightMm, "S");
    });
    pdf.save("id-photo-sheet.pdf");
  }

  function printSheet() {
    if (!finalCanvas) return;
    const imageData = finalCanvas.toDataURL("image/jpeg", 0.95);
    const html = `<style>@page{size:${paper.widthMm}mm ${paper.heightMm}mm;margin:0}html,body{margin:0;padding:0}.sheet{position:relative;width:${paper.widthMm}mm;height:${paper.heightMm}mm}.cell{position:absolute;overflow:hidden}.cell img{width:100%;height:100%;object-fit:cover;display:block}</style><div class="sheet">${cells.map((cell) => `<div class="cell" style="left:${cell.xMm}mm;top:${cell.yMm}mm;width:${cell.widthMm}mm;height:${cell.heightMm}mm"><img src="${imageData}" alt=""></div>`).join("")}</div>`;
    const popup = window.open("", "_blank", "noopener,noreferrer");
    if (!popup) return;
    popup.document.write(html);
    popup.document.close();
    popup.onload = () => popup.print();
  }

  return <main className="mx-auto w-full max-w-[1440px] px-4 py-8 text-ink md:px-7">
    <div className="mb-6"><p className="text-[11px] font-bold uppercase tracking-[.16em] text-primary">Creative tools / photo studio</p><h1 className="mt-2 font-heading text-4xl font-extrabold tracking-[-.055em]">ID Photo Print</h1><p className="mt-2 text-sm text-muted-foreground">Create correctly sized ID photos and print a full sheet locally.</p></div>
    <div className="mb-6 grid grid-cols-3 gap-2" aria-label="ID photo workflow">{["Upload & Crop", "Paper & Layout", "Preview & Print"].map((label, index) => <button key={label} type="button" onClick={() => setActiveStep(index + 1)} className={`rounded border px-3 py-2 text-left text-xs ${activeStep === index + 1 ? "border-primary bg-primary/10" : "border-line text-muted-foreground"}`}><b className="mr-1 text-primary">{index + 1}</b>{label}</button>)}</div>
    <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
      <aside className="space-y-4">
        {activeStep === 1 && <section className="space-y-4 rounded border border-line bg-paper p-4">
          {!imageUrl ? <button type="button" onClick={() => inputRef.current?.click()} onDragOver={(event) => { event.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={(event) => { event.preventDefault(); setDragOver(false); handleFile(event.dataTransfer.files?.[0]); }} className={`flex min-h-44 w-full flex-col items-center justify-center gap-2 rounded border-2 border-dashed p-6 text-center ${dragOver ? "border-primary bg-primary/10" : "border-line"}`}><ImagePlus className="text-muted-foreground" /><b>Upload customer photo</b><span className="text-xs text-muted-foreground">Drag and drop or click to choose</span><input ref={inputRef} hidden type="file" accept="image/*" onChange={(event) => handleFile(event.target.files?.[0])} /></button> : <><Cropper className="h-72" image={imageUrl} aspectRatio={photoSize(sizeId).widthMm / photoSize(sizeId).heightMm} zoom={zoom} minZoom={1} maxZoom={3} onZoomChange={setZoom} onCropChange={handleCropChange}><CropperImage /><CropperArea /></Cropper><div className="flex items-center gap-3"><Slider value={[zoom]} min={1} max={3} step={0.1} onValueChange={(value) => setZoom(value[0])} aria-label="Crop zoom" /><span className="text-xs">{zoom.toFixed(1)}×</span></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => setRotation((value) => (value + 90) % 360)}><RotateCw className="mr-1 h-3.5 w-3.5" />Rotate</Button><Button variant="outline" size="sm" onClick={() => { setZoom(1); setRotation(0); }}><RotateCcw className="mr-1 h-3.5 w-3.5" />Reset view</Button><Button variant="outline" size="sm" onClick={resetPhoto}>Change photo</Button></div></>}
          {error && <p className="text-xs text-red-600">{error}</p>}
          {image && (image.naturalWidth < 900 || image.naturalHeight < 900) && <p className="text-xs text-amber-700">This image may look soft when printed at 300 DPI.</p>}
        </section>}
        {activeStep === 1 && imageUrl && <section className="space-y-3 rounded border border-line bg-paper p-4"><h2 className="flex items-center gap-2 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4" />Photo adjustments</h2>{[["Brightness", brightness, setBrightness], ["Contrast", contrast, setContrast], ["Color", saturation, setSaturation]].map(([label, value, setter]) => <label key={label as string} className="flex items-center gap-2 text-xs"><span className="w-16">{label as string}</span><Slider value={[value as number]} min={label === "Color" ? 0 : 50} max={label === "Color" ? 200 : 150} step={1} onValueChange={(next) => (setter as React.Dispatch<React.SetStateAction<number>>)(next[0])} aria-label={label as string} /><b>{value as number}%</b></label>)}</section>}
        {activeStep === 2 && <section className="space-y-4 rounded border border-line bg-paper p-4"><h2 className="text-sm font-semibold">Paper and quantity</h2><div className="grid grid-cols-2 gap-2">{PAPER_SIZES.map((paperOption) => <button key={paperOption.id} type="button" onClick={() => setPaperId(paperOption.id)} className={`rounded border p-2 text-left text-xs ${paperId === paperOption.id ? "border-primary bg-primary/10" : "border-line"}`}>{paperOption.label}<span className="block text-[10px] text-muted-foreground">{paperOption.widthMm} × {paperOption.heightMm} mm</span></button>)}</div><div className="flex gap-2"><Button className="flex-1" variant={orientation === "portrait" ? "secondary" : "outline"} onClick={() => setOrientation("portrait")}>Portrait</Button><Button className="flex-1" variant={orientation === "landscape" ? "secondary" : "outline"} onClick={() => setOrientation("landscape")}>Landscape</Button></div><div className="grid grid-cols-3 gap-2">{(Object.keys(quantities) as (keyof QuantityState)[]).map((id) => <label key={id} className="text-center text-xs"><span className="mb-1 block font-semibold">{id === "passport" ? "Passport" : id.replace("in", " in")}</span><input className="h-9 w-full rounded border border-line bg-background text-center" type="number" min={0} max={9999} value={quantities[id]} onChange={(event) => setQuantities((current) => ({ ...current, [id]: Math.max(0, Number(event.target.value) || 0) }))} /></label>)}</div><label className="flex justify-between text-xs">Margin <b>{marginMm} mm</b></label><Slider value={[marginMm]} min={0} max={15} step={1} onValueChange={(value) => setMarginMm(value[0])} aria-label="Print margin" /><label className="flex justify-between text-xs">Spacing <b>{gapMm} mm</b></label><Slider value={[gapMm]} min={0} max={10} step={0.5} onValueChange={(value) => setGapMm(value[0])} aria-label="Photo spacing" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={cutLines} onChange={(event) => setCutLines(event.target.checked)} />Show cut lines</label><div className="flex gap-2">{colorOptions.map(([label, value]) => <button key={label} type="button" title={label} onClick={() => setBackground(value)} className={`h-7 w-7 rounded-full border-2 ${background === value ? "border-primary" : "border-line"}`} style={{ background: value }} />)}</div></section>}
        {activeStep === 2 && <section className="space-y-3 rounded border border-line bg-paper p-4"><h2 className="text-sm font-semibold">Name tag banner</h2><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={nameTagEnabled} onChange={(event) => setNameTagEnabled(event.target.checked)} />Add name tag</label>{nameTagEnabled && <><input className="h-9 w-full rounded border border-line bg-background px-2 text-sm" placeholder="Full name" value={name} onChange={(event) => setName(event.target.value)} /><input className="h-9 w-full rounded border border-line bg-background px-2 text-sm" placeholder="Optional secondary text" value={secondary} onChange={(event) => setSecondary(event.target.value)} /></>}</section>}
        {activeStep === 3 && <div className="flex gap-2"><Button className="flex-1" disabled={!finalCanvas} onClick={printSheet}><Printer className="mr-1 h-4 w-4" />Print</Button><Button className="flex-1" variant="outline" disabled={!finalCanvas} onClick={() => void downloadPdf()}><Download className="mr-1 h-4 w-4" />PDF</Button><Button className="flex-1" variant="outline" disabled={!finalCanvas} onClick={downloadPng}>PNG</Button></div>}
        <div className="flex gap-2"><Button className="flex-1" variant="outline" disabled={activeStep === 1} onClick={() => setActiveStep((step) => step - 1)}>Back</Button>{activeStep < 3 && <Button className="flex-1" disabled={activeStep === 1 && !imageUrl} onClick={() => setActiveStep((step) => step + 1)}>Next</Button>}</div>
      </aside>
      <section className="overflow-auto rounded border border-line bg-muted/30 p-4"><div className="mb-3 flex flex-wrap gap-4 text-xs text-muted-foreground"><span><b className="text-foreground">{cells.length}</b> photos</span><span>{paper.widthMm.toFixed(1)} × {paper.heightMm.toFixed(1)} mm</span><span>{orientation}</span></div><div className="relative mx-auto bg-white shadow-sm" style={{ width: `${paper.widthMm}mm`, height: `${paper.heightMm}mm` }}>{cells.map((cell: SheetCell) => <div key={cell.id} className={`absolute overflow-hidden ${cutLines ? "outline outline-1 outline-dashed outline-gray-400" : ""}`} style={{ left: `${cell.xMm}mm`, top: `${cell.yMm}mm`, width: `${cell.widthMm}mm`, height: `${cell.heightMm}mm` }}>{finalCanvas && <img src={finalCanvas.toDataURL("image/jpeg", 0.95)} alt="" className="h-full w-full object-cover" />}</div>)}</div><p className="mt-4 text-xs text-muted-foreground">Print using Actual size / 100%. Disable Fit to page to preserve dimensions.</p></section>
    </div>
  </main>;
}
