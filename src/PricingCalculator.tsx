import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { calculatePricing, type CalculationMethod } from "./lib/calculator";
import { cn } from "@/lib/utils";
import { CostBreakdown } from "./components/cost-estimator/CostBreakdown";
import { CostDonutChart } from "./components/cost-estimator/CostDonutChart";
import { MaterialsModal } from "./components/cost-estimator/MaterialsModal";
import { loadMaterials, saveMaterials } from "./components/cost-estimator/material-library";
import {
  LaborSection,
  MaterialsSection,
  OtherCostsSection,
} from "./components/cost-estimator/ProductCostSections";
import { PricingMethodSelector } from "./components/cost-estimator/PricingMethodSelector";
import { PricingResult } from "./components/cost-estimator/PricingResult";
import {
  COST_ACCENTS,
  createLabor,
  createMaterials,
  createOtherCosts,
  nextId,
  numberValue,
  type LaborRow,
  type MaterialRecord,
  type MaterialRow,
  type OtherRow,
} from "./components/cost-estimator/shared";

const INITIAL_ROWS = 1;

export function PricingCalculator() {
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [margin, setMargin] = useState("25");
  const [amount, setAmount] = useState("20");
  const [price, setPrice] = useState("25");
  const [method, setMethod] = useState<CalculationMethod>("margin");
  const [materialRows, setMaterialRows] = useState(() =>
    createMaterials(INITIAL_ROWS),
  );
  const [laborRows, setLaborRows] = useState(() => createLabor(INITIAL_ROWS));
  const [otherRows, setOtherRows] = useState(() =>
    createOtherCosts(INITIAL_ROWS),
  );
  const [materials, setMaterials] = useState<MaterialRecord[]>(() =>
    loadMaterials(),
  );
  const [materialsOpen, setMaterialsOpen] = useState(false);

  useEffect(() => {
    saveMaterials(materials);
  }, [materials]);

  const materialTotal = materialRows.reduce(
    (sum, row) => sum + numberValue(row.quantity) * numberValue(row.unitCost),
    0,
  );
  const laborTotal = laborRows.reduce(
    (sum, row) =>
      sum + (numberValue(row.minutes) / 60) * numberValue(row.ratePerHour),
    0,
  );
  const otherTotal = otherRows.reduce(
    (sum, row) => sum + numberValue(row.quantity) * numberValue(row.cost),
    0,
  );
  const total = materialTotal + laborTotal + otherTotal;
  const shared = {
    totalCostBase: total,
    discount: numberValue(discount),
    tax: numberValue(tax),
  };
  const marginResult = calculatePricing({
    ...shared,
    method: "margin",
    margin: numberValue(margin),
    amount: 0,
    price: 0,
  });
  const amountResult = calculatePricing({
    ...shared,
    method: "amount",
    margin: 0,
    amount: numberValue(amount),
    price: 0,
  });
  const priceResult = calculatePricing({
    ...shared,
    method: "price",
    margin: 0,
    amount: 0,
    price: numberValue(price),
  });
  const result =
    method === "margin"
      ? marginResult
      : method === "amount"
        ? amountResult
        : priceResult;

  const updateMaterial = (id: number, patch: Partial<MaterialRow>) =>
    setMaterialRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const updateLabor = (id: number, patch: Partial<LaborRow>) =>
    setLaborRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const updateOther = (id: number, patch: Partial<OtherRow>) =>
    setOtherRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );

  const methodField = {
    margin: {
      label: "Profit margin (%)",
      value: margin,
      onChange: setMargin,
      suffix: "%",
    },
    amount: {
      label: "Profit amount",
      value: amount,
      onChange: setAmount,
      prefix: "₱",
    },
    price: {
      label: "Selling price",
      value: price,
      onChange: setPrice,
      prefix: "₱",
    },
  }[method];

  const donutSegments = [
    {
      key: "materials",
      label: "Materials",
      value: materialTotal,
      color: COST_ACCENTS.materials.solid,
    },
    {
      key: "labor",
      label: "Labor",
      value: laborTotal,
      color: COST_ACCENTS.labor.solid,
    },
    {
      key: "other",
      label: "Other costs",
      value: otherTotal,
      color: COST_ACCENTS.other.solid,
    },
  ];

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#F7F8F2] text-[#20372B]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 md:px-7 md:py-10 xl:px-10">
        <header className="relative">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 rounded-md text-[13px] font-medium text-[#66736A] transition-colors hover:text-[#20372B] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5d7052]/30 motion-reduce:transition-none"
          >
            <ArrowLeft aria-hidden="true" className="size-3.5" />
            Tools
          </Link>
          <div className="mt-4 flex flex-wrap items-start justify-between gap-6">
            <div>
              <h1 className="text-[32px] font-extrabold leading-[1.05] tracking-[-0.04em] text-[#20372B] md:text-[42px]">
                Product cost estimator
              </h1>
              <p className="mt-3 max-w-[560px] text-[15px] leading-relaxed text-[#66736A]">
                Build a cost base from materials, labor, and overhead. Set your
                margin and get a selling price.
              </p>
            </div>
            <p
              aria-hidden="true"
              className="hidden select-none -rotate-2 text-right font-serif text-[19px] italic leading-[1.2] text-[#8B9A83] sm:block"
            >
              Real
              <br />
              numbers
              <br />
              real progress
            </p>
          </div>
        </header>

        <div className="mt-6 space-y-4">
          <div className="overflow-hidden rounded-[18px] border border-[rgba(53,78,57,0.14)] bg-[#FBFCF8] shadow-[0_8px_24px_rgba(36,56,41,0.05)]">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-[25fr_45fr_30fr]">
              <section
                aria-labelledby="cost-graph-heading"
                className="border-b border-[rgba(53,78,57,0.12)] p-5 md:border-b-0 md:border-r lg:p-6"
              >
                <h2
                  id="cost-graph-heading"
                  className="text-[13px] font-bold uppercase tracking-[0.12em] text-[#66736A]"
                >
                  Cost graph
                </h2>
                <div className="mt-6 flex justify-center">
                  <CostDonutChart segments={donutSegments} />
                </div>
              </section>

              <section
                aria-labelledby="pricing-setup-heading"
                className="border-b border-[rgba(53,78,57,0.12)] p-5 lg:border-b-0 lg:border-r lg:p-6"
              >
                <h2
                  id="pricing-setup-heading"
                  className="text-[20px] font-bold text-[#20372B]"
                >
                  Pricing setup
                </h2>

                <div className="mt-5">
                  <h3 className="text-[15px] font-semibold text-[#20372B]">
                    1. Pricing method
                  </h3>
                  <p className="mt-1 text-[13px] text-[#66736A]">
                    Choose how the selling price should be calculated.
                  </p>
                  <div className="mt-3">
                    <PricingMethodSelector value={method} onChange={setMethod} />
                  </div>
                </div>

                <div className="mt-6">
                  <h3 className="text-[15px] font-semibold text-[#20372B]">
                    2. Set your values
                  </h3>
                  <p className="mt-1 text-[13px] text-[#66736A]">
                    Adjust the values below to calculate selling price.
                  </p>
                  <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <SetupField
                      label={methodField.label}
                      value={methodField.value}
                      onChange={methodField.onChange}
                      prefix={methodField.prefix}
                      suffix={methodField.suffix}
                    />
                    <SetupField
                      label="Discount (%)"
                      value={discount}
                      onChange={setDiscount}
                      suffix="%"
                    />
                    <SetupField
                      label="Sales tax (%)"
                      value={tax}
                      onChange={setTax}
                      suffix="%"
                    />
                  </div>
                </div>
              </section>

              <div className="md:col-span-2 lg:col-span-1">
                <PricingResult
                  totalCost={total}
                  profit={result.profit}
                  discountAmount={result.discountAmount}
                  salesTax={result.salesTax}
                  listingPrice={result.listingPrice}
                  method={method}
                  margin={margin}
                  discount={discount}
                  tax={tax}
                />
              </div>
            </div>
          </div>

          <CostBreakdown
            materialsTotal={materialTotal}
            laborTotal={laborTotal}
            otherTotal={otherTotal}
            totalCost={total}
          />

          <section
            aria-labelledby="product-costs-heading"
            className="rounded-[18px] border border-[rgba(53,78,57,0.14)] bg-[#FBFCF8] p-5 shadow-[0_8px_24px_rgba(36,56,41,0.05)] lg:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2
                  id="product-costs-heading"
                  className="text-[22px] font-bold text-[#20372B]"
                >
                  Product costs
                </h2>
                <p className="mt-1 text-sm text-[#66736A]">
                  List the costs for each category below.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMaterialsOpen(true)}
                className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#2F463A] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_6px_16px_rgba(47,70,58,0.28)] transition-colors hover:bg-[#20372B] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#5d7052]/40 motion-reduce:transition-none"
              >
                <PackagePlus aria-hidden="true" className="size-4" />
                Input materials
              </button>
            </div>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              <MaterialsSection
                rows={materialRows}
                total={materialTotal}
                materials={materials}
                onUpdate={updateMaterial}
                onRemove={(id) =>
                  setMaterialRows((rows) =>
                    rows.length > 1
                      ? rows.filter((row) => row.id !== id)
                      : rows,
                  )
                }
                onAdd={() =>
                  setMaterialRows((rows) => [
                    ...rows,
                    {
                      id: nextId(),
                      name: "",
                      quantity: "",
                      unit: "",
                      unitCost: "",
                    },
                  ])
                }
              />
              <LaborSection
                rows={laborRows}
                total={laborTotal}
                onUpdate={updateLabor}
                onRemove={(id) =>
                  setLaborRows((rows) =>
                    rows.length > 1 ? rows.filter((row) => row.id !== id) : rows,
                  )
                }
                onAdd={() =>
                  setLaborRows((rows) => [
                    ...rows,
                    {
                      id: nextId(),
                      description: "",
                      minutes: "",
                      ratePerHour: "",
                    },
                  ])
                }
              />
              <OtherCostsSection
                rows={otherRows}
                total={otherTotal}
                onUpdate={updateOther}
                onRemove={(id) =>
                  setOtherRows((rows) =>
                    rows.length > 1 ? rows.filter((row) => row.id !== id) : rows,
                  )
                }
                onAdd={() =>
                  setOtherRows((rows) => [
                    ...rows,
                    { id: nextId(), type: "", quantity: "", cost: "" },
                  ])
                }
              />
            </div>
          </section>
        </div>
      </div>

      <MaterialsModal
        open={materialsOpen}
        onOpenChange={setMaterialsOpen}
        materials={materials}
        onSave={setMaterials}
      />
    </main>
  );
}

function SetupField({
  label,
  value,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-medium text-[#66736A]">
        {label}
      </span>
      <div className="relative mt-2">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A968C]">
            {prefix}
          </span>
        )}
        <input
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className={cn(
            "h-[50px] w-full rounded-xl border border-[rgba(53,78,57,0.18)] bg-white text-[15px] text-[#20372B] outline-none transition-colors [appearance:textfield] focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[0.14] motion-reduce:transition-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            prefix ? "pl-7" : "pl-3.5",
            suffix ? "pr-7" : "pr-3.5",
          )}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#8A968C]">
            {suffix}
          </span>
        )}
      </div>
    </label>
  );
}
