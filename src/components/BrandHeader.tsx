import type { ReactNode } from "react";

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
        {children}
      </div>
    </header>
  );
}
