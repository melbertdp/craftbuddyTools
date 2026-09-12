"use client";

import { EditorWorkspace } from "@/pdf/components/editor/EditorWorkspace";

export default function SignPdfTool() {
  return (
    <EditorWorkspace
      mode="sign"
      title="Sign PDF"
      description="Draw, type, or upload a visual signature and place it on the document."
    />
  );
}
