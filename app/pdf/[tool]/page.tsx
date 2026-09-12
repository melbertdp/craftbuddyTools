"use client";

import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { getToolComponent } from "@/pdf/tools/registry";

export default function PdfToolPage() {
  const params = useParams<{ tool: string }>();
  const slug = typeof params?.tool === "string" ? params.tool : "";
  const Component = getToolComponent(slug);
  if (!Component) notFound();
  return <Component />;
}
