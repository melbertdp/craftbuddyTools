import { useRef } from "react";
import type { CalculationMethod } from "@/lib/calculator";
import { cn } from "@/lib/utils";
import { METHODS } from "./shared";

export function PricingMethodSelector({
  value,
  onChange,
}: {
  value: CalculationMethod;
  onChange: (value: CalculationMethod) => void;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
  ) => {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const direction =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = (index + direction + METHODS.length) % METHODS.length;
    onChange(METHODS[next].value);
    refs.current[METHODS[next].value]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label="Pricing method"
      className="flex flex-wrap gap-1 rounded-xl border border-[rgba(53,78,57,0.14)] bg-white p-1"
    >
      {METHODS.map((item, index) => {
        const selected = item.value === value;
        return (
          <button
            key={item.value}
            ref={(element) => {
              refs.current[item.value] = element;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(event) => handleKeyDown(event, index)}
            className={cn(
              "min-w-[104px] flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5d7052]/30 motion-reduce:transition-none",
              selected
                ? "bg-[#3E5344] text-white"
                : "text-[#3F4D38] hover:bg-[#EDF2E9]",
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
