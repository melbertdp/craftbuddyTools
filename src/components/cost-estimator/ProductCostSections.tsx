import { Coins, Package, User } from "lucide-react";
import { CostSection } from "./CostSection";
import { CostTable, type CostColumn } from "./CostTable";
import {
  COST_ACCENTS,
  type LaborRow,
  type MaterialRecord,
  type MaterialRow,
  type OtherRow,
  materialCostPerUnit,
  numberValue,
} from "./shared";

const materialColumns = (materials: MaterialRecord[]): CostColumn[] => [
  {
    key: "name",
    label: "Material",
    kind: "combo",
    placeholder: "Select or type",
    options: Array.from(
      new Set(materials.map((material) => material.name).filter(Boolean)),
    ),
  },
  { key: "quantity", label: "Qty", kind: "number", width: 42, align: "right", placeholder: "0" },
  { key: "unit", label: "Unit", kind: "text", width: 44, placeholder: "pc" },
  { key: "unitCost", label: "Unit cost", kind: "money", width: 76, align: "right" },
  { key: "total", label: "Total", kind: "computed", width: 72, align: "right" },
  { key: "action", label: "", kind: "action", width: 40 },
];

const LABOR_COLUMNS: CostColumn[] = [
  { key: "description", label: "Task", kind: "text", placeholder: "Task description" },
  { key: "minutes", label: "Mins", kind: "number", width: 54, align: "right", placeholder: "0" },
  { key: "ratePerHour", label: "Rate/hour", kind: "money", width: 78, align: "right" },
  { key: "total", label: "Total", kind: "computed", width: 72, align: "right" },
  { key: "action", label: "", kind: "action", width: 40 },
];

const OTHER_COLUMNS: CostColumn[] = [
  { key: "type", label: "Type", kind: "text", placeholder: "e.g. Packaging" },
  { key: "quantity", label: "Qty", kind: "number", width: 42, align: "right", placeholder: "0" },
  { key: "cost", label: "Cost", kind: "money", width: 76, align: "right" },
  { key: "total", label: "Total", kind: "computed", width: 72, align: "right" },
  { key: "action", label: "", kind: "action", width: 40 },
];

export function MaterialsSection({
  rows,
  total,
  materials,
  onUpdate,
  onRemove,
  onAdd,
}: {
  rows: MaterialRow[];
  total: number;
  materials: MaterialRecord[];
  onUpdate: (id: number, patch: Partial<MaterialRow>) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
}) {
  return (
    <CostSection
      title="Materials"
      icon={Coins}
      accent={COST_ACCENTS.materials}
      total={total}
      addLabel="Add material"
      onAdd={onAdd}
    >
      <CostTable
        rows={rows}
        columns={materialColumns(materials)}
        removeLabel="Remove material"
        onUpdate={(id, key, value) => {
          if (key === "name") {
            const match = materials.find(
              (material) => material.name === value,
            );
            if (match) {
              onUpdate(id, {
                name: match.name,
                quantity: "1",
                unit: match.unit,
                unitCost: materialCostPerUnit(match).toFixed(2),
              });
            } else {
              onUpdate(id, { name: value, unitCost: "0" });
            }
            return;
          }
          onUpdate(id, { [key]: value } as Partial<MaterialRow>);
        }}
        onRemove={onRemove}
        computeTotal={(row) =>
          numberValue(row.quantity) * numberValue(row.unitCost)
        }
      />
    </CostSection>
  );
}

export function LaborSection({
  rows,
  total,
  onUpdate,
  onRemove,
  onAdd,
}: {
  rows: LaborRow[];
  total: number;
  onUpdate: (id: number, patch: Partial<LaborRow>) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
}) {
  return (
    <CostSection
      title="Labor"
      icon={User}
      accent={COST_ACCENTS.labor}
      total={total}
      addLabel="Add labor"
      onAdd={onAdd}
    >
      <CostTable
        rows={rows}
        columns={LABOR_COLUMNS}
        removeLabel="Remove labor"
        onUpdate={(id, key, value) => onUpdate(id, { [key]: value } as Partial<LaborRow>)}
        onRemove={onRemove}
        computeTotal={(row) =>
          (numberValue(row.minutes) / 60) * numberValue(row.ratePerHour)
        }
      />
    </CostSection>
  );
}

export function OtherCostsSection({
  rows,
  total,
  onUpdate,
  onRemove,
  onAdd,
}: {
  rows: OtherRow[];
  total: number;
  onUpdate: (id: number, patch: Partial<OtherRow>) => void;
  onRemove: (id: number) => void;
  onAdd: () => void;
}) {
  return (
    <CostSection
      title="Other costs"
      icon={Package}
      accent={COST_ACCENTS.other}
      total={total}
      addLabel="Add other cost"
      onAdd={onAdd}
    >
      <CostTable
        rows={rows}
        columns={OTHER_COLUMNS}
        removeLabel="Remove other cost"
        onUpdate={(id, key, value) => onUpdate(id, { [key]: value } as Partial<OtherRow>)}
        onRemove={onRemove}
        computeTotal={(row) =>
          numberValue(row.quantity) * numberValue(row.cost)
        }
      />
    </CostSection>
  );
}
