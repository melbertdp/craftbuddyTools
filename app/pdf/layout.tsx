import type { Metadata } from "next";
import { PdfProviders } from "@/pdf/components/common/PdfProviders";

export const metadata: Metadata = {
  title: "PDF Tools - local-first, private",
  description:
    "Edit, sign, merge, split, convert, and optimize PDFs directly in your browser. Documents never leave your device.",
};

export default function PdfLayout({ children }: { children: React.ReactNode }) {
  return <PdfProviders>{children}</PdfProviders>;
}
