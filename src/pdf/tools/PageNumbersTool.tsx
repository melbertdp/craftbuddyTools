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
import { OverlayPreview } from "@/pdf/components/common/OverlayPreview";
import { PdfUploader } from "@/pdf/components/upload/PdfUploader";
import { FONT_FAMILIES } from "@/pdf/components/editor/fabric-bridge";
import { toUserMessage } from "@/pdf/config/errors";
import {
  buildPageNumberObjects,
  type PageNumberFormat,
  type PageNumberOptions,
  type StampPosition,
} from "@/pdf/core/enhancement-engine";
import { exportPages } from "@/pdf/core/export-service";
import { downloadBytes } from "@/pdf/core/download";
import { exportFileName } from "@/pdf/core/filenames";
import { parsePageList } from "@/pdf/core/ranges";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import { runJob } from "@/pdf/stores/job-store";
import {
  releaseRemovedDocuments,
  useReleaseDocumentsOnUnmount,
  useResetPdfWorkspaceOnMount,
} from "@/pdf/components/common/usePdfToolReset";

const FORMAT_LABELS: { value: PageNumberFormat; label: string }[] = [
  { value: "n", label: "1" },
  { value: "page-n", label: "Page 1" },
  { value: "n-of-total", label: "1 of 20" },
  { value: "page-n-of-total", label: "Page 1 of 20" },
];

const POSITION_LABELS: Partial<Record<StampPosition, string>> = {
  "bottom-left": "Bottom left",
  "bottom-center": "Bottom center",
  "bottom-right": "Bottom right",
  "top-left": "Top left",
  "top-center": "Top center",
  "top-right": "Top right",
};

const POSITION_OPTIONS: StampPosition[] = [
  "bottom-center",
  "bottom-left",
  "bottom-right",
  "top-center",
  "top-left",
  "top-right",
];

export function PageNumbersTool() {
  const [documents, setDocuments] = React.useState<LoadedDocument[]>([]);
  const [format, setFormat] = React.useState<PageNumberFormat>("page-n-of-total");
  const [startNumber, setStartNumber] = React.useState(1);
  const [prefix, setPrefix] = React.useState("");
  const [suffix, setSuffix] = React.useState("");
  const [fontFamily, setFontFamily] = React.useState(FONT_FAMILIES[0].value);
  const [fontSize, setFontSize] = React.useState(11);
  const [color, setColor] = React.useState("#0f172a");
  const [position, setPosition] = React.useState<StampPosition>("bottom-center");
  const [margin, setMargin] = React.useState(28);
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

  const pageNumbers = React.useMemo(() => {
    if (!document) return [];
    if (!rangeInput.trim()) return document.pages.map((_, index) => index + 1);
    try {
      return parsePageList(rangeInput, document.pages.length);
    } catch {
      return [];
    }
  }, [document, rangeInput]);

  const options: PageNumberOptions = {
    format,
    startNumber,
    prefix,
    suffix,
    fontFamily,
    fontSize,
    color,
    position,
    margin,
    pageNumbers: [],
  };

  const previewPage = document ? document.pages[0] : undefined;
  const previewObjects = React.useMemo(() => {
    if (!previewPage) return [];
    const built = buildPageNumberObjects([previewPage], { ...options, pageNumbers: [] });
    return built[previewPage.id] ?? [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewPage, format, startNumber, prefix, suffix, fontFamily, fontSize, color, position, margin]);

  const process = async () => {
    if (!document) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const targetPages =
        pageNumbers.length > 0 ? pageNumbers.map((number) => document.pages[number - 1]) : document.pages;
      const objectsById = buildPageNumberObjects(targetPages, { ...options, pageNumbers: [] });
      const bytes = await runJob({
        label: "Adding page numbers",
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
      downloadBytes(bytes, exportFileName(document.source.name, "page-numbers"));
      setNotice(`Page numbers added to ${targetPages.length} page${targetPages.length === 1 ? "" : "s"}.`);
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell title="Add Page Numbers" description="Insert page numbers with flexible formats and placement.">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <PdfUploader scope="general" value={documents} onChange={handleDocumentsChange} />

          {document && (
            <div className="space-y-4 rounded-xl border border-border bg-card p-4">
              <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1">
                <div className="space-y-1.5">
                  <Label>Format</Label>
                  <Select value={format} onValueChange={(value) => setFormat(value as PageNumberFormat)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAT_LABELS.map((entry) => (
                        <SelectItem key={entry.value} value={entry.value}>
                          {entry.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pn-start">Starting number</Label>
                  <Input
                    id="pn-start"
                    type="number"
                    min={0}
                    value={startNumber}
                    onChange={(event) => setStartNumber(Number(event.target.value) || 0)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pn-prefix">Prefix</Label>
                  <Input id="pn-prefix" value={prefix} onChange={(event) => setPrefix(event.target.value)} placeholder="e.g. Draft – " />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pn-suffix">Suffix</Label>
                  <Input id="pn-suffix" value={suffix} onChange={(event) => setSuffix(event.target.value)} placeholder="e.g. – Confidential" />
                </div>
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
                  <Label htmlFor="pn-size">Font size (pt)</Label>
                  <Input
                    id="pn-size"
                    type="number"
                    min={6}
                    max={48}
                    value={fontSize}
                    onChange={(event) => setFontSize(Number(event.target.value) || 10)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Position</Label>
                  <Select value={position} onValueChange={(value) => setPosition(value as StampPosition)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {POSITION_OPTIONS.map((entry) => (
                        <SelectItem key={entry} value={entry}>
                          {POSITION_LABELS[entry]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pn-margin">Margin (pt)</Label>
                  <Input
                    id="pn-margin"
                    type="number"
                    min={0}
                    value={margin}
                    onChange={(event) => setMargin(Math.max(0, Number(event.target.value) || 0))}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Color</Label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(event) => setColor(event.target.value)}
                    className="h-9 w-12 cursor-pointer rounded-md border border-border p-1"
                    aria-label="Page number color"
                  />
                  <span className="font-mono text-xs text-muted-foreground">{color}</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pn-range">Pages (blank = all)</Label>
                <Input
                  id="pn-range"
                  value={rangeInput}
                  onChange={(event) => setRangeInput(event.target.value)}
                  placeholder="2-10"
                />
                {rangeInput.trim() && pageNumbers.length === 0 && (
                  <p className="text-xs text-destructive">Invalid page range.</p>
                )}
              </div>

              {error && <StatusBanner tone="warning">{error}</StatusBanner>}
              {notice && <StatusBanner tone="success">{notice}</StatusBanner>}

              <Button type="button" size="lg" className="w-full" disabled={busy} onClick={process}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                Add page numbers
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
                Upload a PDF to preview page numbers.
              </div>
            )}
          </div>
        </div>
      </div>
    </ToolShell>
  );
}
