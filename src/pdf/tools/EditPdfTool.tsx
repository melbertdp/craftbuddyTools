"use client";

import { EditorWorkspace } from "@/pdf/components/editor/EditorWorkspace";

export default function EditPdfTool() {
  return (
    <EditorWorkspace
      mode="edit"
      title="Edit PDF"
      description="Add text, images, shapes, highlights, drawings, and signatures."
    />
  );
}
