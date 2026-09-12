"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, GripVertical, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBytes, PDF_LIMITS } from "@/pdf/config/limits";
import { toUserMessage } from "@/pdf/config/errors";
import { loadImageFile, type LoadedImage } from "@/pdf/core/image";
import { newId } from "@/pdf/core/byte-store";
import { FileDropzone } from "./FileDropzone";
import { cn } from "@/lib/utils";

export interface UploadedImage {
  id: string;
  name: string;
  image: LoadedImage;
}

interface ImageUploaderProps {
  value: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
  disabled?: boolean;
  compact?: boolean;
  accept?: string;
  allowedFormats?: Array<LoadedImage["format"]>;
  hint?: string;
}

export function ImageUploader({
  value,
  onChange,
  disabled = false,
  compact = false,
  accept = "image/png,image/jpeg,image/webp",
  allowedFormats,
  hint,
}: ImageUploaderProps) {
  const [loading, setLoading] = React.useState(false);
  const [errors, setErrors] = React.useState<string[]>([]);
  const dragIndex = React.useRef<number | null>(null);

  const handleFiles = async (files: File[]) => {
    setLoading(true);
    setErrors([]);
    const additions: UploadedImage[] = [];
    const failures: string[] = [];
    for (const file of files) {
      if (value.length + additions.length >= PDF_LIMITS.imageToPdf.maxImages) {
        failures.push(`You can add up to ${PDF_LIMITS.imageToPdf.maxImages} images.`);
        break;
      }
      try {
        const image = await loadImageFile(file, PDF_LIMITS.imageToPdf.maxImageBytes);
        if (allowedFormats && !allowedFormats.includes(image.format)) {
          failures.push(`${file.name}: unsupported image type for this tool.`);
          continue;
        }
        additions.push({ id: newId("img"), name: file.name, image });
      } catch (error) {
        failures.push(`${file.name}: ${toUserMessage(error)}`);
      }
    }
    setErrors(failures);
    if (additions.length > 0) onChange([...value, ...additions]);
    setLoading(false);
  };

  const move = (from: number, to: number) => {
    if (to < 0 || to >= value.length || from === to) return;
    const next = [...value];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  };

  return (
    <div className="space-y-3">
      <FileDropzone
        accept={accept}
        multiple
        disabled={disabled || loading}
        compact={compact}
        title="Drop images here"
        hint={
          hint ??
          `JPG, PNG, WebP • Maximum ${formatBytes(PDF_LIMITS.imageToPdf.maxImageBytes)} each • Up to ${PDF_LIMITS.imageToPdf.maxImages} images`
        }
        onFiles={handleFiles}
      />

      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Reading images…
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
          {value.map((item, index) => (
            <li
              key={item.id}
              draggable
              onDragStart={() => {
                dragIndex.current = index;
              }}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                if (dragIndex.current !== null) move(dragIndex.current, index);
                dragIndex.current = null;
              }}
              className="flex items-center gap-3 rounded-lg border border-border bg-card px-2 py-2"
            >
              <GripVertical className="size-4 shrink-0 cursor-grab text-muted-foreground" aria-hidden />
              <img
                src={item.image.dataUrl}
                alt=""
                className="size-10 shrink-0 rounded border border-border bg-white object-contain"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground" title={item.name}>
                  {item.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {item.image.width} × {item.image.height}px
                </p>
              </div>
              <div className="flex flex-col">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronUp className="size-3" aria-hidden />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  aria-label="Move down"
                  disabled={index === value.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronDown className="size-3" aria-hidden />
                </Button>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${item.name}`}
                onClick={() => onChange(value.filter((entry) => entry.id !== item.id))}
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
