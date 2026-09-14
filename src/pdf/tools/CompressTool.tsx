"use client";

import * as React from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ToolShell } from "@/pdf/components/common/ToolShell";
import { StatusBanner } from "@/pdf/components/common/JobProgress";
import { PdfUploader } from "@/pdf/components/upload/PdfUploader";
import { formatBytes } from "@/pdf/config/limits";
import { toUserMessage } from "@/pdf/config/errors";
import {
  compressionEngine,
  type CompressionLevel,
  type CompressionResult,
} from "@/pdf/core/compression-engine";
import { downloadBytes } from "@/pdf/core/download";
import { exportFileName } from "@/pdf/core/filenames";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import { runJob } from "@/pdf/stores/job-store";
import {
  releaseRemovedDocuments,
  useReleaseDocumentsOnUnmount,
  useResetPdfWorkspaceOnMount,
} from "@/pdf/components/common/usePdfToolReset";
import { cn } from "@/lib/utils";

const LEVELS: { value: CompressionLevel; label: string; description: string }[] = [
  { value: "low", label: "Low compression", description: "Structural optimization only. Safest for quality." },
  { value: "recommended", label: "Recommended", description: "Balanced size and quality." },
  { value: "high", label: "High compression", description: "Smallest size - images are downsampled." },
];

export function CompressTool() {
  const [documents, setDocuments] = React.useState<LoadedDocument[]>([]);
  const [level, setLevel] = React.useState<CompressionLevel>("recommended");
  const [removeMetadata, setRemoveMetadata] = React.useState(false);
  const [downsampling, setDownsampling] = React.useState(true);
  const [jpegQuality, setJpegQuality] = React.useState(0.7);
  const [targetDpi, setTargetDpi] = React.useState(120);
  const [result, setResult] = React.useState<CompressionResult>();
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

  const compress = async () => {
    if (!document) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    setResult(undefined);
    try {
      const outcome = await runJob({
        label: "Compressing PDF",
        task: async (context) =>
          compressionEngine.compress(document.source.bytes, {
            level,
            removeMetadata,
            downsampling,
            jpegQuality,
            targetDpi,
            onProgress: (completed, total) =>
              context.onProgress((completed / total) * 100, `Rendering page ${completed} of ${total}`),
          }),
      });
      setResult(outcome);
      if (outcome.message) setNotice(outcome.message);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const download = () => {
    if (!document || !result) return;
    downloadBytes(result.bytes, exportFileName(document.source.name, "compressed"));
  };

  const savedPercent = result ? Math.max(0, Math.round(result.reductionRatio * 100)) : 0;

  return (
    <ToolShell title="Compress PDF" description="Reduce file size with honest before/after results.">
      <div className="mx-auto max-w-2xl space-y-4">
        <PdfUploader scope="general" value={documents} onChange={handleDocumentsChange} />

        {document && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <div className="space-y-2">
              {LEVELS.map((entry) => (
                <label
                  key={entry.value}
                  className={cn(
                    "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                    level === entry.value ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40",
                  )}
                >
                  <input
                    type="radio"
                    name="compression-level"
                    className="mt-1"
                    checked={level === entry.value}
                    onChange={() => setLevel(entry.value)}
                  />
                  <span>
                    <span className="block text-sm font-medium text-foreground">{entry.label}</span>
                    <span className="block text-xs text-muted-foreground">{entry.description}</span>
                  </span>
                </label>
              ))}
            </div>

            <details className="rounded-lg border border-border p-3">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">Advanced settings</summary>
              <div className="mt-3 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="downsampling" className="cursor-pointer">
                    Allow image downsampling / re-rendering
                  </Label>
                  <Switch id="downsampling" checked={downsampling} onCheckedChange={setDownsampling} />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="remove-metadata" className="cursor-pointer">
                    Remove metadata
                  </Label>
                  <Switch id="remove-metadata" checked={removeMetadata} onCheckedChange={setRemoveMetadata} />
                </div>
                <div className="space-y-1.5">
                  <Label>JPEG quality: {Math.round(jpegQuality * 100)}%</Label>
                  <Slider
                    value={[jpegQuality * 100]}
                    min={30}
                    max={95}
                    step={1}
                    onValueChange={([value]) => setJpegQuality(value / 100)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="target-dpi">Target resolution (DPI)</Label>
                  <Input
                    id="target-dpi"
                    type="number"
                    min={36}
                    max={300}
                    value={targetDpi}
                    onChange={(event) => setTargetDpi(Number(event.target.value) || 72)}
                  />
                </div>
              </div>
            </details>

            {error && <StatusBanner tone="warning">{error}</StatusBanner>}
            {notice && <StatusBanner tone="info">{notice}</StatusBanner>}

            {result && (
              <div className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-muted/30 p-3 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Original</p>
                  <p className="text-sm font-semibold">{formatBytes(result.originalSize)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Compressed</p>
                  <p className="text-sm font-semibold">{formatBytes(result.compressedSize)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saved</p>
                  <p className={cn("text-sm font-semibold", savedPercent > 0 ? "text-success" : "text-muted-foreground")}>
                    {savedPercent}%
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button type="button" size="lg" className="flex-1" disabled={busy} onClick={compress}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                Compress
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={!result} onClick={download}>
                <Download className="size-4" aria-hidden /> Download
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              No guaranteed reduction. Lossy compression re-renders pages as images and can reduce text sharpness.
            </p>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
