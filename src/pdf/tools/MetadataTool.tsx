"use client";

import * as React from "react";
import { Download, Loader2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToolShell } from "@/pdf/components/common/ToolShell";
import { StatusBanner } from "@/pdf/components/common/JobProgress";
import { PdfUploader } from "@/pdf/components/upload/PdfUploader";
import { toUserMessage } from "@/pdf/config/errors";
import { updatePdfMetadata } from "@/pdf/core/enhancement-engine";
import { runPdfOperation } from "@/pdf/workers/client";
import { downloadBytes } from "@/pdf/core/download";
import { exportFileName } from "@/pdf/core/filenames";
import type { LoadedDocument } from "@/pdf/core/document-engine";
import type { PdfMetadata } from "@/pdf/types";
import { runJob } from "@/pdf/stores/job-store";
import {
  releaseRemovedDocuments,
  useReleaseDocumentsOnUnmount,
  useResetPdfWorkspaceOnMount,
} from "@/pdf/components/common/usePdfToolReset";

const EMPTY: Record<keyof PdfMetadata, string> = {
  title: "",
  author: "",
  subject: "",
  keywords: "",
  creator: "",
  producer: "",
};

export function MetadataTool() {
  const [documents, setDocuments] = React.useState<LoadedDocument[]>([]);
  const [fields, setFields] = React.useState(EMPTY);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string>();
  const [notice, setNotice] = React.useState<string>();

  // Each tool instance starts empty; never show the previous tool's upload.
  useResetPdfWorkspaceOnMount();
  useReleaseDocumentsOnUnmount(documents);

  const document = documents[0];

  const load = (docs: LoadedDocument[]) => {
    releaseRemovedDocuments(documents, docs);
    setDocuments(docs);
    setError(undefined);
    setNotice(undefined);
    if (docs[0]) {
      setFields({
        title: docs[0].metadata.title ?? "",
        author: docs[0].metadata.author ?? "",
        subject: docs[0].metadata.subject ?? "",
        keywords: docs[0].metadata.keywords ?? "",
        creator: docs[0].metadata.creator ?? "",
        producer: docs[0].metadata.producer ?? "",
      });
    }
  };

  const apply = async (remove: boolean) => {
    if (!document) return;
    setBusy(true);
    setError(undefined);
    setNotice(undefined);
    try {
      const metadata: PdfMetadata = {
        title: fields.title,
        author: fields.author,
        subject: fields.subject,
        keywords: fields.keywords,
        creator: fields.creator,
        producer: fields.producer,
      };
      const bytes = await runJob({
        label: remove ? "Removing metadata" : "Updating metadata",
        task: async () => {
          if (remove) {
            return runPdfOperation({ op: "metadata", bytes: document.source.bytes, remove: true });
          }
          const viaWorker = await runPdfOperation({
            op: "metadata",
            bytes: document.source.bytes,
            metadata,
          });
          return viaWorker;
        },
      });
      downloadBytes(bytes, exportFileName(document.source.name, remove ? "metadata-removed" : "metadata"));
      setNotice(remove ? "Metadata removed." : "Metadata updated.");
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!document) return;
    setBusy(true);
    setError(undefined);
    try {
      const bytes = await updatePdfMetadata(document.source.bytes, { metadata: {}, remove: true });
      downloadBytes(bytes, exportFileName(document.source.name, "metadata-reset"));
      setNotice("Metadata reset.");
    } catch (caught) {
      setError(toUserMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  const FIELDS: { key: keyof PdfMetadata; label: string; placeholder?: string }[] = [
    { key: "title", label: "Title" },
    { key: "author", label: "Author" },
    { key: "subject", label: "Subject" },
    { key: "keywords", label: "Keywords", placeholder: "comma separated" },
    { key: "creator", label: "Creator" },
    { key: "producer", label: "Producer" },
  ];

  return (
    <ToolShell title="Edit PDF Metadata" description="View and update document metadata where supported.">
      <div className="mx-auto max-w-2xl space-y-4">
        <PdfUploader scope="general" value={documents} onChange={load} />

        {document && (
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`meta-${field.key}`}>{field.label}</Label>
                <Input
                  id={`meta-${field.key}`}
                  value={fields[field.key]}
                  placeholder={field.placeholder}
                  onChange={(event) => setFields((current) => ({ ...current, [field.key]: event.target.value }))}
                />
              </div>
            ))}

            {error && <StatusBanner tone="warning">{error}</StatusBanner>}
            {notice && <StatusBanner tone="success">{notice}</StatusBanner>}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="lg" disabled={busy} onClick={() => void apply(false)}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Download className="size-4" aria-hidden />}
                Save metadata
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={busy} onClick={reset}>
                <RotateCcw className="size-4" aria-hidden /> Reset
              </Button>
              <Button type="button" variant="outline" size="lg" disabled={busy} onClick={() => void apply(true)}>
                Remove
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Some fields may be regenerated by the PDF writer and cannot be fully cleared.
            </p>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
