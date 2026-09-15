import { ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";

import { ShineBorder } from "../ui/shine-border";

function QuickDropCard() {
  return (
    <div className="relative mt-14 w-full max-w-[390px] animate-quick-drop lg:absolute lg:right-[7%] lg:top-[250px] lg:mt-0 xl:right-[9%] xl:top-[300px]">
      <div className="relative rotate-[2deg] rounded-[22px] border border-white/80 bg-[#f8faf4]/95 px-5 py-5 shadow-[0_24px_42px_rgba(47,70,58,0.16)] backdrop-blur-sm sm:px-7 sm:py-6">
        <ShineBorder
          aria-hidden="true"
          borderWidth={2}
          duration={8}
          shineColor="#8fa98a"
        />
        <span className="absolute -right-2 -top-4 rounded-full bg-[#718969] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.08em] text-[#f7faf4] shadow-[0_5px_12px_rgba(47,70,58,0.16)]">
          New
        </span>
        <div className="flex items-center gap-4 sm:gap-5">
          <img
            src="/quickdrop.png"
            alt=""
            className="size-[76px] shrink-0 rounded-[19px] object-cover sm:size-[88px]"
          />
          <div>
            <p className="font-heading text-[27px] font-extrabold leading-none tracking-[-0.06em] text-[#20372b] sm:text-[31px]">
              Quick<span className="text-[#668060]">Drop</span>
            </p>
            <p className="mt-2 text-[17px] font-bold leading-none text-[#6f8368] sm:text-[19px]">
              Available Now!
            </p>
            <p className="mt-2 text-xs text-[#526057] sm:text-[13px]">Get files. Faster.</p>
          </div>
        </div>
        <Link
          to="/quickdrop"
          className="mt-4 inline-flex border-t border-[#d9e3d5] pt-3 text-xs font-bold text-[#5d7052] outline-none transition-colors hover:text-[#2f463a] focus-visible:ring-2 focus-visible:ring-[#6f8368]/50"
        >
          Get QuickDrop!
        </Link>
      </div>
    </div>
  );
}

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
      <div className="mx-auto w-full max-w-[1320px] px-6 pb-14 pt-8 sm:px-10 sm:pb-16 sm:pt-10 lg:px-16 lg:pb-24 lg:pt-12">
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
          <QuickDropCard />
        </div>
      </div>
    </section>
  );
}
