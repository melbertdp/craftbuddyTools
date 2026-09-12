"use client";

import * as React from "react";
import dynamic from "next/dynamic";

function Loading() {
  return (
    <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">
      Loading tool…
    </div>
  );
}

const EditPdfTool = dynamic(() => import("./EditPdfTool"), { ssr: false, loading: Loading });
const SignPdfTool = dynamic(() => import("./SignPdfTool"), { ssr: false, loading: Loading });
const PdfToImageTool = dynamic(() => import("./PdfToImageTool").then((mod) => mod.PdfToImageTool), { ssr: false, loading: Loading });
const ImageToPdfTool = dynamic(() => import("./ImageToPdfTool").then((mod) => mod.ImageToPdfTool), { ssr: false, loading: Loading });
const WatermarkTool = dynamic(() => import("./WatermarkTool").then((mod) => mod.WatermarkTool), { ssr: false, loading: Loading });
const PageNumbersTool = dynamic(() => import("./PageNumbersTool").then((mod) => mod.PageNumbersTool), { ssr: false, loading: Loading });
const MetadataTool = dynamic(() => import("./MetadataTool").then((mod) => mod.MetadataTool), { ssr: false, loading: Loading });
const CompressTool = dynamic(() => import("./CompressTool").then((mod) => mod.CompressTool), { ssr: false, loading: Loading });
const PageWorkspaceTool = dynamic(
  () => import("./PageWorkspaceTool").then((mod) => mod.PageWorkspaceTool),
  { ssr: false, loading: Loading },
);

type ToolComponent = React.ComponentType;

function organize(variant: "merge" | "organize" | "rotate" | "delete-pages" | "extract" | "split") {
  return function WorkspaceVariant() {
    const props = {
      merge: { title: "Merge PDF", description: "Combine multiple PDFs and reorder pages." },
      organize: { title: "Organize PDF", description: "Reorder, duplicate, rotate, insert, and delete pages." },
      rotate: { title: "Rotate PDF", description: "Rotate all or selected pages and save." },
      "delete-pages": { title: "Delete Pages", description: "Remove unwanted pages from a PDF." },
      extract: { title: "Extract Pages", description: "Pull selected pages into a new PDF." },
      split: { title: "Split PDF", description: "Split by ranges or extract selected pages." },
    }[variant];
    return <PageWorkspaceTool variant={variant} title={props.title} description={props.description} />;
  };
}

const PdfToJpg = () => (
  <PdfToImageTool defaultFormat="jpeg" title="PDF to JPG" description="Export pages as JPG images." />
);
const PdfToPng = () => (
  <PdfToImageTool defaultFormat="png" title="PDF to PNG" description="Export pages as PNG images." />
);
const PdfToWebp = () => (
  <PdfToImageTool defaultFormat="webp" title="PDF to WebP" description="Export pages as WebP images." />
);
const JpgToPdf = () => (
  <ImageToPdfTool
    title="JPG to PDF"
    description="Combine JPG images into one PDF."
    accept="image/jpeg,.jpg,.jpeg"
    allowedFormats={["jpeg"]}
    outputSuffix="from-jpg"
  />
);
const PngToPdf = () => (
  <ImageToPdfTool
    title="PNG to PDF"
    description="Combine PNG images into one PDF."
    accept="image/png,.png"
    allowedFormats={["png"]}
    outputSuffix="from-png"
  />
);
const ImagesToPdf = () => (
  <ImageToPdfTool
    title="Images to PDF"
    description="Combine mixed images with page controls."
    outputSuffix="from-images"
  />
);

const REGISTRY: Record<string, ToolComponent> = {
  edit: EditPdfTool,
  sign: SignPdfTool,
  organize: organize("organize"),
  merge: organize("merge"),
  split: organize("split"),
  extract: organize("extract"),
  "delete-pages": organize("delete-pages"),
  rotate: organize("rotate"),
  "pdf-to-jpg": PdfToJpg,
  "pdf-to-png": PdfToPng,
  "pdf-to-webp": PdfToWebp,
  "jpg-to-pdf": JpgToPdf,
  "png-to-pdf": PngToPdf,
  "images-to-pdf": ImagesToPdf,
  watermark: WatermarkTool,
  "page-numbers": PageNumbersTool,
  metadata: MetadataTool,
  compress: CompressTool,
};

export function getToolComponent(slug: string): ToolComponent | undefined {
  return REGISTRY[slug];
}

