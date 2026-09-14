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
import { ToolShell } from "@/pdf/components/common/ToolShell";
import { StatusBanner } from "@/pdf/components/common/JobProgress";
import { PdfUploader } from "@/pdf/components/upload/PdfUploader";
import { toUserMessage } from "@/pdf/config/errors";
import { parsePageList } from "@/pdf/core/ranges";
import { convertPdfToImages, QUALITY_PRESETS, type ImageOutputFormat, type QualityPreset } from "@/pdf/core/conversion-engine";
import { downloadBlob, downloadZip } from "@/pdf/core/download";
import { pageFileName, safeBaseName } from "@/pdf/core/filenames";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import { runJob } from "@/pdf/stores/job-store";
import {
  releaseRemovedDocuments,
  useReleaseDocumentsOnUnmount,
  useResetPdfWorkspaceOnMount,
} from "@/pdf/components/common/usePdfToolReset";
import { cn } from "@/lib/utils";

interface PdfToImageToolProps {
  defaultFormat: ImageOutputFormat;
  title: string;
  description: string;
}

export function PdfToImageTool({ defaultFormat, title, description }: PdfToImageToolProps) {
  const [documents, setDocuments] = React.useState<LoadedDocument[]>([]);
  const [format, setFormat] = React.useState<ImageOutputFormat>(defaultFormat);
  const [preset, setPreset] = React.useState<QualityPreset>("high");
  const [dpi, setDpi] = React.useState<number>();
  const [quality, setQuality] = React.useState(0.85);
  const [selection, setSelection] = React.useState<"all" | "range">("all");
  const [rangeInput, setRangeInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();

  // Each tool instance starts empty; never show the previous tool's upload.
  useResetPdfWorkspaceOnMount();
  useReleaseDocumentsOnUnmount(documents);

  const handleDocumentsChange = (next: LoadedDocument[]) => {
    releaseRemovedDocuments(documents, next);
    setDocuments(next);
  };

  const document = documents[0];

  const process = async () => {
    if (!document) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      let pageNumbers: number[];
      if (selection === "all") {
        pageNumbers = document.pages.map((_, index) => index + 1);
      } else {
        pageNumbers = parsePageList(rangeInput, document.pages.length);
      }
      const selectedPages = pageNumbers.map((number) => document.pages[number - 1]);
      const outputs = await runJob({
        label: "Converting PDF",
        task: async (context) => {
          const results = await convertPdfToImages({
            cacheKey: document.source.id,
            bytes: document.source.bytes,
            pages: selectedPages,
            format,
            qualityPreset: preset,
            dpi,
            jpegQuality: format === "png" ? undefined : quality,
            onProgress: (completed, total) =>
              context.onProgress((completed / total) * 100, `Page ${completed} of ${total}`),
          });
          return results;
        },
      });
      const base = safeBaseName(document.source.name);
      const extension = format === "jpeg" ? "jpg" : format;
      if (outputs.length === 1) {
        downloadBlob(outputs[0].blob, pageFileName(base, pageNumbers[0], extension));
        setNotice(`Exported 1 image (${Math.round(outputs[0].width)} × ${Math.round(outputs[0].height)}px).`);
      } else {
        await downloadZip(
          outputs.map((output, index) => ({
            filename: pageFileName(base, pageNumbers[index], extension),
            data: output.blob,
          })),
          `${base}-${extension}.zip`,
        );
        setNotice(`Exported ${outputs.length} images as ZIP.`);
      }
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell title={title} description={description}>
      <div className="mx-auto max-w-2xl space-y-4">
        <PdfUploader scope="general" value={documents} onChange={handleDocumentsChange} />

        {document && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
              <div className="space-y-1.5">
                <Label>Image format</Label>
                <Select value={format} onValueChange={(value) => setFormat(value as ImageOutputFormat)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="png">PNG (lossless)</SelectItem>
                    <SelectItem value="jpeg">JPEG (smaller)</SelectItem>
                    <SelectItem value="webp">WebP</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quality preset</Label>
                <Select
                  value={preset}
                  onValueChange={(value) => {
                    setPreset(value as QualityPreset);
                    setDpi(undefined);
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(QUALITY_PRESETS) as QualityPreset[]).map((key) => (
                      <SelectItem key={key} value={key}>
                        {QUALITY_PRESETS[key].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {format !== "png" && (
              <div className="space-y-1.5">
                <Label>Image quality: {Math.round(quality * 100)}%</Label>
                <Slider value={[quality * 100]} min={30} max={100} step={1} onValueChange={([value]) => setQuality(value / 100)} />
              </div>
            )}

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced</summary>
              <div className="mt-3 max-w-xs space-y-1.5">
                <Label htmlFor="dpi">Target DPI (leave blank to use preset)</Label>
                <Input
                  id="dpi"
                  type="number"
                  min={36}
                  max={600}
                  value={dpi ?? ""}
                  placeholder={String(QUALITY_PRESETS[preset].dpi)}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setDpi(Number.isFinite(value) && value > 0 ? value : undefined);
                  }}
                />
              </div>
            </details>

            <div className="space-y-2">
              <Label>Pages</Label>
              <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="page-selection"
                    checked={selection === "all"}
                    onChange={() => setSelection("all")}
                  />
                  All pages ({document.pages.length})
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="page-selection"
                    checked={selection === "range"}
                    onChange={() => setSelection("range")}
                  />
                  Page range
                </label>
                {selection === "range" && (
                  <Input
                    value={rangeInput}
                    onChange={(event) => setRangeInput(event.target.value)}
                    placeholder="1-5, 8, 10-12"
                    className="w-52"
                    aria-label="Page range"
                  />
                )}
              </div>
            </div>

            {error && <StatusBanner tone="warning">{error}</StatusBanner>}
            {notice && <StatusBanner tone="success">{notice}</StatusBanner>}

            <Button type="button" size="lg" disabled={busy} onClick={process} className={cn("w-full")}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
              Convert and download
            </Button>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
