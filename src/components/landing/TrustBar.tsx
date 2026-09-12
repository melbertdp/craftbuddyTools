import { Lock } from "lucide-react";

export function TrustBar() {
  return (
    <section
      id="privacy"
      aria-labelledby="trust-heading"
      className="scroll-mt-24 border-t border-[rgba(56,82,60,0.16)] px-6 py-12 sm:px-10 sm:py-14 lg:px-16"
    >
      <div className="mx-auto flex w-full max-w-[1320px] flex-col items-center gap-5 text-center sm:flex-row sm:justify-center sm:gap-6 sm:text-left">
        <span className="grid size-14 shrink-0 place-items-center rounded-full border border-[rgba(56,82,60,0.16)] bg-[#e1e9da] text-[#2f463a]">
          <Lock className="size-5" aria-hidden />
        </span>
        <span aria-hidden="true" className="hidden h-14 w-px bg-[rgba(56,82,60,0.16)] sm:block" />
        <div className="max-w-[46ch]">
          <h2 id="trust-heading" className="font-heading text-[17px] font-bold tracking-[-0.02em] text-[#20372b]">
            Built for quick work.
          </h2>
          <p className="mt-1 text-sm leading-6 text-[#526057]">
            Runs locally · No signup · Files stay on your device
          </p>
          <p className="mt-2 text-xs leading-5 text-[#7b877e]">
            Optional AI Assist sends a single rendered page for classification
            only when you turn it on.
          </p>
        </div>
      </div>
    </section>
  );
}
