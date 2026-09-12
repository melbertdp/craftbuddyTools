"use client";

import * as React from "react";
import { Eraser, Type as TypeIcon, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { blobToDataUrl } from "@/pdf/core/image";
import { SIGNATURE_FONTS } from "./fabric-bridge";
import { cn } from "@/lib/utils";

interface SignatureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccept: (dataUrl: string, aspect: number) => void;
}

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 220;

function trimCanvas(source: HTMLCanvasElement): string {
  const context = source.getContext("2d");
  if (!context) return source.toDataURL("image/png");
  const { data } = context.getImageData(0, 0, source.width, source.height);
  let minX = source.width;
  let minY = source.height;
  let maxX = 0;
  let maxY = 0;
  let found = false;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const alpha = data[(y * source.width + x) * 4 + 3];
      if (alpha > 10) {
        found = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }
  if (!found) return source.toDataURL("image/png");
  const padding = 8;
  const width = Math.min(source.width, maxX - minX + padding * 2);
  const height = Math.min(source.height, maxY - minY + padding * 2);
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const targetContext = target.getContext("2d");
  if (!targetContext) return source.toDataURL("image/png");
  targetContext.drawImage(
    source,
    Math.max(0, minX - padding),
    Math.max(0, minY - padding),
    width,
    height,
    0,
    0,
    width,
    height,
  );
  return target.toDataURL("image/png");
}

export function SignatureDialog({ open, onOpenChange, onAccept }: SignatureDialogProps) {
  const [tab, setTab] = React.useState("draw");
  const [color, setColor] = React.useState("#0f172a");
  const [thickness, setThickness] = React.useState(3);
  const [typed, setTyped] = React.useState("");
  const [fontIndex, setFontIndex] = React.useState(0);
  const [upload, setUpload] = React.useState<{ dataUrl: string; aspect: number }>();
  const [uploadName, setUploadName] = React.useState("");
  const drawCanvas = React.useRef<HTMLCanvasElement>(null);
  const drawing = React.useRef(false);
  const typedCanvas = React.useRef<HTMLCanvasElement>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const resetDrawing = React.useCallback(() => {
    const canvas = drawCanvas.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  React.useEffect(() => {
    if (open) {
      resetDrawing();
      setUpload(undefined);
      setTyped("");
    }
  }, [open, resetDrawing]);

  const drawAt = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawCanvas.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((event.clientY - rect.top) / rect.height) * canvas.height;
    const context = canvas.getContext("2d");
    if (!context) return;
    if (!drawing.current) {
      context.beginPath();
      context.moveTo(x, y);
      drawing.current = true;
    } else {
      context.lineTo(x, y);
    }
    context.strokeStyle = color;
    context.lineWidth = thickness * 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.stroke();
  };

  const typedDataUrl = React.useCallback((): string | undefined => {
    const canvas = typedCanvas.current;
    if (!canvas || !typed.trim()) return undefined;
    const context = canvas.getContext("2d");
    if (!context) return undefined;
    context.clearRect(0, 0, canvas.width, canvas.height);
    const font = SIGNATURE_FONTS[fontIndex];
    context.fillStyle = color;
    context.font = `${font.italic ? "italic " : ""}${font.weight} 96px ${font.value}`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(typed, canvas.width / 2, canvas.height / 2);
    return trimCanvas(canvas);
  }, [typed, fontIndex, color]);

  React.useEffect(() => {
    void typedDataUrl();
  }, [typedDataUrl]);

  const handleUpload = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) return;
    const dataUrl = await blobToDataUrl(file);
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("bad image"));
      value.src = dataUrl;
    });
    setUpload({ dataUrl, aspect: image.naturalWidth / Math.max(1, image.naturalHeight) });
    setUploadName(file.name);
  };

  const accept = () => {
    if (tab === "draw") {
      const canvas = drawCanvas.current;
      if (!canvas) return;
      const dataUrl = trimCanvas(canvas);
      const image = new Image();
      image.onload = () =>
        onAccept(dataUrl, image.naturalWidth / Math.max(1, image.naturalHeight));
      image.src = dataUrl;
      onOpenChange(false);
      return;
    }
    if (tab === "type") {
      const dataUrl = typedDataUrl();
      if (!dataUrl) return;
      const image = new Image();
      image.onload = () =>
        onAccept(dataUrl, image.naturalWidth / Math.max(1, image.naturalHeight));
      image.src = dataUrl;
      onOpenChange(false);
      return;
    }
    if (upload) {
      onAccept(upload.dataUrl, upload.aspect);
      onOpenChange(false);
    }
  };

  const canAccept =
    tab === "draw" || (tab === "type" && typed.trim().length > 0) || (tab === "upload" && Boolean(upload));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create signature</DialogTitle>
          <DialogDescription>
            This adds a visual signature to the document. It is not a certificate-based digital signature.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="draw">
              <Eraser className="mr-1.5 size-3.5" aria-hidden /> Draw
            </TabsTrigger>
            <TabsTrigger value="type">
              <TypeIcon className="mr-1.5 size-3.5" aria-hidden /> Type
            </TabsTrigger>
            <TabsTrigger value="upload">
              <Upload className="mr-1.5 size-3.5" aria-hidden /> Upload
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw" className="mt-3 space-y-3">
            <canvas
              ref={drawCanvas}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              onPointerDown={(event) => {
                drawing.current = false;
                event.currentTarget.setPointerCapture(event.pointerId);
                drawAt(event);
              }}
              onPointerMove={(event) => {
                if (event.buttons === 0) return;
                drawAt(event);
              }}
              onPointerUp={() => {
                drawing.current = false;
              }}
              className="w-full touch-none rounded-lg border border-dashed border-border bg-white"
              style={{ aspectRatio: `${CANVAS_WIDTH} / ${CANVAS_HEIGHT}` }}
              aria-label="Signature drawing area"
            />
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="h-8 w-10 cursor-pointer rounded border border-border p-1"
                aria-label="Signature color"
              />
              <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
                Thickness
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={thickness}
                  onChange={(event) => setThickness(Number(event.target.value))}
                  className="flex-1"
                />
              </label>
              <Button type="button" variant="outline" size="sm" onClick={resetDrawing}>
                Clear
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="type" className="mt-3 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="signature-name">Your name</Label>
              <Input
                id="signature-name"
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
                placeholder="Type your name"
              />
            </div>
            <Select value={String(fontIndex)} onValueChange={(value) => setFontIndex(Number(value))}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SIGNATURE_FONTS.map((font, index) => (
                  <SelectItem key={font.label} value={String(index)}>
                    {font.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid place-items-center rounded-lg border border-dashed border-border bg-white p-4">
              {typed.trim() ? (
                <span
                  className="text-3xl text-foreground"
                  style={{
                    fontFamily: SIGNATURE_FONTS[fontIndex].value,
                    fontStyle: SIGNATURE_FONTS[fontIndex].italic ? "italic" : "normal",
                    fontWeight: SIGNATURE_FONTS[fontIndex].weight,
                    color,
                  }}
                >
                  {typed}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">Preview appears here</span>
              )}
            </div>
            <canvas ref={typedCanvas} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} className="hidden" />
          </TabsContent>

          <TabsContent value="upload" className="mt-3 space-y-3">
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden /> Choose image
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleUpload(file);
                event.target.value = "";
              }}
            />
            {upload ? (
              <div className="rounded-lg border border-border bg-white p-3">
                <img src={upload.dataUrl} alt={uploadName} className="mx-auto max-h-32 object-contain" />
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Upload a PNG, JPEG, or WebP signature image.</p>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" disabled={!canAccept} onClick={accept}>
            Add signature
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SignatureHint({ className }: { className?: string }) {
  return <span className={cn("text-xs text-muted-foreground", className)}>Visual signature, not cryptographic.</span>;
}
