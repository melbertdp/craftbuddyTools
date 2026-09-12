"use client";

import * as React from "react";
import { UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  compact?: boolean;
  paste?: boolean;
  title?: string;
  hint?: string;
  onFiles: (files: File[]) => void;
  className?: string;
}

export function FileDropzone({
  accept,
  multiple = false,
  disabled = false,
  compact = false,
  paste = false,
  title = "Drop your PDF here",
  hint,
  onFiles,
  className,
}: FileDropzoneProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = React.useState(false);

  const emit = React.useCallback(
    (list: FileList | null) => {
      if (!list || list.length === 0) return;
      const files = Array.from(list);
      onFiles(multiple ? files : files.slice(0, 1));
    },
    [multiple, onFiles],
  );

  React.useEffect(() => {
    if (!paste || disabled) return;
    const handlePaste = (event: ClipboardEvent) => {
      const files = event.clipboardData?.files;
      if (files && files.length > 0) {
        event.preventDefault();
        emit(files);
      }
    };
    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [paste, disabled, emit]);

  const openPicker = () => {
    if (disabled) return;
    inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      aria-label={title}
      onClick={openPicker}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openPicker();
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragActive(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setDragActive(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragActive(false);
        if (!disabled) emit(event.dataTransfer.files);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors outline-none",
        "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40",
        compact ? "gap-1.5 px-4 py-5" : "gap-3 px-6 py-12",
        dragActive ? "border-primary bg-primary/5" : "border-border bg-card/60 hover:bg-accent/40",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
    >
      <UploadCloud
        className={cn("text-muted-foreground", compact ? "size-5" : "size-8")}
        aria-hidden
      />
      <div className="space-y-1">
        <p className={cn("font-medium text-foreground", compact ? "text-sm" : "text-base")}>
          {title} <span className="text-muted-foreground">or click to browse</span>
        </p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        onChange={(event) => {
          emit(event.target.files);
          event.target.value = "";
        }}
      />
    </div>
  );
}
