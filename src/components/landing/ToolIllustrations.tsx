import { useId } from "react";

const SVG_PROPS = {
  fill: "none",
  xmlns: "http://www.w3.org/2000/svg",
  preserveAspectRatio: "xMidYMid meet",
} as const;

function buildQrMatrix(size = 21, seed = 7): boolean[][] {
  const matrix = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const drawFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        matrix[oy + y][ox + x] = edge || core;
      }
    }
  };
  drawFinder(0, 0);
  drawFinder(size - 7, 0);
  drawFinder(0, size - 7);
  for (let i = 8; i < size - 8; i += 1) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }
  let state = seed;
  const random = () => {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    return state / 0x7fffffff;
  };
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (matrix[y][x]) continue;
      const inFinderZone =
        (x < 8 && y < 8) || (x >= size - 8 && y < 8) || (x < 8 && y >= size - 8);
      if (inFinderZone) continue;
      matrix[y][x] = random() > 0.5;
    }
  }
  for (let y = 8; y <= 12; y += 1) {
    for (let x = 8; x <= 12; x += 1) {
      matrix[y][x] = false;
    }
  }
  return matrix;
}

export function PrintSheetsIllustration() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full font-sans" {...SVG_PROPS}>
      <defs>
        <pattern id={`${uid}-grid`} width="18" height="18" patternUnits="userSpaceOnUse">
          <path d="M18 0H0V18" stroke="rgba(56,82,60,0.10)" strokeWidth="1" />
        </pattern>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#223727" floodOpacity="0.12" />
        </filter>
      </defs>

      <rect width="320" height="320" fill={`url(#${uid}-grid)`} />

      <g transform="rotate(-11 204 150)">
        <rect x="150" y="66" width="110" height="156" rx="7" fill="#dfe7d6" />
      </g>
      <g transform="rotate(-4 204 150)">
        <rect
          x="148"
          y="68"
          width="112"
          height="158"
          rx="7"
          fill="#eef3e9"
          stroke="rgba(56,82,60,0.16)"
        />
      </g>
      <g transform="rotate(2 204 150)">
        <rect
          x="144"
          y="70"
          width="114"
          height="160"
          rx="8"
          fill="#fcfdf9"
          stroke="rgba(56,82,60,0.22)"
          filter={`url(#${uid}-soft)`}
        />
        <rect x="158" y="90" width="54" height="6" rx="3" fill="#c3d3b7" />
        <rect x="158" y="104" width="84" height="4" rx="2" fill="#dde6d5" />
        <rect x="158" y="114" width="76" height="4" rx="2" fill="#dde6d5" />
        <rect x="158" y="124" width="82" height="4" rx="2" fill="#dde6d5" />
        <rect x="158" y="134" width="64" height="4" rx="2" fill="#dde6d5" />
      </g>

      <g filter={`url(#${uid}-soft)`}>
        <circle cx="262" cy="96" r="20" fill="#20372b" />
      </g>
      <text
        x="262"
        y="93"
        textAnchor="middle"
        fill="#f5f8f1"
        fontSize="12"
        fontWeight="700"
        letterSpacing="0.5"
      >
        A4
      </text>
      <text x="262" y="104" textAnchor="middle" fill="#b9c9b4" fontSize="5.6" letterSpacing="0.3">
        210×297
      </text>

      <g filter={`url(#${uid}-soft)`}>
        <rect
          x="96"
          y="186"
          width="164"
          height="100"
          rx="11"
          fill="#fdfefb"
          stroke="rgba(56,82,60,0.16)"
        />
      </g>
      <g fontSize="11.5">
        <text x="112" y="210" fill="#42503f">Paper</text>
        <text x="244" y="210" textAnchor="end" fill="#20372b" fontWeight="600">$0.08</text>
        <text x="112" y="228" fill="#42503f">Ink</text>
        <text x="244" y="228" textAnchor="end" fill="#20372b" fontWeight="600">$0.12</text>
        <line x1="112" y1="239" x2="244" y2="239" stroke="rgba(56,82,60,0.24)" strokeWidth="1" />
        <text x="112" y="261" fontWeight="700" fill="#20372b">Total</text>
        <text x="244" y="261" textAnchor="end" fontWeight="700" fill="#20372b">$0.20</text>
      </g>

      <g transform="rotate(-6 46 266)">
        <text className="font-serif italic" fill="#7c8b6a" fontSize="15">
          <tspan x="16" y="246">Turn</tspan>
          <tspan x="16" y="264">ideas into</tspan>
          <tspan x="16" y="282">profit</tspan>
        </text>
      </g>
    </svg>
  );
}

export function ProductCostIllustration() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full font-sans" {...SVG_PROPS}>
      <defs>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#6b4d1c" floodOpacity="0.14" />
        </filter>
      </defs>

      <ellipse cx="216" cy="184" rx="126" ry="104" fill="#ecd9b6" opacity="0.62" />
      <ellipse cx="122" cy="126" rx="74" ry="62" fill="#f0e2c6" opacity="0.8" />
      <circle cx="196" cy="160" r="92" fill="none" stroke="rgba(154,116,58,0.28)" strokeWidth="1.5" />

      <g stroke="#c08a3e" strokeWidth="2" strokeLinecap="round">
        <path d="M262 58v-16" />
        <path d="M278 68l12-12" />
        <path d="M248 70l-13-7" />
      </g>

      <g filter={`url(#${uid}-soft)`}>
        <rect
          x="130"
          y="74"
          width="172"
          height="196"
          rx="13"
          fill="#fdf8ee"
          stroke="rgba(154,116,58,0.30)"
        />
      </g>

      <g stroke="#a9743a" strokeWidth="1.6" fill="none">
        <rect x="146" y="94" width="13" height="13" rx="2.5" />
        <path d="M146 99h13" />
        <circle cx="152.5" cy="152" r="4" />
        <path d="M146 165c0-3.6 2.9-6.4 6.5-6.4s6.5 2.8 6.5 6.4" />
      </g>
      <g stroke="#a9743a" strokeWidth="1.6" fill="none">
        <ellipse cx="152.5" cy="199" rx="6.5" ry="2.6" />
        <path d="M146 205c0 1.4 2.9 2.6 6.5 2.6s6.5-1.2 6.5-2.6" />
        <path d="M146 199v6" />
        <path d="M159 199v6" />
      </g>

      <g fontSize="11.5" fill="#5c4a2c">
        <text x="170" y="104">Materials</text>
        <text x="288" y="104" textAnchor="end" fill="#3a2c12" fontWeight="600">$2.50</text>
        <text x="170" y="155">Labor</text>
        <text x="288" y="155" textAnchor="end" fill="#3a2c12" fontWeight="600">$1.20</text>
        <text x="170" y="205">Overhead</text>
        <text x="288" y="205" textAnchor="end" fill="#3a2c12" fontWeight="600">$0.80</text>
        <line x1="146" y1="224" x2="288" y2="224" stroke="rgba(154,116,58,0.35)" strokeWidth="1" />
        <text x="146" y="250" fontSize="13" fontWeight="700" fill="#3a2c12">Total</text>
        <text x="288" y="250" textAnchor="end" fontSize="13" fontWeight="700" fill="#3a2c12">
          $4.50
        </text>
      </g>

      <g transform="rotate(-6 60 278)">
        <text className="font-serif italic" fill="#a9743a" fontSize="15">
          <tspan x="18" y="268">Real numbers</tspan>
          <tspan x="18" y="286">real progress</tspan>
        </text>
      </g>
    </svg>
  );
}

export function QrCodeIllustration() {
  const uid = useId().replace(/:/g, "");
  const size = 21;
  const cell = 7.4;
  const gap = 1.5;
  const originX = 126;
  const originY = 78;
  const matrix = buildQrMatrix(size, 13);

  return (
    <svg viewBox="0 0 320 320" className="h-full w-full font-sans" {...SVG_PROPS}>
      <ellipse cx="198" cy="164" rx="108" ry="104" fill="#eec9b6" opacity="0.7" />
      <circle cx="198" cy="164" r="96" fill="none" stroke="rgba(178,105,80,0.25)" strokeWidth="1.5" />

      <g>
        {matrix.map((row, y) =>
          row.map((on, x) =>
            on ? (
              <rect
                key={`${x}-${y}`}
                x={originX + x * cell}
                y={originY + y * cell}
                width={cell - gap}
                height={cell - gap}
                rx={1.8}
                fill="#20372b"
              />
            ) : null,
          ),
        )}
      </g>

      <rect x="186" y="126" width="42" height="42" rx="11" fill="#f7f8f2" />
      <path
        d="M207 134c7 0 12 5 12 12-7 0-12-5-12-12Z"
        fill="#7c9169"
      />
      <path d="M207 158c-7 0-12-5-12-12 7 0 12 5 12 12Z" fill="#20372b" />

      <g fill="#c97b5e">
        <path d="M112 66l2.6 6.4 6.4 2.6-6.4 2.6-2.6 6.4-2.6-6.4L103 75l6.4-2.6Z" />
      </g>

      <g fill="none" stroke="#c97b5e" strokeWidth="2" strokeLinecap="round">
        <path d="M112 232c22-4 34-16 42-32" />
        <path d="M146 194l16 3-9 13" strokeLinejoin="round" />
      </g>

      <g transform="rotate(-6 250 48)">
        <text className="font-serif italic" fill="#b4623f" fontSize="15" textAnchor="end">
          <tspan x="304" y="46">Small code.</tspan>
          <tspan x="304" y="64">Big possibilities.</tspan>
        </text>
      </g>

      <g>
        <circle cx="150" cy="282" r="8" fill="#20372b" />
        <circle cx="176" cy="282" r="8" fill="#7e9168" stroke="rgba(56,82,60,0.2)" />
        <circle cx="202" cy="282" r="8" fill="#9aa35e" stroke="rgba(56,82,60,0.2)" />
        <circle cx="228" cy="282" r="8" fill="#c97b5e" />
        <circle cx="254" cy="282" r="8" fill="#f2e8d3" stroke="rgba(56,82,60,0.2)" />
      </g>
    </svg>
  );
}

export function PdfToolsIllustration() {
  const uid = useId().replace(/:/g, "");
  return (
    <svg viewBox="0 0 320 320" className="h-full w-full font-sans" {...SVG_PROPS}>
      <defs>
        <filter id={`${uid}-soft`} x="-40%" y="-40%" width="180%" height="180%">
          <feDropShadow dx="0" dy="7" stdDeviation="9" floodColor="#223727" floodOpacity="0.12" />
        </filter>
      </defs>

      <ellipse cx="204" cy="188" rx="124" ry="110" fill="#cfe0d3" opacity="0.85" />
      <circle cx="150" cy="152" r="70" fill="none" stroke="rgba(56,82,60,0.18)" strokeWidth="1.5" />

      <g transform="rotate(-9 196 152)">
        <rect x="146" y="76" width="104" height="146" rx="8" fill="#e7f0e8" stroke="rgba(56,82,60,0.16)" />
      </g>
      <g transform="rotate(-3 202 162)">
        <rect x="152" y="84" width="108" height="150" rx="8" fill="#f2f7f1" stroke="rgba(56,82,60,0.18)" />
      </g>
      <g transform="rotate(3 208 172)">
        <g filter={`url(#${uid}-soft)`}>
          <rect x="158" y="92" width="112" height="154" rx="9" fill="#fdfefb" stroke="rgba(56,82,60,0.24)" />
          <path d="M244 92h-26v26l26-26Z" fill="#d9e6da" stroke="rgba(56,82,60,0.24)" />
        </g>
        <text x="172" y="128" fontSize="19" fontWeight="800" letterSpacing="0.5" fill="#20372b">PDF</text>
        <rect x="172" y="144" width="76" height="4" rx="2" fill="#d7e3d6" />
        <rect x="172" y="156" width="68" height="4" rx="2" fill="#d7e3d6" />
        <rect x="172" y="168" width="74" height="4" rx="2" fill="#d7e3d6" />
        <rect x="172" y="180" width="52" height="4" rx="2" fill="#d7e3d6" />
      </g>

      <g filter={`url(#${uid}-soft)`}>
        <circle cx="282" cy="264" r="23" fill="#20372b" />
      </g>
      <g stroke="#f5f8f1" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none">
        <path d="M273 259h18" />
        <path d="M287 255l4 4-4 4" />
        <path d="M291 269h-18" />
        <path d="M277 265l-4 4 4 4" />
      </g>

      <g transform="rotate(-6 250 42)">
        <text className="font-serif italic" fill="#4f6a54" fontSize="15" textAnchor="end">
          <tspan x="304" y="38">Simple</tspan>
          <tspan x="304" y="56">documents.</tspan>
          <tspan x="304" y="74">Happier work.</tspan>
        </text>
      </g>
    </svg>
  );
}
