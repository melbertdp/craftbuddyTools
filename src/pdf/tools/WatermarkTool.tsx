"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToolShell } from "@/pdf/components/common/ToolShell";
import { StatusBanner } from "@/pdf/components/common/JobProgress";
import { OverlayPreview } from "@/pdf/components/common/OverlayPreview";
import { PdfUploader } from "@/pdf/components/upload/PdfUploader";
import { FONT_FAMILIES } from "@/pdf/components/editor/fabric-bridge";
import { toUserMessage } from "@/pdf/config/errors";
import { buildWatermarkObjects, POSITIONS, type StampPosition, type WatermarkOptions } from "@/pdf/core/enhancement-engine";
import { exportPages } from "@/pdf/core/export-service";
import { downloadBytes } from "@/pdf/core/download";
import { exportFileName } from "@/pdf/core/filenames";
import { parsePageList } from "@/pdf/core/ranges";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import type { ImageFormat } from "@/pdf/core/image";
import { runJob } from "@/pdf/stores/job-store";
import {
  releaseRemovedDocuments,
  useReleaseDocumentsOnUnmount,
  useResetPdfWorkspaceOnMount,
} from "@/pdf/components/common/usePdfToolReset";

const POSITION_LABELS: Record<StampPosition, string> = {
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
  "middle-left": "Middle left",
  center: "Center",
  "middle-right": "Middle right",
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right",
};

export function WatermarkTool() {
  const [documents, setDocuments] = React.useState<LoadedDocument[]>([]);
  const [kind, setKind] = React.useState<"text" | "image">("text");
  const [text, setText] = React.useState("CONFIDENTIAL");
  const [dataUrl, setDataUrl] = React.useState<string>();
  const [format, setFormat] = React.useState<ImageFormat>("png");
  const [fontFamily, setFontFamily] = React.useState(FONT_FAMILIES[0].value);
  const [fontSize, setFontSize] = React.useState(48);
  const [color, setColor] = React.useState("#64748b");
  const [opacity, setOpacity] = React.useState(0.3);
  const [rotation, setRotation] = React.useState(45);
  const [scale, setScale] = React.useState(1);
  const [position, setPosition] = React.useState<StampPosition>("center");
  const [tiled, setTiled] = React.useState(false);
  const [margin, setMargin] = React.useState(24);
  const [rangeInput, setRangeInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();
  const fileRef = React.useRef<HTMLInputElement>(null);

  // Each tool instance starts empty; never show the previous tool's upload.
  useResetPdfWorkspaceOnMount();
  useReleaseDocumentsOnUnmount(documents);

  const handleDocumentsChange = (next: LoadedDocument[]) => {
    releaseRemovedDocuments(documents, next);
    setDocuments(next);
  };

  const document = documents[0];

  const pageNumbers = React.useMemo(() => {
    if (!document) return [];
    if (!rangeInput.trim()) return document.pages.map((_, index) => index + 1);
    try {
      return parsePageList(rangeInput, document.pages.length);
    } catch {
      return [];
    }
  }, [document, rangeInput]);

  const options: WatermarkOptions = {
    kind,
    text,
    dataUrl,
    format,
    fontFamily,
    fontSize,
    color,
    opacity,
    rotation,
    scale,
    position,
    tiled,
    pageNumbers: [],
    margin,
  };

  const previewPage = React.useMemo(() => {
    if (!document) return undefined;
    if (pageNumbers.length === 0) return document.pages[0];
    return document.pages[pageNumbers[0] - 1];
  }, [document, pageNumbers]);

  const previewObjects = React.useMemo(() => {
    if (!previewPage) return [];
    const built = buildWatermarkObjects([previewPage], { ...options, pageNumbers: [] });
    return built[previewPage.id] ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPage, kind, text, dataUrl, fontFamily, fontSize, color, opacity, rotation, scale, position, tiled, margin]);

  const handleImage = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) {
      setError("Watermark images must be 20 MB or smaller.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result);
      const match = /^data:image\/(png|jpeg|jpg|webp)/i.exec(result);
      const detected = match ? (match[1].toLowerCase() === "jpg" ? "jpeg" : match[1].toLowerCase()) : "png";
      setDataUrl(result);
      setFormat(detected as ImageFormat);
    };
    reader.readAsDataURL(file);
  };

  const process = async () => {
    if (!document) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      if (kind === "text" && !text.trim()) {
        throw new Error("Enter watermark text.");
      }
      if (kind === "image" && !dataUrl) {
        throw new Error("Choose a watermark image.");
      }
      const targetPages =
        pageNumbers.length > 0 ? pageNumbers.map((number) => document.pages[number - 1]) : document.pages;
      const objectsById = buildWatermarkObjects(targetPages, { ...options, pageNumbers: [] });
      const bytes = await runJob({
        label: "Adding watermark",
        task: async (context) =>
          exportPages({
            pages: document.pages,
            sources: [document.source],
            objectsByPageId: objectsById,
            metadata: document.metadata,
            onProgress: (completed, total) =>
              context.onProgress((completed / total) * 100, `Page ${completed} of ${total}`),
          }),
      });
      downloadBytes(bytes, exportFileName(document.source.name, "watermarked"));
      setNotice(`Watermark applied to ${targetPages.length} page${targetPages.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell title="Watermark PDF" description="Add a text or image watermark with live preview.">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <PdfUploader scope="general" value={documents} onChange={handleDocumentsChange} />

          {document && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={kind === "text" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setKind("text")}
                >
                  Text
                </Button>
                <Button
                  type="button"
                  variant={kind === "image" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setKind("image")}
                >
                  Image
                </Button>
              </div>

              {kind === "text" ? (
                <div className="space-y-1.5">
                  <Label htmlFor="watermark-text">Watermark text</Label>
                  <Input id="watermark-text" value={text} onChange={(event) => setText(event.target.value)} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label>Watermark image</Label>
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                    Choose image
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    className="sr-only"
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void handleImage(file);
                      event.target.value = "";
                    }}
                  />
                  {dataUrl && <img src={dataUrl} alt="Watermark" className="mt-2 max-h-24 object-contain" />}
                </div>
              )}

              <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                {kind === "text" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Font</Label>
                      <Select value={fontFamily} onValueChange={setFontFamily}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {FONT_FAMILIES.map((font) => (
                            <SelectItem key={font.value} value={font.value}>
                              {font.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="wm-size">Font size (pt)</Label>
                      <Input
                        id="wm-size"
                        type="number"
                        min={8}
                        max={200}
                        value={fontSize}
                        onChange={(event) => setFontSize(Number(event.target.value) || 12)}
                      />
                    </div>
                  </>
                )}
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select value={position} onValueChange={(value) => setPosition(value as StampPosition)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITIONS.map((entry) => (
                        <SelectItem key={entry} value={entry}>
                          {POSITION_LABELS[entry]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="wm-margin">Margin (pt)</Label>
                  <Input
                    id="wm-margin"
                    type="number"
                    min={0}
                    value={margin}
                    onChange={(event) => setMargin(Math.max(0, Number(event.target.value) || 0))}
                  />
                </div>
              </div>

              {kind === "text" && (
                <div className="space-y-1.5">
                  <Label>Color</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={color}
                      onChange={(event) => setColor(event.target.value)}
                      className="h-9 w-12 cursor-pointer rounded-md border border-border p-1"
                      aria-label="Watermark color"
                    />
                    <span className="font-mono text-xs text-muted-foreground">{color}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Opacity: {Math.round(opacity * 100)}%</Label>
                  <Slider value={[opacity * 100]} min={5} max={100} step={1} onValueChange={([value]) => setOpacity(value / 100)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Rotation: {Math.round(rotation)}°</Label>
                  <Slider value={[rotation]} min={-90} max={90} step={1} onValueChange={([value]) => setRotation(value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Scale: {scale.toFixed(1)}×</Label>
                  <Slider value={[scale * 100]} min={25} max={300} step={5} onValueChange={([value]) => setScale(value / 100)} />
                </div>
                <div className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <Label htmlFor="wm-tiled" className="cursor-pointer">
                    Tiled / repeated
                  </Label>
                  <Switch id="wm-tiled" checked={tiled} onCheckedChange={setTiled} />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="wm-range">Pages (blank = all)</Label>
                <Input
                  id="wm-range"
                  value={rangeInput}
                  onChange={(event) => setRangeInput(event.target.value)}
                  placeholder="1-10, 15"
                />
                {rangeInput.trim() && pageNumbers.length === 0 && (
                  <p className="text-xs text-destructive">Invalid page range.</p>
                )}
              </div>

              {error && <StatusBanner tone="warning">{error}</StatusBanner>}
              {notice && <StatusBanner tone="success">{notice}</StatusBanner>}

              <Button type="button" size="lg" className="w-full" disabled={busy} onClick={process}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                Apply watermark
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-muted-foreground">Live preview</Label>
          <div className="rounded-xl border border-border bg-muted/40 p-4">
            {document && previewPage ? (
              <OverlayPreview
                page={previewPage}
                bytes={document.source.bytes}
                sourceId={document.source.id}
                objects={previewObjects}
              />
            ) : (
              <div className="grid h-64 place-items-center text-sm text-muted-foreground">
                Upload a PDF to preview the watermark.
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
