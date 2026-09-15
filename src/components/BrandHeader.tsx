"use client";

import { Menu, X } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { Link } from "react-router-dom";

export function BrandHeader({ children }: { children?: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(56,82,60,0.16)] bg-[#f7f8f2]">
      <div className="relative mx-auto flex h-[72px] w-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-10 lg:px-16">
        <Link
          to="/"
          className="rounded-sm text-[12px] font-semibold uppercase tracking-[0.34em] text-[#20372b] transition-colors hover:text-[#4a6047] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60"
        >
          Craft Tools
        </Link>
        <div className="flex min-w-0 items-center justify-end gap-3 sm:gap-4">
          <div
            className={`${menuOpen ? "block" : "hidden"} absolute left-0 top-full w-full border-b border-[rgba(56,82,60,0.16)] bg-[#f7f8f2] px-4 py-3 shadow-sm sm:static sm:block sm:w-auto sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none`}
          >
            {children}
          </div>
          <button
            type="button"
            aria-label={menuOpen ? "Close tools menu" : "Open tools menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex shrink-0 items-center justify-center rounded-full border border-[#b8cbb0] p-2 text-[#3d553b] transition hover:border-[#5d7052] hover:bg-[#edf2e9] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60 sm:hidden"
          >
            {menuOpen ? <X className="size-4" aria-hidden /> : <Menu className="size-4" aria-hidden />}
          </button>
        </div>
      </div>
    </header>
  );
}
