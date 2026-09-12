import type { LucideIcon } from "lucide-react";
import {
  FileImage,
  FileOutput,
  FileSearch,
  FileText,
  Hash,
  Image,
  Images,
  Layers,
  Merge,
  PenLine,
  RotateCw,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Stamp,
  Trash2,
  Type,
} from "lucide-react";

export interface PdfTool {
  slug: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export interface PdfToolCategory {
  id: string;
  title: string;
  tools: PdfTool[];
}

export const PDF_TOOL_CATEGORIES: PdfToolCategory[] = [
  {
    id: "edit-sign",
    title: "Edit & Sign",
    tools: [
      {
        slug: "edit",
        title: "Edit PDF",
        description: "Add text, images, shapes, highlights, and drawings.",
        icon: PenLine,
      },
      {
        slug: "sign",
        title: "Sign PDF",
        description: "Draw, type, or upload a signature and place it.",
        icon: Type,
      },
      {
        slug: "organize",
        title: "Organize PDF",
        description: "Reorder, duplicate, rotate, insert, and delete pages.",
        icon: Layers,
      },
      {
        slug: "watermark",
        title: "Watermark PDF",
        description: "Apply text or image watermarks with live preview.",
        icon: Stamp,
      },
      {
        slug: "page-numbers",
        title: "Add Page Numbers",
        description: "Insert page numbers with flexible formats.",
        icon: Hash,
      },
    ],
  },
  {
    id: "combine-separate",
    title: "Combine & Separate",
    tools: [
      {
        slug: "merge",
        title: "Merge PDF",
        description: "Combine multiple PDFs and reorder pages.",
        icon: Merge,
      },
      {
        slug: "split",
        title: "Split PDF",
        description: "Split by ranges or extract selected pages.",
        icon: Scissors,
      },
      {
        slug: "extract",
        title: "Extract Pages",
        description: "Pull selected pages into a new PDF.",
        icon: FileOutput,
      },
      {
        slug: "delete-pages",
        title: "Delete Pages",
        description: "Remove unwanted pages from a PDF.",
        icon: Trash2,
      },
      {
        slug: "rotate",
        title: "Rotate PDF",
        description: "Rotate all or selected pages and save.",
        icon: RotateCw,
      },
    ],
  },
  {
    id: "convert",
    title: "Convert",
    tools: [
      {
        slug: "pdf-to-jpg",
        title: "PDF to JPG",
        description: "Export pages as JPG images.",
        icon: FileImage,
      },
      {
        slug: "pdf-to-png",
        title: "PDF to PNG",
        description: "Export pages as PNG images.",
        icon: FileImage,
      },
      {
        slug: "pdf-to-webp",
        title: "PDF to WebP",
        description: "Export pages as WebP images.",
        icon: FileImage,
      },
      {
        slug: "jpg-to-pdf",
        title: "JPG to PDF",
        description: "Combine JPG images into one PDF.",
        icon: Image,
      },
      {
        slug: "png-to-pdf",
        title: "PNG to PDF",
        description: "Combine PNG images into one PDF.",
        icon: Image,
      },
      {
        slug: "images-to-pdf",
        title: "Images to PDF",
        description: "Combine mixed images with page controls.",
        icon: Images,
      },
    ],
  },
  {
    id: "optimize",
    title: "Optimize",
    tools: [
      {
        slug: "compress",
        title: "Compress PDF",
        description: "Reduce file size with honest before/after results.",
        icon: SlidersHorizontal,
      },
      {
        slug: "metadata",
        title: "Edit PDF Metadata",
        description: "View and update title, author, and keywords.",
        icon: FileSearch,
      },
    ],
  },
];

export const PDF_TOOLS: PdfTool[] = PDF_TOOL_CATEGORIES.flatMap((category) => category.tools);

export function findTool(slug: string): PdfTool | undefined {
  return PDF_TOOLS.find((tool) => tool.slug === slug);
}

export const TOOL_ACCEPTS: Record<string, { accept: string; format?: string }> = {
  "jpg-to-pdf": { accept: "image/jpeg,.jpg,.jpeg", format: "jpeg" },
  "png-to-pdf": { accept: "image/png,.png", format: "png" },
  "images-to-pdf": { accept: "image/png,image/jpeg,image/webp" },
  "pdf-to-jpg": { accept: "application/pdf,.pdf", format: "jpeg" },
  "pdf-to-png": { accept: "application/pdf,.pdf", format: "png" },
  "pdf-to-webp": { accept: "application/pdf,.pdf", format: "webp" },
};

export const OTHER_ICON = FileText;
