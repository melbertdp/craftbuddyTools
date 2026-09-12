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
import { ToolShell } from "@/pdf/components/common/ToolShell";
import { StatusBanner } from "@/pdf/components/common/JobProgress";
import { ImageUploader, type UploadedImage } from "@/pdf/components/upload/ImageUploader";
import { toUserMessage } from "@/pdf/config/errors";
import { imagesToPdf } from "@/pdf/core/conversion-engine";
import { downloadBytes } from "@/pdf/core/download";
import { safeBaseName } from "@/pdf/core/filenames";
import {
  PAGE_SIZE_PRESETS,
  type ImagePlacement,
  type PageOrientation,
  type PageSizePreset,
} from "@/pdf/core/layout";
import type { ImageFormat } from "@/pdf/core/image";
import { runJob } from "@/pdf/stores/job-store";

interface ImageToPdfToolProps {
  title: string;
  description: string;
  accept?: string;
  allowedFormats?: ImageFormat[];
  outputSuffix: string;
}

export function ImageToPdfTool({
  title,
  description,
  accept,
  allowedFormats,
  outputSuffix,
}: ImageToPdfToolProps) {
  const [images, setImages] = React.useState<UploadedImage[]>([]);
  const [pageSize, setPageSize] = React.useState<PageSizePreset["id"]>("a4");
  const [orientation, setOrientation] = React.useState<PageOrientation | "auto">("auto");
  const [placement, setPlacement] = React.useState<ImagePlacement>("fit");
  const [margin, setMargin] = React.useState(24);
  const [background, setBackground] = React.useState("#ffffff");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();

  const process = async () => {
    if (images.length === 0) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const bytes = await runJob({
        label: "Creating PDF",
        task: async (context) =>
          imagesToPdf({
            images: images.map((entry) => entry.image),
            pageSize,
            orientation,
            placement,
            margin,
            background,
            onProgress: (completed, total) =>
              context.onProgress((completed / total) * 100, `Image ${completed} of ${total}`),
          }),
      });
      const base = safeBaseName(images[0]?.name ?? "images");
      downloadBytes(bytes, `${base}-${outputSuffix}.pdf`);
      setNotice(`Created a PDF from ${images.length} image${images.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell title={title} description={description}>
      <div className="mx-auto max-w-2xl space-y-4">
        <ImageUploader
          value={images}
          onChange={setImages}
          accept={accept}
          allowedFormats={allowedFormats}
        />

        {images.length > 0 && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <div className="space-y-1.5">
                <Label>Page size</Label>
                <Select value={pageSize} onValueChange={(value) => setPageSize(value as PageSizePreset["id"])}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAGE_SIZE_PRESETS.map((preset) => (
                      <SelectItem key={preset.id} value={preset.id}>
                        {preset.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Orientation</Label>
                <Select
                  value={orientation}
                  onValueChange={(value) => setOrientation(value as PageOrientation | "auto")}
                  disabled={pageSize === "original"}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Match image</SelectItem>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Image placement</Label>
                <Select value={placement} onValueChange={(value) => setPlacement(value as ImagePlacement)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fit">Fit (contain)</SelectItem>
                    <SelectItem value="fill">Fill (cover, may crop)</SelectItem>
                    <SelectItem value="original">Original size</SelectItem>
                    <SelectItem value="stretch">Stretch to page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="margin">Margin (pt)</Label>
                <Input
                  id="margin"
                  type="number"
                  min={0}
                  max={144}
                  value={margin}
                  onChange={(event) => setMargin(Math.max(0, Number(event.target.value) || 0))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="background">Page background</Label>
                <div className="flex items-center gap-2">
                  <input
                    id="background"
                    type="color"
                    value={background}
                    onChange={(event) => setBackground(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-border p-1"
                  />
                  <span className="font-mono text-xs text-muted-foreground">{background}</span>
                </div>
              </div>
            </div>

            {error && <StatusBanner tone="warning">{error}</StatusBanner>}
            {notice && <StatusBanner tone="success">{notice}</StatusBanner>}

            <Button type="button" size="lg" className="w-full" disabled={busy} onClick={process}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              Create PDF
            </Button>
          </div>
        )}

        {!images.length && error && <StatusBanner tone="warning">{error}</StatusBanner>}
      </div>
    </ToolShell>
  );
}
