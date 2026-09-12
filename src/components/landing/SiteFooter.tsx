export function SiteFooter() {
  return (
    <footer id="about" className="scroll-mt-24 border-t border-[rgba(56,82,60,0.16)]">
      <div className="mx-auto flex w-full max-w-[1320px] flex-col gap-8 px-6 py-10 sm:px-10 lg:flex-row lg:items-start lg:justify-between lg:px-16 lg:py-12">
        <div className="max-w-[42ch]">
          <p className="text-[12px] font-semibold uppercase tracking-[0.34em] text-[#20372b]">
            Craft Tools
          </p>
          <p className="mt-3 text-sm leading-6 text-[#526057]">
            A small set of local-first utilities for makers, print shops, and
            small businesses. Simple tools for real work.
          </p>
        </div>
        <p className="max-w-[46ch] text-sm leading-6 text-[#526057] lg:text-right">
          Local processing — images and PDFs are handled in this browser. AI
          Assist is opt-in and only sends one page when enabled.
        </p>
      </div>
    </footer>
  );
}
