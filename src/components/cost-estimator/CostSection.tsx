import type { LucideIcon } from "lucide-react";
import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { formatPeso } from "./shared";

export function CostSection({
  title,
  icon: Icon,
  accent,
  total,
  addLabel,
  onAdd,
  children,
}: {
  title: string;
  icon: LucideIcon;
  accent: { solid: string; soft: string; ink: string };
  total: number;
  addLabel: string;
  onAdd: () => void;
  children: ReactNode;
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-[rgba(53,78,57,0.14)] bg-[#FBFCF8]">
      <header className="flex items-center gap-3 border-b border-[rgba(53,78,57,0.10)] px-4 py-3.5">
        <span
          aria-hidden="true"
          className="flex size-9 shrink-0 items-center justify-center rounded-xl"
          style={{ backgroundColor: accent.soft, color: accent.ink }}
        >
          <Icon className="size-[18px]" />
        </span>
        <h3 className="text-[16px] font-bold text-[#20372B]">{title}</h3>
        <span className="ml-auto whitespace-nowrap text-[13px] text-[#66736A]">
          Total:{" "}
          <b className="font-bold text-[#20372B] tabular-nums">
            {formatPeso(total)}
          </b>
        </span>
      </header>

      <div className="min-w-0 flex-1">{children}</div>

      <div className="p-3">
        <button
          type="button"
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#EDF2E9] px-3 py-2.5 text-sm font-semibold text-[#2F463A] transition-colors hover:bg-[#DCE7D7] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5d7052]/30 motion-reduce:transition-none"
        >
          <Plus aria-hidden="true" className="size-4" />
          {addLabel}
        </button>
      </div>
    </section>
  );
}
