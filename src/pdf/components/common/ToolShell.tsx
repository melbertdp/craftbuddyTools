"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BrandHeader } from "@/components/BrandHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { ToolsNav } from "@/components/ToolsNav";

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
      <BrandHeader>
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/pdf"
            className="hidden rounded-sm text-[13px] font-medium tracking-[0.04em] text-[#526057] transition-colors hover:text-[#20372b] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60 sm:inline"
          >
            PDF tools
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold tracking-tight text-foreground">{title}</h1>
            {description && (
              <p className="hidden truncate text-xs text-muted-foreground md:block">{description}</p>
            )}
          </div>
          <ToolsNav className="hidden border-l border-[rgba(56,82,60,0.16)] pl-5 lg:flex" />
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      </BrandHeader>

      <main
        className={cn(
          "mx-auto w-full flex-1 px-4 py-6 sm:px-6 sm:py-8",
          wide ? "max-w-[1600px]" : "max-w-[1240px]",
          contentClassName,
        )}
      >
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
