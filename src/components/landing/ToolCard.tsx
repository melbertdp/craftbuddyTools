import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SectionLabel } from "./SectionLabel";

export interface ToolCardTheme {
  background: string;
  border: string;
  label: string;
  cta: string;
}

interface ToolCardProps {
  category: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  external?: boolean;
  theme: ToolCardTheme;
  illustration: ReactNode;
  className?: string;
}

const linkClass =
  "rounded-2xl outline-none after:absolute after:inset-0 after:rounded-2xl after:content-[''] focus-visible:after:ring-[3px] focus-visible:after:ring-inset focus-visible:after:ring-[#6f8368]/70";

const illustrationClass =
  "pointer-events-none relative -z-10 mt-6 h-[150px] w-full transition-transform duration-200 ease-out group-hover:-translate-y-[2px] group-hover:translate-x-[3px] motion-reduce:transform-none sm:absolute sm:inset-y-0 sm:right-0 sm:mt-0 sm:h-full sm:w-[46%]";

export function ToolCard({
  category,
  title,
  description,
  cta,
  href,
  external = false,
  theme,
  illustration,
  className,
}: ToolCardProps) {
  return (
    <article
      className={cn(
        "group relative isolate flex min-h-[300px] flex-col overflow-hidden rounded-2xl border p-7 shadow-[0_10px_30px_rgba(34,55,39,0.05)] transition duration-200 ease-out",
        "hover:-translate-y-[3px] hover:shadow-[0_16px_40px_rgba(34,55,39,0.08)] motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        "sm:min-h-[340px] sm:p-8",
        theme.background,
        theme.border,
        className,
      )}
    >
      <div className="flex h-full flex-col sm:max-w-[58%]">
        <SectionLabel className={theme.label}>{category}</SectionLabel>
        <h2 className="mt-6 font-heading text-[26px] font-bold leading-[1.05] tracking-[-0.035em] text-[#20372b] sm:mt-7 sm:text-[30px]">
          {external ? (
            <a href={href} className={linkClass}>
              {title}
            </a>
          ) : (
            <Link to={href} className={linkClass}>
              {title}
            </Link>
          )}
        </h2>
        <p className="mt-3 max-w-[31ch] text-[14px] leading-[1.62] text-[#3f4d44]">
          {description}
        </p>
        <span
          className={cn(
            "mt-auto inline-flex items-center gap-1.5 pt-6 text-[13px] font-semibold",
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
