import { useState } from "react";
import { Calculator, Coins, Package, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { COST_ACCENTS, formatPeso, roundPercent } from "./shared";

type BreakdownMode = "amount" | "percentage";

export function CostBreakdown({
  materialsTotal,
  laborTotal,
  otherTotal,
  totalCost,
}: {
  materialsTotal: number;
  laborTotal: number;
  otherTotal: number;
  totalCost: number;
}) {
  const [mode, setMode] = useState<BreakdownMode>("amount");
  const percent = (value: number) =>
    totalCost > 0 ? (value / totalCost) * 100 : 0;

  return (
    <section
      aria-labelledby="cost-breakdown-heading"
      className="rounded-[18px] border border-[rgba(53,78,57,0.14)] bg-[#FBFCF8] p-5 shadow-[0_8px_24px_rgba(36,56,41,0.05)] lg:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="cost-breakdown-heading"
            className="text-[22px] font-bold text-[#20372B]"
          >
            Cost breakdown
          </h2>
          <p className="mt-1 text-sm text-[#66736A]">
            See how your total cost is composed.
          </p>
        </div>
        <div
          role="group"
          aria-label="Display breakdown as"
          className="inline-flex rounded-full border border-[rgba(53,78,57,0.14)] bg-white p-1"
        >
          {(
            [
              ["amount", "Amount"],
              ["percentage", "Percentage"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5d7052]/30 motion-reduce:transition-none",
                mode === value
                  ? "bg-[#3E5344] text-white"
                  : "text-[#3F4D38] hover:bg-[#EDF2E9]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <CostBreakdownCard
          label="Materials"
          amount={materialsTotal}
          percent={percent(materialsTotal)}
          mode={mode}
          accent={COST_ACCENTS.materials}
          icon={Coins}
        />
        <CostBreakdownCard
          label="Labor"
          amount={laborTotal}
          percent={percent(laborTotal)}
          mode={mode}
          accent={COST_ACCENTS.labor}
          icon={User}
        />
        <CostBreakdownCard
          label="Other costs"
          amount={otherTotal}
          percent={percent(otherTotal)}
          mode={mode}
          accent={COST_ACCENTS.other}
          icon={Package}
        />
        <TotalCostCard total={totalCost} />
      </div>
    </section>
  );
}

function CostBreakdownCard({
  label,
  amount,
  percent,
  mode,
  accent,
  icon: Icon,
}: {
  label: string;
  amount: number;
  percent: number;
  mode: BreakdownMode;
  accent: { solid: string; soft: string; ink: string };
  icon: typeof Coins;
}) {
  const primary = mode === "amount" ? formatPeso(amount) : `${roundPercent(percent)}%`;
  const secondary = mode === "amount" ? `${roundPercent(percent)}%` : formatPeso(amount);

  return (
    <div
      className="flex min-h-[124px] flex-col rounded-2xl p-4"
      style={{ backgroundColor: accent.soft }}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/70"
          style={{ color: accent.ink }}
        >
          <Icon className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[#66736A]">{label}</div>
          <div className="mt-0.5 text-[20px] font-bold leading-tight text-[#20372B] tabular-nums">
            {primary}
          </div>
        </div>
        <div className="text-[13px] font-semibold text-[#66736A] tabular-nums">
          {secondary}
        </div>
      </div>
      <div className="mt-auto pt-4">
        <div
          role="progressbar"
          aria-label={`${label} share of total cost`}
          aria-valuenow={roundPercent(percent)}
          aria-valuemin={0}
          aria-valuemax={100}
          className="h-1.5 w-full overflow-hidden rounded-full bg-white/60"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300 motion-reduce:transition-none"
            style={{
              width: `${Math.min(100, Math.max(0, percent))}%`,
              backgroundColor: accent.solid,
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TotalCostCard({ total }: { total: number }) {
  return (
    <div className="flex min-h-[124px] flex-col rounded-2xl border border-[rgba(53,78,57,0.14)] bg-white p-4">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#EDF2E9] text-[#3C5A3A]"
        >
          <Calculator className="size-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-medium text-[#66736A]">
            Total cost
          </div>
          <div className="mt-0.5 text-[20px] font-bold leading-tight text-[#20372B] tabular-nums">
            {formatPeso(total)}
          </div>
        </div>
      </div>
      <p className="mt-auto pt-4 text-[13px] text-[#66736A]">
        Sum of all costs.
      </p>
    </div>
  );
}
