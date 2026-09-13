import { cn } from "@/lib/utils";

const OTHER_TOOLS = [
  { href: "/print-estimator", label: "Print estimator" },
  { href: "/cost-estimator", label: "Cost estimator" },
  { href: "/qr-generator", label: "QR generator" },
  { href: "/profiles", label: "Profiles" },
];

export function ToolsNav({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Other tools"
      className={cn("flex items-center gap-4 sm:gap-6", className)}
    >
      {OTHER_TOOLS.map((tool) => (
        <a
          key={tool.href}
          href={tool.href}
          className="rounded-sm text-[13px] font-medium tracking-[0.04em] text-[#526057] transition-colors hover:text-[#20372b] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60"
        >
          {tool.label}
        </a>
      ))}
    </nav>
  );
}
