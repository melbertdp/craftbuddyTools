export type InkPage = { cyan: number; magenta: number; yellow: number; black: number };

function canvasAnalysis(canvas: HTMLCanvasElement): InkPage {
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas is not supported by this browser.");
  const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
  let cyan = 0, magenta = 0, yellow = 0, black = 0;
  const pixels = canvas.width * canvas.height;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] / 255, g = data[i + 1] / 255, b = data[i + 2] / 255;
    const k = 1 - Math.max(r, g, b);
    cyan += 1 - r - k;
    magenta += 1 - g - k;
    yellow += 1 - b - k;
    black += k;
  }
  return { cyan: cyan / pixels, magenta: magenta / pixels, yellow: yellow / pixels, black: black / pixels };
}

export async function analyzeImage(file: File): Promise<InkPage[]> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("Could not read this image."));
      value.src = url;
    });
    const scale = Math.min(1, 1000 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return [canvasAnalysis(canvas)];
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function analyzePdf(file: File, onProgress?: (value: number) => void): Promise<InkPage[]> {
  if (file.size > 100 * 1024 * 1024) throw new Error("PDF files must be 100 MB or smaller.");
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const limit = Math.min(pdfDocument.numPages, 20);
  const pages: InkPage[] = [];
  for (let index = 1; index <= limit; index += 1) {
    const page = await pdfDocument.getPage(index);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(1, 1000 / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewport.width));
    canvas.height = Math.max(1, Math.round(viewport.height));
    const context = canvas.getContext("2d")!;
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, viewport }).promise;
    pages.push(canvasAnalysis(canvas));
    onProgress?.(index / limit * 100);
  }
  return pages;
}

export async function renderPdfPreview(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();
  const pdfDocument = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const page = await pdfDocument.getPage(1);
  const base = page.getViewport({ scale: 1 });
  const scale = Math.min(1, 1200 / Math.max(base.width, base.height));
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  await page.render({ canvas, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.8);
}
