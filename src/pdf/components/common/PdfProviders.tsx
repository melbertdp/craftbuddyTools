"use client";

import * as React from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { disposeAllPdfDocuments } from "@/pdf/core/pdfjs";
import { thumbnailStore } from "@/pdf/core/thumbnail-store";
import { terminatePdfWorker } from "@/pdf/workers/client";
import { JobProgress } from "./JobProgress";

export function PdfProviders({ children }: { children: React.ReactNode }) {
  React.useEffect(
    () => () => {
      // Release PDF.js documents, cached thumbnails, and the ops worker.
      void disposeAllPdfDocuments();
      thumbnailStore.clear();
      terminatePdfWorker();
    },
    [],
  );

  return (
    <TooltipProvider delayDuration={200}>
      {children}
      <JobProgress />
    </TooltipProvider>
  );
}
