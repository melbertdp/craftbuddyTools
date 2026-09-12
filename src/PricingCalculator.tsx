import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { calculatePricing, type CalculationMethod } from "./lib/calculator";

const numberValue = (value: string) => Number(value) || 0;
const money = (value: number) => value.toFixed(2);
const INITIAL_ROWS = 1;

type MaterialRow = { id: number; name: string; quantity: string; unit: string; unitCost: string };
type LaborRow = { id: number; description: string; minutes: string; ratePerHour: string };
type OtherRow = { id: number; type: string; quantity: string; cost: string };
type PricingResult = ReturnType<typeof calculatePricing>;

let rowId = 0;
const nextId = () => ++rowId;

function materials(count: number): MaterialRow[] {
  return Array.from({ length: count }, () => ({ id: nextId(), name: "", quantity: "", unit: "", unitCost: "" }));
}
function labor(count: number): LaborRow[] {
  return Array.from({ length: count }, () => ({ id: nextId(), description: "", minutes: "", ratePerHour: "" }));
}
function otherCosts(count: number): OtherRow[] {
  return Array.from({ length: count }, () => ({ id: nextId(), type: "", quantity: "", cost: "" }));
}

const METHODS: { value: CalculationMethod; label: string }[] = [
  { value: "margin", label: "Margin" },
  { value: "amount", label: "Profit amount" },
  { value: "price", label: "Selling price" },
];

export function PricingCalculator() {
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [margin, setMargin] = useState("25");
  const [amount, setAmount] = useState("20");
  const [price, setPrice] = useState("25");
  const [method, setMethod] = useState<CalculationMethod>("margin");
  const [materialRows, setMaterialRows] = useState(() => materials(INITIAL_ROWS));
  const [laborRows, setLaborRows] = useState(() => labor(INITIAL_ROWS));
  const [otherRows, setOtherRows] = useState(() => otherCosts(INITIAL_ROWS));

  const materialTotal = materialRows.reduce((sum, row) => sum + numberValue(row.quantity) * numberValue(row.unitCost), 0);
  const laborTotal = laborRows.reduce((sum, row) => sum + (numberValue(row.minutes) / 60) * numberValue(row.ratePerHour), 0);
  const otherTotal = otherRows.reduce((sum, row) => sum + numberValue(row.quantity) * numberValue(row.cost), 0);
  const total = materialTotal + laborTotal + otherTotal;
  const shared = { totalCostBase: total, discount: numberValue(discount), tax: numberValue(tax) };
  const marginResult = calculatePricing({ ...shared, method: "margin", margin: numberValue(margin), amount: 0, price: 0 });
  const amountResult = calculatePricing({ ...shared, method: "amount", margin: 0, amount: numberValue(amount), price: 0 });
  const priceResult = calculatePricing({ ...shared, method: "price", margin: 0, amount: 0, price: numberValue(price) });
  const result = method === "margin" ? marginResult : method === "amount" ? amountResult : priceResult;

  const updateMaterial = (id: number, patch: Partial<MaterialRow>) => setMaterialRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const updateLabor = (id: number, patch: Partial<LaborRow>) => setLaborRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const updateOther = (id: number, patch: Partial<OtherRow>) => setOtherRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));

  const methodField = {
    margin: { label: "Profit margin (%)", value: margin, onChange: setMargin, suffix: "%" as const },
    amount: { label: "Profit amount", value: amount, onChange: setAmount, prefix: "₱" as const },
    price: { label: "Selling price", value: price, onChange: setPrice, prefix: "₱" as const },
  }[method];

  return (
    <main className="mx-auto w-full max-w-[1720px] px-4 py-7 text-foreground md:px-7 md:py-9">
      <div className="space-y-4 rounded-lg border bg-white p-4 shadow-sm md:p-5">
        <div className="grid gap-4 lg:grid-cols-[1.7fr_1fr_1.15fr]">
          <h1 className="self-center font-serif text-5xl leading-none tracking-tight text-[#3f4d38] md:text-7xl">Pricing Calculator</h1>
          <StartHere productName={productName} sku={sku} setProductName={setProductName} setSku={setSku} />
          <Card className="flex min-h-[230px] items-center justify-center gap-0 overflow-hidden p-0">
            <PricingDonut segments={[{ label: "Total Material Costs", value: materialTotal, color: "#9caf88" }, { label: "Total Labor Costs", value: laborTotal, color: "#c3d1b5" }, { label: "Total Other Costs", value: otherTotal, color: "#7e9170" }]} />
          </Card>
        </div>

        <PricingStrategy
          productName={productName}
          total={total}
          materialTotal={materialTotal}
          laborTotal={laborTotal}
          otherTotal={otherTotal}
          result={result}
          method={method}
          setMethod={setMethod}
          methodField={methodField}
          discount={discount}
          tax={tax}
          setDiscount={setDiscount}
          setTax={setTax}
        />

        <Card className="gap-0 overflow-hidden p-0">
          <CardHeader className="border-b bg-[#dfe7d6] py-3"><CardTitle className="text-center text-xs uppercase tracking-[0.32em]">Product Costs</CardTitle></CardHeader>
          <div className="grid lg:grid-cols-3">
            <CostColumn title="Materials">
              <div className="grid grid-cols-[minmax(0,1fr)_70px_60px_90px_90px_28px] divide-x-2 divide-[#a9b8a0] border-b border-[#cbd8c3] bg-[#f4f7f1] text-[10px] font-bold uppercase text-muted-foreground">
                <span className="p-2">Material</span><span className="p-2 text-right">Quantity</span><span className="p-2">Unit</span><span className="p-2 text-right">Unit Cost</span><span className="p-2 text-right">Total Cost</span><span />
              </div>
              {materialRows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_70px_60px_90px_90px_28px] divide-x-2 divide-[#a9b8a0] border-b border-[#cbd8c3] last:border-0">
                <Input className="h-8 rounded-none border-0 text-xs" placeholder="Material name" value={row.name} onChange={(e) => updateMaterial(row.id, { name: e.target.value })} />
                <Input className="h-8 rounded-none border-0 text-right text-xs" type="number" min="0" step="1" value={row.quantity} onChange={(e) => updateMaterial(row.id, { quantity: e.target.value })} />
                <Input className="h-8 rounded-none border-0 text-xs" value={row.unit} onChange={(e) => updateMaterial(row.id, { unit: e.target.value })} />
                <MoneyInput value={row.unitCost} onChange={(value) => updateMaterial(row.id, { unitCost: value })} />
                <MoneyValue value={numberValue(row.quantity) * numberValue(row.unitCost)} />
                <RemoveButton disabled={materialRows.length <= 1} onClick={() => setMaterialRows((rows) => rows.filter((item) => item.id !== row.id))} />
              </div>)}
              <AddButton onClick={() => setMaterialRows((rows) => [...rows, { id: nextId(), name: "", quantity: "", unit: "", unitCost: "" }])}>+ Add material</AddButton>
            </CostColumn>
            <CostColumn title="Labor">
              <div className="grid grid-cols-[minmax(0,1fr)_82px_105px_90px_28px] divide-x-2 divide-[#a9b8a0] border-b border-[#cbd8c3] bg-[#f4f7f1] text-[10px] font-bold uppercase text-muted-foreground">
                <span className="p-2">Description</span><span className="p-2 text-right">Time (mins)</span><span className="p-2 text-right">Rate per Hour</span><span className="p-2 text-right">Total Cost</span><span />
              </div>
              {laborRows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_82px_105px_90px_28px] divide-x-2 divide-[#a9b8a0] border-b border-[#cbd8c3] last:border-0">
                <Input className="h-8 rounded-none border-0 text-xs" placeholder="Task description" value={row.description} onChange={(e) => updateLabor(row.id, { description: e.target.value })} />
                <Input className="h-8 rounded-none border-0 text-right text-xs" type="number" min="0" step="1" value={row.minutes} onChange={(e) => updateLabor(row.id, { minutes: e.target.value })} />
                <MoneyInput value={row.ratePerHour} onChange={(value) => updateLabor(row.id, { ratePerHour: value })} />
                <MoneyValue value={(numberValue(row.minutes) / 60) * numberValue(row.ratePerHour)} />
                <RemoveButton disabled={laborRows.length <= 1} onClick={() => setLaborRows((rows) => rows.filter((item) => item.id !== row.id))} />
              </div>)}
              <AddButton onClick={() => setLaborRows((rows) => [...rows, { id: nextId(), description: "", minutes: "", ratePerHour: "" }])}>+ Add labor</AddButton>
            </CostColumn>
            <CostColumn title="Other">
              <div className="grid grid-cols-[minmax(0,1fr)_70px_90px_90px_28px] divide-x-2 divide-[#a9b8a0] border-b border-[#cbd8c3] bg-[#f4f7f1] text-[10px] font-bold uppercase text-muted-foreground">
                <span className="p-2">Type</span><span className="p-2 text-right">Quantity</span><span className="p-2 text-right">Cost</span><span className="p-2 text-right">Total Cost</span><span />
              </div>
              {otherRows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_70px_90px_90px_28px] divide-x-2 divide-[#a9b8a0] border-b border-[#cbd8c3] last:border-0">
                <Input className="h-8 rounded-none border-0 text-xs" placeholder="e.g. Packaging" value={row.type} onChange={(e) => updateOther(row.id, { type: e.target.value })} />
                <Input className="h-8 rounded-none border-0 text-right text-xs" type="number" min="0" step="1" value={row.quantity} onChange={(e) => updateOther(row.id, { quantity: e.target.value })} />
                <MoneyInput value={row.cost} onChange={(value) => updateOther(row.id, { cost: value })} />
                <MoneyValue value={numberValue(row.quantity) * numberValue(row.cost)} />
                <RemoveButton disabled={otherRows.length <= 1} onClick={() => setOtherRows((rows) => rows.filter((item) => item.id !== row.id))} />
              </div>)}
              <AddButton onClick={() => setOtherRows((rows) => [...rows, { id: nextId(), type: "", quantity: "", cost: "" }])}>+ Add other cost</AddButton>
            </CostColumn>
          </div>
        </Card>
      </div>
    </main>
  );
}

function PricingStrategy({
  productName,
  total,
  materialTotal,
  laborTotal,
  otherTotal,
  result,
  method,
  setMethod,
  methodField,
  discount,
  tax,
  setDiscount,
  setTax,
}: {
  productName: string;
  total: number;
  materialTotal: number;
  laborTotal: number;
  otherTotal: number;
  result: PricingResult;
  method: CalculationMethod;
  setMethod: (value: CalculationMethod) => void;
  methodField: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string };
  discount: string;
  tax: string;
  setDiscount: (value: string) => void;
  setTax: (value: string) => void;
}) {
  return (
    <Card className="gap-0 overflow-hidden rounded-2xl border-[#dde3d6] p-0 shadow-sm">
      <Accordion type="single" defaultValue="strategy" collapsible>
        <AccordionItem value="strategy" className="border-b-0">
          <AccordionTrigger className="items-center px-4 py-3 hover:no-underline">
            <div className="flex flex-1 items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full bg-[#5d7052] text-sm font-bold text-white">01</span>
                <div className="text-left">
                  <div className="text-lg font-semibold text-[#3f4d38]">{productName || "Untitled product"}</div>
                  <div className="mt-0.5 text-sm text-muted-foreground">
                    Cost ₱{money(total)} <span className="px-1">•</span> Profit ₱{money(result.profit)} <span className="px-1">•</span> Actual margin {Math.round(result.actualMargin)}%
                  </div>
                </div>
              </div>
              <div className="hidden text-right sm:block">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Selling price</div>
                <div className="mt-1 text-2xl font-bold tracking-tight text-[#5d7052] tabular-nums">₱{money(result.listingPrice)}</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="p-0">
            <div className="border-t border-[#e6ebe0]">
              <div className="grid lg:grid-cols-3 lg:divide-x lg:divide-[#e6ebe0]">
                <section className="p-4 lg:px-5 lg:py-5">
                  <h2 className="text-lg font-semibold text-[#3f4d38]">1. Pricing method</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Choose how the selling price should be calculated.</p>
                  <div className="mt-3 inline-flex flex-wrap gap-1 rounded-full border border-[#dde3d6] bg-white p-1">
                    {METHODS.map((item) => (
                      <button
                        key={item.value}
                        type="button"
                        onClick={() => setMethod(item.value)}
                        className={cn(
                          "rounded-full px-4 py-2 text-sm font-medium transition-colors",
                          method === item.value ? "bg-[#5d7052] text-white" : "text-[#6f7f66] hover:text-[#3f4d38]",
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="border-t border-[#e6ebe0] p-4 lg:border-t-0 lg:px-5 lg:py-5">
                  <h2 className="text-lg font-semibold text-[#3f4d38]">2. Set your values</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Adjust the values below to calculate selling price.</p>
                  <div className="mt-3 grid gap-3 sm:grid-cols-3">
                    <StrategyField label={methodField.label} value={methodField.value} onChange={methodField.onChange} prefix={methodField.prefix} suffix={methodField.suffix} />
                    <StrategyField label="Discount (%)" value={discount} onChange={setDiscount} suffix="%" />
                    <StrategyField label="Sales tax (%)" value={tax} onChange={setTax} suffix="%" />
                  </div>
                </section>

                <section className="border-t border-[#e6ebe0] p-4 lg:border-t-0 lg:px-5 lg:py-5">
                  <h2 className="text-lg font-semibold text-[#3f4d38]">3. Pricing result</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Live calculation preview.</p>
                  <div className="mt-3 space-y-2 text-sm">
                    <ResultRow label="Total cost" value={`₱${money(total)}`} />
                    <ResultRow label="Profit" value={`+₱${money(result.profit)}`} accent />
                    <ResultRow label="Discount" value={`-₱${money(result.discountAmount)}`} />
                    <ResultRow label="Sales tax" value={`+₱${money(result.salesTax)}`} />
                    <div className="flex items-center justify-between border-t border-[#e6ebe0] pt-3">
                      <span className="text-base font-semibold text-[#3f4d38]">Selling price</span>
                      <span className="text-base font-bold text-[#5d7052] tabular-nums">₱{money(result.listingPrice)}</span>
                    </div>
                  </div>
                </section>
              </div>

              <div className="border-t border-[#e6ebe0] p-4 lg:px-5 lg:py-5">
                <div className="grid gap-4 lg:grid-cols-[280px_1fr] lg:items-center">
                  <div>
                    <h2 className="text-lg font-semibold text-[#3f4d38]">Cost breakdown</h2>
                    <div className="mt-3 space-y-1.5 text-sm">
                      <BreakdownRow label="Materials" value={materialTotal} />
                      <BreakdownRow label="Labour" value={laborTotal} />
                      <BreakdownRow label="Other costs" value={otherTotal} />
                      <div className="flex items-center justify-between border-t border-[#e6ebe0] pt-2 font-semibold text-[#3f4d38]">
                        <span>Total cost</span>
                        <span className="tabular-nums">₱{money(total)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <HighlightCard label="Total cost" value={total} caption="What it costs to make" />
                    <HighlightCard label="Profit" value={result.profit} caption="What you earn" accent />
                    <HighlightCard label="Selling price" value={result.listingPrice} caption="What you charge" />
                  </div>
                </div>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </Card>
  );
}

function StrategyField({ label, value, onChange, prefix, suffix }: { label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string }) {
  return (
    <label className="block">
      <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
      <div className="relative mt-2">
        {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{prefix}</span>}
        <Input
          className={cn("h-12 rounded-xl border-[#dde3d6] bg-white text-base shadow-none focus-visible:ring-[#5d7052]/20", prefix && "pl-8", suffix && "pr-8")}
          type="number"
          min="0"
          step="0.01"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </label>
  );
}

function ResultRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("font-semibold tabular-nums", accent ? "text-[#5f7d4f]" : "text-[#3f4d38]")}>{value}</span>
    </div>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between text-muted-foreground">
      <span>{label}</span>
      <span className="tabular-nums">₱{money(value)}</span>
    </div>
  );
}

function HighlightCard({ label, value, caption, accent }: { label: string; value: number; caption: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl bg-[#eef2e8] p-4">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-2 text-2xl font-bold tracking-tight tabular-nums", accent ? "text-[#5f7d4f]" : "text-[#3f4d38]")}>₱{money(value)}</div>
      <div className="mt-1 text-xs text-muted-foreground">{caption}</div>
    </div>
  );
}

function StartHere({ productName, sku, setProductName, setSku }: { productName: string; sku: string; setProductName: (value: string) => void; setSku: (value: string) => void }) {
  return <Card className="gap-0 overflow-hidden p-0"><div className="bg-[#dfe7d6] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.24em]">Start Here</div><div className="divide-y">
    <StartField label="Product Name"><Input className="h-8 rounded-none border-0 text-xs" value={productName} placeholder="sticker" onChange={(e) => setProductName(e.target.value)} /></StartField>
    <StartField label="SKU"><Input className="h-8 rounded-none border-0 text-xs" value={sku} placeholder="tag" onChange={(e) => setSku(e.target.value)} /></StartField>
  </div></Card>;
}

function StartField({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid grid-cols-2 items-center"><span className="bg-[#e9eee2] px-2 py-2 text-right text-xs font-bold">{label}</span>{children}</div>; }
function CostColumn({ title, children }: { title: string; children: React.ReactNode }) { return <div className="min-w-0 border-b lg:border-b-0 lg:border-r last:border-0"> <div className="border-b px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.22em]">{title}</div>{children}</div>; }
function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <Button type="button" variant="ghost" className="h-8 w-full rounded-none border-t text-xs" onClick={onClick}>{children}</Button>; }
function RemoveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) { return <Button type="button" variant="ghost" size="icon-xs" className="h-8 w-full rounded-none text-muted-foreground hover:text-destructive" disabled={disabled} onClick={onClick}>×</Button>; }
function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="flex items-center"><span className="pl-2 text-[11px] text-muted-foreground">₱</span><Input className="h-8 rounded-none border-0 text-right text-xs" type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function MoneyValue({ value }: { value: number }) { return <span className="flex h-8 items-center justify-end gap-1 px-2 text-xs"><span className="text-[11px] text-muted-foreground">₱</span>{money(value)}</span>; }

function PricingDonut({ segments }: { segments: { label: string; value: number; color: string }[] }) { const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0); const cx = 190; const cy = 150; const radius = 78; const thickness = 30; const circumference = 2 * Math.PI * radius; let running = 0; const arcs = segments.map((segment) => { const fraction = total ? Math.max(segment.value, 0) / total : 0; const length = fraction * circumference; const offset = running; const start = offset / circumference * 360 - 90; const mid = start + fraction * 180; running += length; return { segment, fraction, length, offset, mid }; }); return <svg className="h-auto w-full max-w-[460px]" viewBox="0 0 380 300" role="img" aria-label="Cost breakdown"><circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e6ebe0" strokeWidth={thickness} />{arcs.map(({ segment, length, offset }) => <circle key={segment.label} cx={cx} cy={cy} r={radius} fill="none" stroke={segment.color} strokeWidth={thickness} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} />)}{arcs.map(({ segment, fraction, mid }) => { if (!fraction) return null; const angle = mid * Math.PI / 180; const x1 = cx + Math.cos(angle) * (radius + thickness / 2 + 8); const y1 = cy + Math.sin(angle) * (radius + thickness / 2 + 8); const x2 = cx + Math.cos(angle) * (radius + thickness / 2 + 44); const y2 = cy + Math.sin(angle) * (radius + thickness / 2 + 44); const right = Math.cos(angle) >= 0; const tx = right ? x2 + 6 : x2 - 6; return <g key={`${segment.label}-label`}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#a9b8a0" strokeWidth="1" /><text x={tx} y={y2 - 1} textAnchor={right ? "start" : "end"} className="fill-[#4f5f47] text-[10px]">{segment.label}</text><text x={tx} y={y2 + 12} textAnchor={right ? "start" : "end"} className="fill-[#7d8f69] text-[10px]">{(fraction * 100).toFixed(1)}%</text></g>; })}</svg>; }
