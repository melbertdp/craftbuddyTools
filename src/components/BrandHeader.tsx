"use client";

import { Download } from "lucide-react";
import type { ReactNode } from "react";

import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";

export function BrandHeader({ children }: { children?: ReactNode }) {
  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(56,82,60,0.16)] bg-[#f7f8f2]">
      <div className="mx-auto flex h-[72px] w-full max-w-[1320px] items-center justify-between px-6 sm:px-10 lg:px-16">
        <a
          href="/"
          className="rounded-sm text-[12px] font-semibold uppercase tracking-[0.34em] text-[#20372b] transition-colors hover:text-[#4a6047] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60"
        >
          Craft Tools
        </a>
        <div className="flex min-w-0 items-center gap-4">
          <div className="min-w-0">{children}</div>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("craftbuddy-open-offline-setup"))}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#b8cbb0] px-3 py-2 text-xs font-bold text-[#3d553b] transition hover:border-[#5d7052] hover:bg-[#edf2e9] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60"
          >
            <Download className="size-3.5" aria-hidden />
            <AnimatedGradientText
              className="hidden sm:inline"
              colorFrom="#000000"
              colorTo="#2f463a"
            >
              Download
            </AnimatedGradientText>
            <span className="sr-only sm:hidden">Download for offline use</span>
          </button>
        </div>
      </div>
    </header>
  );
}
