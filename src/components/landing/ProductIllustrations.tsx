import { useId } from "react";

const SVG_PROPS = {
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  preserveAspectRatio: "xMidYMid meet",
} as const;

export function BrowserAppIllustration() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full font-sans" {...SVG_PROPS}>
      <defs>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#223727" floodOpacity="0.12" />
        </filter>
      </defs>

      <circle cx="198" cy="170" r="100" fill="#dce7d2" opacity="0.7" />
      <circle cx="142" cy="120" r="62" fill="#e7efe0" opacity="0.9" />
      <circle cx="198" cy="170" r="100" fill="none" stroke="rgba(56,82,60,0.16)" strokeWidth="1.5" />

      <g filter={`url(#${uid}-soft)`}>
        <rect x="66" y="82" width="198" height="150" rx="13" fill="#fbfdf8" stroke="rgba(56,82,60,0.22)" />
      </g>
      <path d="M66 95a13 13 0 0 1 13-13h172a13 13 0 0 1 13 13v15H66z" fill="#eef3e8" />
      <line x1="66" y1="110" x2="264" y2="110" stroke="rgba(56,82,60,0.18)" />
      <circle cx="82" cy="95" r="3.2" fill="#cf8f72" />
      <circle cx="94" cy="95" r="3.2" fill="#d9b06a" />
      <circle cx="106" cy="95" r="3.2" fill="#8fae83" />
      <rect x="128" y="88" width="104" height="13" rx="6.5" fill="#ffffff" stroke="rgba(56,82,60,0.16)" />
      <rect x="136" y="92" width="5" height="5" rx="1" fill="#9caf88" />

      <rect x="84" y="128" width="58" height="7" rx="3.5" fill="#cfdcc4" />
      <rect x="84" y="144" width="78" height="4" rx="2" fill="#dde6d5" />
      <rect x="84" y="154" width="66" height="4" rx="2" fill="#dde6d5" />
      <rect x="84" y="168" width="72" height="40" rx="8" fill="#eef3e8" stroke="rgba(56,82,60,0.14)" />
      <rect x="176" y="124" width="72" height="34" rx="7" fill="#eef3e8" stroke="rgba(56,82,60,0.14)" />

      <g stroke="#20372b" strokeWidth="2.2" fill="none">
        <circle cx="164" cy="190" r="26" />
        <ellipse cx="164" cy="190" rx="10" ry="26" />
        <path d="M138 190h52" />
        <path d="M143 177c14 6 30 6 42 0" />
        <path d="M143 203c14-6 30-6 42 0" />
      </g>

      <path d="M276 128l2.4 6 6 2.4-6 2.4-2.4 6-2.4-6-6-2.4 6-2.4Z" fill="#9caf88" />
      <g stroke="#9caf88" strokeWidth="2" strokeLinecap="round">
        <path d="M52 150h-10" />
        <path d="M56 160h-7" />
      </g>

      <g transform="rotate(-7 96 250)">
        <text className="font-serif italic" fill="#7c8b6a" fontSize="15">
          <tspan x="40" y="244">Work</tspan>
          <tspan x="40" y="262">anywhere</tspan>
        </text>
      </g>
    </svg>
  );
}

export function DesktopAppIllustration() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full font-sans" {...SVG_PROPS}>
      <defs>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#223727" floodOpacity="0.14" />
        </filter>
      </defs>

      <path
        d="M54 178c-10-74 42-124 112-126 68-2 116 48 114 116-2 72-54 112-118 112-62 0-100-36-108-102Z"
        fill="#c8dbc8"
        opacity="0.8"
      />
      <circle cx="150" cy="132" r="66" fill="none" stroke="rgba(56,82,60,0.16)" strokeWidth="1.5" />

      <g transform="rotate(-5 176 150)">
        <rect x="104" y="74" width="180" height="146" rx="12" fill="#e6f0e5" stroke="rgba(56,82,60,0.18)" />
      </g>

      <g filter={`url(#${uid}-soft)`}>
        <rect x="74" y="86" width="196" height="158" rx="13" fill="#fbfdf8" stroke="rgba(56,82,60,0.24)" />
      </g>
      <path d="M74 99a13 13 0 0 1 13-13h170a13 13 0 0 1 13 13v14H74z" fill="#e3ede1" />
      <line x1="74" y1="113" x2="270" y2="113" stroke="rgba(56,82,60,0.18)" />
      <circle cx="88" cy="99" r="3" fill="#8fae83" />
      <circle cx="99" cy="99" r="3" fill="#b9caa9" />
      <rect x="176" y="95" width="34" height="7" rx="3.5" fill="#cfdcc4" />
      <rect x="216" y="95" width="22" height="7" rx="3.5" fill="#dde6d5" />

      <rect x="74" y="113" width="52" height="131" fill="#eef3ea" />
      <line x1="126" y1="113" x2="126" y2="244" stroke="rgba(56,82,60,0.16)" />
      <g fill="#cfdcc4">
        <rect x="84" y="126" width="32" height="7" rx="3.5" />
        <rect x="84" y="144" width="26" height="5" rx="2.5" />
        <rect x="84" y="158" width="30" height="5" rx="2.5" />
        <rect x="84" y="172" width="24" height="5" rx="2.5" />
      </g>

      <g fill="#dde6d5">
        <rect x="140" y="126" width="106" height="9" rx="4.5" fill="#cfdcc4" />
        <rect x="140" y="144" width="84" height="5" rx="2.5" />
        <rect x="140" y="156" width="96" height="5" rx="2.5" />
      </g>
      <rect x="140" y="174" width="46" height="9" rx="4.5" fill="#e3ede1" />
      <rect x="196" y="174" width="30" height="9" rx="4.5" fill="#e3ede1" />

      <rect x="176" y="190" width="44" height="44" rx="12" fill="#20372b" />
      <path d="M198 198c7 2 12 7 12 14-7 0-12-5-12-14Z" fill="#a9c19a" />
      <path d="M198 226c-7 0-12-5-12-14 7 0 12 5 12 14Z" fill="#c8dbc8" />

      <circle cx="276" cy="238" r="17" fill="#20372b" />
      <g stroke="#f5f8f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M270 244l10-10" />
        <path d="M272 234h8v8" />
      </g>

      <g transform="rotate(-6 250 42)">
        <text className="font-serif italic" fill="#4f6a54" fontSize="15" textAnchor="end">
          <tspan x="304" y="36">More</tspan>
          <tspan x="304" y="54">power</tspan>
          <tspan x="304" y="72">for makers</tspan>
        </text>
      </g>
      <g stroke="#8fae83" strokeWidth="2" strokeLinecap="round">
        <path d="M254 98l-8-6" />
        <path d="M262 88l-5-8" />
      </g>
    </svg>
  );
}
