"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolShellProps {
  title: string;
  description?: string;
  children: React.ReactNode;
  actions?: React.ReactNode;
  wide?: boolean;
  contentClassName?: string;
}

export function ToolShell({
  title,
  description,
  children,
  actions,
  wide = false,
  contentClassName,
}: ToolShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/80 backdrop-blur">
        <div
          className={cn(
            "mx-auto flex w-full items-center gap-3 px-4 py-3 sm:px-6",
            wide ? "max-w-[1600px]" : "max-w-[1240px]",
          )}
        >
          <Link
            href="/pdf"
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden />
            <span className="hidden sm:inline">PDF tools</span>
          </Link>
          <div className="h-5 w-px bg-border" aria-hidden />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold tracking-tight text-foreground">{title}</h1>
            {description && (
              <p className="truncate text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </header>

      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8",
          wide ? "max-w-[1600px]" : "max-w-[1240px]",
          contentClassName,
        )}
      >
        {children}
      </main>

      <footer className="border-t border-border">
        <div
          className={cn(
            "mx-auto flex w-full items-center gap-2 px-4 py-4 text-xs text-muted-foreground sm:px-6",
            wide ? "max-w-[1600px]" : "max-w-[1240px]",
          )}
        >
          <ShieldCheck className="size-3.5 text-success" aria-hidden />
          <span>Your documents stay on your device. Processing happens directly in your browser.</span>
        </div>
      </footer>
    </div>
  );
}
