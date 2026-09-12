import { BrandHeader } from "../BrandHeader";

const NAV = [
  { href: "#tools", label: "Tools" },
  { href: "#privacy", label: "Privacy" },
  { href: "#about", label: "About" },
];

export function SiteHeader() {
  return (
    <BrandHeader>
      <nav aria-label="Primary" className="flex items-center gap-5 sm:gap-8">
        {NAV.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="rounded-sm text-[13px] font-medium tracking-[0.04em] text-[#526057] transition-colors hover:text-[#20372b] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60"
          >
            {item.label}
          </a>
        ))}
      </nav>
    </BrandHeader>
  );
}
