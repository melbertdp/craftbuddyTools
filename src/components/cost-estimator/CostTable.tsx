import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPeso } from "./shared";

export type CostFieldKind = "text" | "number" | "money" | "computed" | "action";

export type CostColumn = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right";
  kind: CostFieldKind;
  placeholder?: string;
  step?: string;
};

export function CostTable<T extends { id: number }>({
  rows,
  columns,
  onUpdate,
  onRemove,
  removeLabel,
  computeTotal,
}: {
  rows: T[];
  columns: CostColumn[];
  onUpdate: (id: number, key: string, value: string) => void;
  onRemove: (id: number) => void;
  removeLabel: string;
  computeTotal: (row: T) => number;
}) {
  const canRemove = rows.length > 1;

  return (
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-collapse min-w-[340px] md:min-w-0">
        <colgroup>
          {columns.map((column) => (
            <col
              key={column.key}
              style={column.width ? { width: column.width } : undefined}
            />
          ))}
        </colgroup>
        <thead>
          <tr className="border-b border-[rgba(53,78,57,0.14)]">
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={cn(
                  "px-2 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#66736A]",
                  column.align === "right" && "text-right",
                )}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr
              key={row.id}
              className="border-b border-[rgba(53,78,57,0.08)] last:border-0"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(
                    "px-1 py-1.5 align-middle",
                    (column.align === "right" ||
                      column.kind === "number" ||
                      column.kind === "money") &&
                      "text-right",
                  )}
                >
                  {renderCell(
                    column,
                    row,
                    rowIndex,
                    onUpdate,
                    onRemove,
                    canRemove,
                    removeLabel,
                    computeTotal,
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function renderCell<T extends { id: number }>(
  column: CostColumn,
  row: T,
  rowIndex: number,
  onUpdate: (id: number, key: string, value: string) => void,
  onRemove: (id: number) => void,
  canRemove: boolean,
  removeLabel: string,
  computeTotal: (row: T) => number,
) {
  const rowNumber = rowIndex + 1;

  if (column.kind === "computed") {
    return (
      <span className="block px-1 text-right text-[13px] font-semibold text-[#20372B] tabular-nums">
        {formatPeso(computeTotal(row))}
      </span>
    );
  }

  if (column.kind === "action") {
    return (
      <button
        type="button"
        onClick={() => onRemove(row.id)}
        disabled={!canRemove}
        aria-label={`${removeLabel}, row ${rowNumber}`}
        className="mx-auto flex size-8 items-center justify-center rounded-lg text-[#9AA69C] transition-colors hover:bg-[#F4DFD3] hover:text-[#9B3E2F] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5d7052]/30 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
    );
  }

  const value = String(row[column.key as keyof T] ?? "");
  const ariaLabel = `${column.label}, row ${rowNumber}`;

  if (column.kind === "money") {
    return (
      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#8A968C]"
        >
          ₱
        </span>
        <input
          type="number"
          min="0"
          step="0.01"
          aria-label={ariaLabel}
          value={value}
          placeholder={column.placeholder}
          onChange={(event) => onUpdate(row.id, column.key, event.target.value)}
          className="h-9 w-full min-w-0 rounded-lg border border-transparent bg-transparent py-0 pl-5 pr-2 text-right text-[13px] text-[#20372B] outline-none transition-colors [appearance:textfield] placeholder:text-[#9AA69C] hover:border-[rgba(53,78,57,0.18)] focus:border-[#5d7052] focus:bg-white focus:ring-[3px] focus:ring-[#5d7052]/[0.12] motion-reduce:transition-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />
      </div>
    );
  }

  return (
    <input
      type={column.kind === "text" ? "text" : "number"}
      min={column.kind === "text" ? undefined : "0"}
      step={column.kind === "number" ? column.step ?? "1" : undefined}
      aria-label={ariaLabel}
      value={value}
      placeholder={column.placeholder}
      onChange={(event) => onUpdate(row.id, column.key, event.target.value)}
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-transparent bg-transparent px-2 text-[13px] text-[#20372B] outline-none transition-colors [appearance:textfield] placeholder:text-[#9AA69C] hover:border-[rgba(53,78,57,0.18)] focus:border-[#5d7052] focus:bg-white focus:ring-[3px] focus:ring-[#5d7052]/[0.12] motion-reduce:transition-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
        (column.align === "right" || column.kind === "number") &&
          "text-right",
      )}
    />
  );
}
