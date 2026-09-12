"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cancelJob, useJobStore, type Job } from "@/pdf/stores/job-store";
import { cn } from "@/lib/utils";

function StatusIcon({ status }: { status: Job["status"] }) {
  if (status === "failed") return <XCircle className="size-4 text-destructive" aria-hidden />;
  if (status === "cancelled") return <XCircle className="size-4 text-muted-foreground" aria-hidden />;
  if (status === "completed")
    return <CheckCircle2 className="size-4 text-success" aria-hidden />;
  return <Loader2 className="size-4 animate-spin text-primary" aria-hidden />;
}

export function JobProgress() {
  const jobs = useJobStore((state) => state.jobs);
  const remove = useJobStore((state) => state.remove);
  const active = jobs.filter((job) => job.status !== "completed");
  if (active.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,360px)] space-y-2" role="status" aria-live="polite">
      {active.map((job) => (
        <div key={job.id} className="rounded-xl border border-border bg-card p-3 shadow-lg">
          <div className="flex items-start gap-2">
            <StatusIcon status={job.status} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{job.label}</p>
              {job.detail && <p className="truncate text-xs text-muted-foreground">{job.detail}</p>}
              {job.error && <p className="text-xs text-destructive">{job.error}</p>}
            </div>
            {job.status === "processing" || job.status === "queued" ? (
              <Button type="button" variant="ghost" size="icon-xs" aria-label="Cancel" onClick={() => cancelJob(job.id)}>
                <X className="size-3.5" aria-hidden />
              </Button>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                aria-label="Dismiss"
                onClick={() => remove(job.id)}
              >
                <X className="size-3.5" aria-hidden />
              </Button>
            )}
          </div>
          {(job.status === "processing" || job.status === "queued") && (
            <Progress className="mt-2 h-1.5" value={job.progress} />
          )}
        </div>
      ))}
    </div>
  );
}

interface WarningBannerProps {
  children: React.ReactNode;
  tone?: "warning" | "info" | "success";
  className?: string;
}

export function StatusBanner({ children, tone = "warning", className }: WarningBannerProps) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-lg border px-3 py-2 text-sm",
        tone === "warning" && "border-amber-300/60 bg-amber-50 text-amber-900",
        tone === "info" && "border-border bg-muted/50 text-foreground",
        tone === "success" && "border-green-300/60 bg-green-50 text-green-900",
        className,
      )}
      role={tone === "warning" ? "alert" : undefined}
    >
      {tone === "success" ? (
        <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : tone === "info" ? (
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <div className="min-w-0">{children}</div>
    </div>
  );
}
