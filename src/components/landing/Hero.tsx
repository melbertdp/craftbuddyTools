import { ArrowDown } from "lucide-react";

function HeroDecor() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 hidden lg:block"
    >
      <p className="absolute right-0 top-0 -rotate-3 text-right font-serif text-[26px] italic leading-[1.08] text-[#6f8368] xl:text-[30px]">
        Make
        <br />
        Price
        <br />
        Create
        <br />
        Repeat
      </p>
      <p className="absolute right-2 top-[240px] [writing-mode:vertical-rl] text-[10px] font-semibold uppercase tracking-[0.42em] text-[#9aa89a] xl:top-[268px]">
        Better tools for a brighter business
      </p>
    </div>
  );
}

export function Hero() {
  return (
    <section className="relative">
      <div className="mx-auto w-full max-w-[1320px] px-6 pb-14 pt-16 sm:px-10 sm:pb-16 sm:pt-20 lg:px-16 lg:pb-24 lg:pt-24">
        <div className="relative">
          <div className="relative z-10">
            <p className="craft-fade-up text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f8368]">
              Craft tools for real-world pricing
            </p>
            <h1 className="craft-fade-up craft-delay-1 mt-6 font-heading text-[clamp(48px,14vw,72px)] font-extrabold leading-[0.9] tracking-[-0.045em] sm:text-[clamp(56px,9vw,96px)] lg:text-[clamp(64px,7vw,110px)]">
              <span className="block text-[#20372b]">Know your cost.</span>
              <span className="block text-[#6f8368]">Price with confidence.</span>
            </h1>
            <p className="craft-fade-up craft-delay-2 mt-7 max-w-[36ch] text-base leading-7 text-[#526057] sm:text-lg sm:leading-8">
              Focused tools for makers, print shops, and small businesses. No
              account, no upload queue, no clutter.
            </p>
            <div className="craft-fade-up craft-delay-3 mt-10 flex flex-col items-start gap-5 sm:flex-row sm:items-center sm:gap-7">
              <a
                href="#tools"
                className="group/cta inline-flex items-center gap-2.5 rounded-xl bg-[#2f463a] px-6 py-3.5 text-sm font-semibold text-[#f5f8f1] shadow-[0_10px_30px_rgba(34,55,39,0.14)] transition-colors duration-200 hover:bg-[#20372b] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f2]"
              >
                Explore tools
                <ArrowDown
                  className="size-4 transition-transform duration-200 group-hover/cta:translate-y-[3px] motion-reduce:transform-none"
                  aria-hidden
                />
              </a>
              <span className="text-sm text-[#526057]">Simple tools. Real work.</span>
            </div>
          </div>
          <HeroDecor />
        </div>
      </div>
    </section>
  );
}
