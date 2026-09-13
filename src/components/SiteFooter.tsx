export function SiteFooter() {
  return (
    <footer id="about" className="scroll-mt-24 border-t border-[rgba(56,82,60,0.16)]">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-6 px-6 py-8 text-sm sm:px-10 sm:py-10 lg:flex-row lg:items-start lg:justify-between lg:px-16 lg:py-12">
        <div className="max-w-[42ch]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[#20372b]">
            Craft Tools
          </p>
          <p className="mt-3 leading-6 text-[#526057]">
            Local-first utilities for makers, print shops, and small businesses.
          </p>
        </div>
        <p className="max-w-[46ch] leading-6 text-[#526057] lg:text-right">
          Private by design. Your files are processed directly in this browser
          and never uploaded.
        </p>
      </div>
    </footer>
  );
}
