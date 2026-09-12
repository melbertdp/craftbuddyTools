import JSZip from "jszip";

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function downloadBytes(bytes: Uint8Array, filename: string, type = "application/pdf"): void {
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  downloadBlob(new Blob([buffer], { type }), filename);
}

export interface ZipEntry {
  filename: string;
  data: Blob | Uint8Array;
}

export async function downloadZip(entries: ZipEntry[], zipName: string): Promise<void> {
  const zip = new JSZip();
  for (const entry of entries) {
    zip.file(entry.filename, entry.data);
  }
  const blob = await zip.generateAsync({ type: "blob" });
  downloadBlob(blob, zipName);
}
