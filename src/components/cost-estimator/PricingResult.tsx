import { Zap } from "lucide-react";
import type { CalculationMethod } from "@/lib/calculator";
import { formatPeso } from "./shared";

export function PricingResult({
  totalCost,
  profit,
  discountAmount,
  salesTax,
  listingPrice,
  method,
  margin,
  discount,
  tax,
}: {
  totalCost: number;
  profit: number;
  discountAmount: number;
  salesTax: number;
  listingPrice: number;
  method: CalculationMethod;
  margin: string;
  discount: string;
  tax: string;
}) {
  const profitLabel =
    method === "margin" ? `Profit (${margin || "0"}%)` : "Profit";
  const supportingCopy =
    method === "price"
      ? "This is the selling price you entered."
      : "This is your suggested selling price.";

  return (
    <section
      aria-labelledby="pricing-result-heading"
      className="flex h-full flex-col bg-[#EDF2E9] p-5 lg:p-6"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2
          id="pricing-result-heading"
          className="text-[19px] font-bold text-[#20372B]"
        >
          Pricing result
        </h2>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-2.5 py-1 text-[11px] font-medium text-[#4E6349]">
          <Zap aria-hidden="true" className="size-3" />
          Live calculation
        </span>
      </div>

      <dl className="mt-5 space-y-2.5 text-sm">
        <ResultRow label="Total cost" value={formatPeso(totalCost)} />
        <ResultRow
          label={profitLabel}
          value={
            profit < 0
              ? `-${formatPeso(Math.abs(profit))}`
              : `+${formatPeso(profit)}`
          }
          accent
        />
        <ResultRow
          label={`Discount (${discount || "0"}%)`}
          value={`-${formatPeso(discountAmount)}`}
        />
        <ResultRow
          label={`Sales tax (${tax || "0"}%)`}
          value={`+${formatPeso(salesTax)}`}
        />
      </dl>

      <div
        aria-hidden="true"
        className="my-5 h-px w-full bg-[rgba(53,78,57,0.14)]"
      />

      <div>
        <span className="text-sm font-semibold text-[#4E6349]">
          Selling price
        </span>
        <div className="mt-1.5 text-[clamp(28px,2.6vw,42px)] font-extrabold leading-none tracking-[-0.03em] text-[#20372B] tabular-nums">
          {formatPeso(listingPrice)}
        </div>
        <p className="mt-2.5 text-[13px] leading-relaxed text-[#66736A]">
          {supportingCopy}
        </p>
      </div>
    </section>
  );
}

function ResultRow({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[#66736A]">{label}</dt>
      <dd
        className={
          accent
            ? "font-semibold tabular-nums text-[#3C5A3A]"
            : "font-semibold tabular-nums text-[#20372B]"
        }
      >
        {value}
      </dd>
    </div>
  );
}
