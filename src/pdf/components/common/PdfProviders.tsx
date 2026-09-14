"use client";

import * as React from "react";
import { Outlet } from "react-router-dom";
import { TooltipProvider } from "@/components/ui/tooltip";
import { disposeAllPdfDocuments } from "@/pdf/core/pdfjs";
import { thumbnailStore } from "@/pdf/core/thumbnail-store";
import { terminatePdfWorker } from "@/pdf/workers/client";
import { JobProgress } from "./JobProgress";

const PDF_TITLE = "PDF Tools - local-first, private";

export function PdfProviders({ children }: { children?: React.ReactNode }) {
  React.useEffect(
    () => () => {
      // Release PDF.js documents, cached thumbnails, and the ops worker.
      void disposeAllPdfDocuments();
      thumbnailStore.clear();
      terminatePdfWorker();
    },
    [],
  );

  React.useEffect(() => {
    const previous = document.title;
    document.title = PDF_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <TooltipProvider delayDuration={200}>
      {children ?? <Outlet />}
      <JobProgress />
    </TooltipProvider>
  );
}
