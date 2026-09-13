"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MATERIAL_UNITS,
  createMaterialRecord,
  formatPeso,
  materialCostPerUnit,
  type MaterialRecord,
} from "./shared";

function isBlankRow(record: MaterialRecord) {
  return !record.name && !record.totalCost && !record.units;
}

export function MaterialsModal({
  open,
  onOpenChange,
  materials,
  onSave,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  materials: MaterialRecord[];
  onSave: (materials: MaterialRecord[]) => void;
}) {
  const [draft, setDraft] = React.useState<MaterialRecord[]>(materials);

  React.useEffect(() => {
    if (open) {
      setDraft(
        materials.length > 0
          ? materials.map((record) => ({ ...record }))
          : [createMaterialRecord()],
      );
    }
  }, [open, materials]);

  const updateRow = (id: string, patch: Partial<MaterialRecord>) => {
    setDraft((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const addRow = () => setDraft((rows) => [...rows, createMaterialRecord()]);

  const removeRow = (id: string) =>
    setDraft((rows) =>
      rows.length > 1 ? rows.filter((row) => row.id !== id) : rows,
    );

  const save = () => {
    onSave(draft.filter((record) => !isBlankRow(record)));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-7xl">
        <DialogHeader>
          <DialogTitle>Input materials</DialogTitle>
          <DialogDescription>
            Build your materials library. Cost per unit is calculated from total
            cost divided by number of units.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] overflow-auto rounded-lg border border-[rgba(53,78,57,0.14)]">
          <table className="w-full border-collapse min-w-[620px]">
            <thead className="sticky top-0 z-10 bg-[#F1F4EC]">
              <tr className="border-b border-[rgba(53,78,57,0.14)]">
                {[
                  "Material",
                  "Total cost",
                  "Unit of measurement",
                  "# of units",
                  "Cost per unit",
                  "",
                ].map((label, index) => (
                  <th
                    key={label || `action-${index}`}
                    scope="col"
                    className="px-2 py-2 text-left text-[10px] font-semibold uppercase tracking-[0.06em] text-[#66736A]"
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {draft.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[rgba(53,78,57,0.08)] last:border-0"
                >
                  <td className="px-1 py-1.5">
                    <Input
                      aria-label="Material"
                      placeholder="Material name"
                      value={row.name}
                      onChange={(event) =>
                        updateRow(row.id, { name: event.target.value })
                      }
                      className="h-8 min-w-[150px] text-[13px]"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <div className="relative">
                      <span
                        aria-hidden="true"
                        className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[11px] text-[#8A968C]"
                      >
                        ₱
                      </span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label="Total cost"
                        placeholder="0.00"
                        value={row.totalCost}
                        onChange={(event) =>
                          updateRow(row.id, { totalCost: event.target.value })
                        }
                        className="h-8 min-w-[90px] pl-5 text-right text-[13px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                      />
                    </div>
                  </td>
                  <td className="px-1 py-1.5">
                    <Select
                      value={row.unit}
                      onValueChange={(value) => updateRow(row.id, { unit: value })}
                    >
                      <SelectTrigger
                        aria-label="Unit of measurement"
                        size="sm"
                        className="min-w-[110px]"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {MATERIAL_UNITS.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-1 py-1.5">
                    <Input
                      type="number"
                      min="0"
                      step="1"
                      aria-label="Number of units"
                      placeholder="0"
                      value={row.units}
                      onChange={(event) =>
                        updateRow(row.id, { units: event.target.value })
                      }
                      className="h-8 min-w-[80px] text-right text-[13px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </td>
                  <td className="px-1 py-1.5">
                    <span className="block min-w-[90px] px-2 text-right text-[13px] font-semibold tabular-nums text-[#20372B]">
                      {formatPeso(materialCostPerUnit(row))}
                    </span>
                  </td>
                  <td className="px-1 py-1.5">
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      disabled={draft.length <= 1}
                      aria-label="Remove material"
                      className="mx-auto flex size-8 items-center justify-center rounded-lg text-[#9AA69C] transition-colors hover:bg-[#F4DFD3] hover:text-[#9B3E2F] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5d7052]/30 disabled:pointer-events-none disabled:opacity-40 motion-reduce:transition-none"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Button type="button" variant="outline" onClick={addRow}>
          <Plus aria-hidden="true" className="size-4" /> Add row
        </Button>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={save}>
            Save materials
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
