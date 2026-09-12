const NAV = [
  { href: "#tools", label: "Tools" },
  { href: "#privacy", label: "Privacy" },
  { href: "#about", label: "About" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-[rgba(56,82,60,0.16)] bg-[#f7f8f2]">
      <div className="mx-auto flex h-[72px] w-full max-w-[1320px] items-center justify-between px-6 sm:px-10 lg:px-16">
        <a
          href="/"
          className="rounded-sm text-[12px] font-semibold uppercase tracking-[0.34em] text-[#20372b] transition-colors hover:text-[#4a6047] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60"
        >
          Craft Tools
        </a>
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
      </div>
    </header>
  );
}
