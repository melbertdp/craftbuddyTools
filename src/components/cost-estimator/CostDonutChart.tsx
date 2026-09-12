import { roundPercent } from "./shared";

export type DonutSegment = {
  key: string;
  label: string;
  value: number;
  color: string;
};

export function CostDonutChart({ segments }: { segments: DonutSegment[] }) {
  const safe = segments.map((segment) => ({
    ...segment,
    value: Math.max(segment.value, 0),
  }));
  const total = safe.reduce((sum, segment) => sum + segment.value, 0);
  const dominant = safe.reduce<DonutSegment | undefined>(
    (best, segment) =>
      best === undefined || segment.value > best.value ? segment : best,
    undefined,
  );
  const centerLabel =
    total > 0 && dominant
      ? `${roundPercent((dominant.value / total) * 100)}%`
      : "0%";
  const summary = safe
    .map(
      (segment) =>
        `${segment.label} ${
          total > 0 ? roundPercent((segment.value / total) * 100) : 0
        }%`,
    )
    .join(", ");

  const size = 220;
  const stroke = 26;
  const radius = (size - stroke) / 2 - 2;
  const circumference = 2 * Math.PI * radius;
  let running = 0;

  const arcs = safe.map((segment) => {
    const fraction = total > 0 ? segment.value / total : 0;
    const length = fraction * circumference;
    const offset = running;
    running += length;
    return { segment, length, offset };
  });

  return (
    <div className="flex flex-col items-center gap-5">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`Cost composition. ${summary}.`}
        className="max-w-full"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#E7EDE2"
          strokeWidth={stroke}
        />
        {arcs.map(({ segment, length, offset }) =>
          length > 0 ? (
            <circle
              key={segment.key}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth={stroke}
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ) : null,
        )}
        <text
          x={size / 2}
          y={size / 2 - 6}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={40}
          fontWeight={800}
          fill="#20372B"
        >
          {centerLabel}
        </text>
        <text
          x={size / 2}
          y={size / 2 + 26}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={11}
          fill="#66736A"
        >
          of total cost
        </text>
      </svg>

      <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
        {safe.map((segment) => (
          <li
            key={segment.key}
            className="flex items-center gap-2 text-[13px] text-[#66736A]"
          >
            <span
              aria-hidden="true"
              className="size-2.5 rounded-full"
              style={{ backgroundColor: segment.color }}
            />
            {segment.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
