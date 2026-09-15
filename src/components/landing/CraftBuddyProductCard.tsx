import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SectionLabel";

export interface ProductCardTheme {
  background: string;
  border: string;
  label: string;
  offer: string;
  cta: string;
}

interface CraftBuddyProductCardProps {
  eyebrow: string;
  title: string;
  offer: string;
  offerNote?: string;
  description: string;
  cta: string;
  href: string;
  theme: ProductCardTheme;
  illustration: ReactNode;
  className?: string;
}

const linkClass =
  "rounded-2xl outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-[#6f8368]/70";

const illustrationClass =
  "pointer-events-none relative -z-10 mt-4 h-[110px] w-full transition-transform duration-200 ease-out group-hover:-translate-y-[2px] group-hover:translate-x-[3px] motion-reduce:transform-none sm:absolute sm:inset-y-0 sm:right-0 sm:mt-0 sm:h-full sm:w-[44%]";

export function CraftBuddyProductCard({
  eyebrow,
  title,
  offer,
  offerNote,
  description,
  cta,
  href,
  theme,
  illustration,
  className,
}: CraftBuddyProductCardProps) {
  return (
    <article
      className={cn(
        "group relative isolate flex min-h-[220px] flex-col overflow-hidden rounded-2xl border p-5 shadow-[0_10px_30px_rgba(34,55,39,0.05)] transition duration-200 ease-out",
        "hover:-translate-y-[2px] hover:shadow-[0_16px_40px_rgba(34,55,39,0.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "sm:min-h-[240px] sm:p-6",
        theme.background,
        theme.border,
        className,
      )}
    >
      <div className="flex h-full flex-col sm:max-w-[55%]">
        <SectionLabel className={theme.label}>{eyebrow}</SectionLabel>
        <h3 className="mt-2.5 font-heading text-[26px] font-bold leading-[1.05] tracking-[-0.03em] text-[#20372b] sm:text-[28px]">
          <a target="_blank" href={href} className={linkClass}>
            {title}
          </a>
        </h3>
        <p className={cn("mt-1.5 text-[19px] font-semibold tracking-[-0.01em]", theme.offer)}>
          {offer}
        </p>
        {offerNote ? (
          <p className="mt-1 text-[13.5px] leading-5 text-[#5c6a60]">{offerNote}</p>
        ) : null}
        <p className="mt-2 max-w-[32ch] text-[14px] leading-[1.55] text-[#3f4d44]">
          {description}
        </p>
        <span
          className={cn(
            "mt-auto inline-flex items-center gap-1.5 pt-4 text-[15px] font-semibold",
            theme.cta,
          )}
        >
          {cta}
          <ArrowUpRight
            className="size-4 transition-transform duration-200 ease-out group-hover:-translate-y-[2px] group-hover:translate-x-[2px] motion-reduce:transform-none"
            aria-hidden
          />
        </span>
      </div>

      <div aria-hidden="true" className={illustrationClass}>
        {illustration}
      </div>
    </article>
  );
}
