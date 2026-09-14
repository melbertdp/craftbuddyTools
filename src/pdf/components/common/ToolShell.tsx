"use client";

import * as React from "react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { BrandHeader } from "@/components/BrandHeader";
import { SiteFooter } from "@/components/SiteFooter";

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
        <nav className="flex w-full flex-col items-stretch gap-0 sm:w-max sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-6">
          {[
            ["/print-estimator-v2", "Print Calculator"],
            ["/cost-estimator", "Cost estimator"],
            ["/qr-generator", "QR generator"],
            ["/id-photo-print", "ID photo print"],
            ["/profiles", "Profiles"],
            ["/market-benchmark", "Market benchmark"],
            ["/pdf", "PDF tools"],
          ].map(([href, label]) => (
            <Link
              key={href}
              to={href}
              className="px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground sm:px-0 sm:py-0"
            >
              {label}
            </Link>
          ))}
        </nav>
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
