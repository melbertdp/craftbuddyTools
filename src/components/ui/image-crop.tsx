"use client";

import * as React from "react";
import { Cropper as CropperPrimitive } from "@origin-space/image-cropper";
import { cn } from "@/lib/utils";

export function Cropper({ className, ...props }: React.ComponentProps<typeof CropperPrimitive.Root>) {
  return <CropperPrimitive.Root className={cn("relative flex w-full cursor-move touch-none items-center justify-center overflow-hidden rounded-lg bg-muted", className)} {...props} />;
}

export function CropperImage({ className, ...props }: React.ComponentProps<typeof CropperPrimitive.Image>) {
  return <CropperPrimitive.Image className={cn("pointer-events-none h-full w-full object-cover", className)} {...props} />;
}

export function CropperArea({ className, ...props }: React.ComponentProps<typeof CropperPrimitive.CropArea>) {
  return <CropperPrimitive.CropArea className={cn("pointer-events-none absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,.35)]", className)} {...props} />;
}
