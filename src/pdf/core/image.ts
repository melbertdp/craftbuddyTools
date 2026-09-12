import { PdfError } from "@/pdf/config/errors";
import { sniffImageFormat } from "./validation";

export type ImageFormat = "png" | "jpeg" | "webp";

export interface LoadedImage {
  dataUrl: string;
  format: ImageFormat;
  width: number;
  height: number;
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new PdfError("PROCESSING_FAILED", "This image could not be read."));
    reader.readAsDataURL(blob);
  });
}

export function dataUrlToBytes(dataUrl: string): Uint8Array {
  const commaIndex = dataUrl.indexOf(",");
  const base64 = dataUrl.slice(commaIndex + 1);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function dataUrlFormat(dataUrl: string): ImageFormat | undefined {
  const match = /^data:image\/(png|jpeg|jpg|webp)/i.exec(dataUrl);
  if (!match) return undefined;
  const value = match[1].toLowerCase();
  return value === "jpg" ? "jpeg" : (value as ImageFormat);
}

export async function decodeImageSize(
  source: Blob | string,
): Promise<{ width: number; height: number }> {
  if (typeof source !== "string" && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(source);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      // fall through to Image element
    }
  }
  const url = typeof source === "string" ? source : URL.createObjectURL(source);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = () => reject(new PdfError("PROCESSING_FAILED", "This image could not be decoded."));
      image.src = url;
    });
  } finally {
    if (typeof source !== "string") URL.revokeObjectURL(url);
  }
}

async function convertToPng(blob: Blob): Promise<string> {
  const url = URL.createObjectURL(blob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new PdfError("PROCESSING_FAILED", "This image could not be decoded."));
      value.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext("2d");
    if (!context) throw new PdfError("PROCESSING_FAILED", "Canvas is not supported in this browser.");
    context.drawImage(image, 0, 0);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function loadImageFile(
  file: File,
  maxBytes: number,
): Promise<LoadedImage> {
  if (file.size > maxBytes) {
    throw new PdfError(
      "PDF_TOO_LARGE",
      `This image is ${(file.size / (1024 * 1024)).toFixed(1)} MB. The limit is ${(
        maxBytes /
        (1024 * 1024)
      ).toFixed(0)} MB.`,
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const format = sniffImageFormat(bytes);
  if (!format) {
    throw new PdfError("UNSUPPORTED_DOCUMENT", "Use a PNG, JPEG, or WebP image.");
  }
  const size = await decodeImageSize(file);
  const dataUrl = format === "webp" ? await convertToPng(file) : await blobToDataUrl(file);
  return {
    dataUrl,
    format: format === "webp" ? "png" : format,
    width: size.width,
    height: size.height,
  };
}

export async function loadImageFromBlob(blob: Blob): Promise<LoadedImage> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const format = sniffImageFormat(bytes);
  if (!format) throw new PdfError("UNSUPPORTED_DOCUMENT", "Use a PNG, JPEG, or WebP image.");
  const size = await decodeImageSize(blob);
  const dataUrl = format === "webp" ? await convertToPng(blob) : await blobToDataUrl(blob);
  return {
    dataUrl,
    format: format === "webp" ? "png" : format,
    width: size.width,
    height: size.height,
  };
}

export function imageComponentToDataUrl(
  canvas: HTMLCanvasElement,
  format: "png" | "jpeg" = "png",
  quality?: number,
): string {
  return canvas.toDataURL(`image/${format}`, quality);
}
