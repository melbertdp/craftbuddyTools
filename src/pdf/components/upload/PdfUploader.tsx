"use client";

import * as React from "react";
import { AlertTriangle, FileText, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, limitFor, type LimitScope } from "@/pdf/config/limits";
import { toUserMessage } from "@/pdf/config/errors";
import { LARGE_DOCUMENT_MESSAGE } from "@/pdf/config/warnings";
import { loadPdfFile, releaseDocument, type LoadedDocument } from "@/pdf/core/document-engine";
import { cn } from "@/lib/utils";
import { FileDropzone } from "./FileDropzone";

interface PdfUploaderProps {
  scope: LimitScope;
  multiple?: boolean;
  value: LoadedDocument[];
  onChange: (documents: LoadedDocument[]) => void;
  disabled?: boolean;
  compact?: boolean;
  validate?: (documents: LoadedDocument[]) => string | undefined;
  title?: string;
  hint?: string;
}

export function PdfUploader({
  scope,
  multiple = false,
  value,
  onChange,
  disabled = false,
  compact = false,
  validate,
  title,
  hint,
}: PdfUploaderProps) {
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const limits = limitFor(scope);

  const handleFiles = async (files: File[]) => {
    setLoading(true);
    setErrors([]);
    const loaded: LoadedDocument[] = [];
    const failures: string[] = [];
    for (const file of files) {
      try {
        loaded.push(await loadPdfFile(file, { scope }));
      } catch (error) {
        failures.push(`${file.name}: ${toUserMessage(error)}`);
      }
    }
    setErrors(failures);
    if (loaded.length > 0) {
      const next = multiple ? [...value, ...loaded] : loaded.slice(0, 1);
      const validationError = validate?.(next);
      if (validationError) {
        for (const document of loaded) releaseDocument(document);
        setErrors((current) => [...current, validationError]);
      } else {
        onChange(next);
      }
    }
    setLoading(false);
  };

  const remove = (document: LoadedDocument) => {
    releaseDocument(document);
    onChange(value.filter((item) => item.source.id !== document.source.id));
  };

  return (
    <div className="space-y-3">
      <FileDropzone
        accept="application/pdf,.pdf"
        multiple={multiple}
        disabled={disabled || loading}
        compact={compact}
        title={title ?? (multiple ? "Drop your PDFs here" : "Drop your PDF here")}
        hint={
          hint ??
          `PDF • Maximum ${formatBytes(limits.maxFileSizeBytes)} • Maximum ${limits.maxPages} pages${
            multiple ? " per file" : ""
          }`
        }
        onFiles={handleFiles}
      />

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Reading document…
        </p>
      )}

      {errors.length > 0 && (
        <ul className="space-y-1" role="alert">
          {errors.map((error) => (
            <li key={error} className="text-sm text-destructive">
              {error}
            </li>
          ))}
        </ul>
      )}

      {value.length > 0 && (
        <ul className="space-y-2">
          {value.map((document) => (
            <li
              key={document.source.id}
              className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-2"
            >
              <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={document.source.name}>
                  {document.source.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(document.source.size)} • {document.source.pageCount} page
                  {document.source.pageCount === 1 ? "" : "s"}
                </p>
                {document.warnings.length > 0 && (
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
                    <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
                    {LARGE_DOCUMENT_MESSAGE}
                  </p>
                )}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${document.source.name}`}
                onClick={() => remove(document)}
                className={cn("shrink-0")}
              >
                <X className="size-4" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
