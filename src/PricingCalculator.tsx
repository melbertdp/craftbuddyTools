import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { calculatePricing } from "./lib/calculator";

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

export function PricingCalculator() {
  const [productName, setProductName] = useState("");
  const [sku, setSku] = useState("");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [margin, setMargin] = useState("25");
  const [amount, setAmount] = useState("20");
  const [price, setPrice] = useState("25");
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

  const updateMaterial = (id: number, patch: Partial<MaterialRow>) => setMaterialRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const updateLabor = (id: number, patch: Partial<LaborRow>) => setLaborRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));
  const updateOther = (id: number, patch: Partial<OtherRow>) => setOtherRows((rows) => rows.map((row) => row.id === id ? { ...row, ...patch } : row));

  return (
    <main className="mx-auto w-full max-w-[1720px] px-5 py-12 text-foreground md:px-10 md:py-16">
      <div className="space-y-6 rounded-lg border bg-white p-5 shadow-sm md:p-9">
        <div className="grid gap-6 lg:grid-cols-[1.7fr_1fr_1.15fr]">
          <h1 className="self-center font-serif text-5xl leading-none tracking-tight text-neutral-900 md:text-7xl">Pricing Calculator</h1>
          <StartHere productName={productName} sku={sku} discount={discount} tax={tax} setProductName={setProductName} setSku={setSku} setDiscount={setDiscount} setTax={setTax} />
          <Card className="flex min-h-[300px] items-center justify-center overflow-hidden">
            <PricingDonut segments={[{ label: "Total Material Costs", value: materialTotal, color: "#f2ccd3" }, { label: "Total Labor Costs", value: laborTotal, color: "#cfe0f7" }, { label: "Total Other Costs", value: otherTotal, color: "#d6ddf4" }]} />
          </Card>
        </div>

        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Total Material Costs" value={materialTotal} />
          <Kpi label="Total Labor Costs" value={laborTotal} />
          <Kpi label="Total Other Costs" value={otherTotal} />
          <Kpi label="Total Cost Base" value={total} />
        </div>

        <div className="grid gap-5 xl:grid-cols-4">
          <CostSummary items={[{ label: "Total Material Costs", value: materialTotal, color: "#cfe0f7" }, { label: "Total Labor Costs", value: laborTotal, color: "#f5d0d6" }, { label: "Total Other Costs", value: otherTotal, color: "#c9d8f4" }]} />
          <PricingPanel variant="margin" title="Price by Profit Margin (%)" label="Target Profit Margin" value={margin} suffix="%" onChange={setMargin} total={total} result={marginResult} />
          <PricingPanel variant="amount" title="Price by Profit Amount (₱)" label="Target Profit Amount" value={amount} prefix="₱" onChange={setAmount} total={total} result={amountResult} />
          <PricingPanel variant="price" title="Profit by Sale Price (₱)" label="Target Sale Price" value={price} prefix="₱" onChange={setPrice} total={total} result={priceResult} />
        </div>

        <Card>
          <CardHeader className="border-b bg-[#e5e0f3] py-3"><CardTitle className="text-center text-xs uppercase tracking-[0.32em]">Product Costs</CardTitle></CardHeader>
          <div className="grid lg:grid-cols-3">
            <CostColumn title="Materials">
              <div className="grid grid-cols-[minmax(0,1fr)_70px_60px_90px_90px_28px] border-b text-[10px] font-bold uppercase text-muted-foreground">
                <span className="p-2">Material</span><span className="p-2 text-right">Quantity</span><span className="p-2">Unit</span><span className="p-2 text-right">Unit Cost</span><span className="p-2 text-right">Total Cost</span><span />
              </div>
              {materialRows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_70px_60px_90px_90px_28px] border-b last:border-0">
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
              <div className="grid grid-cols-[minmax(0,1fr)_82px_105px_90px_28px] border-b text-[10px] font-bold uppercase text-muted-foreground">
                <span className="p-2">Description</span><span className="p-2 text-right">Time (mins)</span><span className="p-2 text-right">Rate per Hour</span><span className="p-2 text-right">Total Cost</span><span />
              </div>
              {laborRows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_82px_105px_90px_28px] border-b last:border-0">
                <Input className="h-8 rounded-none border-0 text-xs" placeholder="Task description" value={row.description} onChange={(e) => updateLabor(row.id, { description: e.target.value })} />
                <Input className="h-8 rounded-none border-0 text-right text-xs" type="number" min="0" step="1" value={row.minutes} onChange={(e) => updateLabor(row.id, { minutes: e.target.value })} />
                <MoneyInput value={row.ratePerHour} onChange={(value) => updateLabor(row.id, { ratePerHour: value })} />
                <MoneyValue value={(numberValue(row.minutes) / 60) * numberValue(row.ratePerHour)} />
                <RemoveButton disabled={laborRows.length <= 1} onClick={() => setLaborRows((rows) => rows.filter((item) => item.id !== row.id))} />
              </div>)}
              <AddButton onClick={() => setLaborRows((rows) => [...rows, { id: nextId(), description: "", minutes: "", ratePerHour: "" }])}>+ Add labor</AddButton>
            </CostColumn>
            <CostColumn title="Other">
              <div className="grid grid-cols-[minmax(0,1fr)_70px_90px_90px_28px] border-b text-[10px] font-bold uppercase text-muted-foreground">
                <span className="p-2">Type</span><span className="p-2 text-right">Quantity</span><span className="p-2 text-right">Cost</span><span className="p-2 text-right">Total Cost</span><span />
              </div>
              {otherRows.map((row) => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_70px_90px_90px_28px] border-b last:border-0">
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

function StartHere({ productName, sku, discount, tax, setProductName, setSku, setDiscount, setTax }: { productName: string; sku: string; discount: string; tax: string; setProductName: (value: string) => void; setSku: (value: string) => void; setDiscount: (value: string) => void; setTax: (value: string) => void }) {
  return <Card className="overflow-hidden"><div className="bg-[#f6d7dc] px-3 py-2 text-center text-[11px] font-bold uppercase tracking-[0.24em]">Start Here</div><div className="divide-y">
    <StartField label="Product Name"><Input className="h-8 rounded-none border-0 text-xs" value={productName} placeholder="sticker" onChange={(e) => setProductName(e.target.value)} /></StartField>
    <StartField label="SKU"><Input className="h-8 rounded-none border-0 text-xs" value={sku} placeholder="tag" onChange={(e) => setSku(e.target.value)} /></StartField>
    <StartField label="Discount"><PercentInput value={discount} onChange={setDiscount} /></StartField>
    <StartField label="Sales Tax Rate"><PercentInput value={tax} onChange={setTax} /></StartField>
  </div></Card>;
}

function StartField({ label, children }: { label: string; children: React.ReactNode }) { return <div className="grid grid-cols-2 items-center"><span className="bg-[#f8e2e5] px-2 py-2 text-right text-xs font-bold">{label}</span>{children}</div>; }
function PercentInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="flex items-center"><Input className="h-8 rounded-none border-0 text-right text-xs" type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} /><span className="pr-2 text-xs text-muted-foreground">%</span></div>; }
function Kpi({ label, value }: { label: string; value: number }) { return <Card className="overflow-hidden"><div className="border-b bg-[#d9e1f7] px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.16em]">{label}</div><div className="flex items-center gap-3 px-4 py-4 text-lg font-semibold"><span className="text-xs text-muted-foreground">₱</span><span className="flex-1 text-center">{money(value)}</span></div></Card>; }
function CostColumn({ title, children }: { title: string; children: React.ReactNode }) { return <div className="min-w-0 border-b lg:border-b-0 lg:border-r last:border-0"> <div className="border-b px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.22em]">{title}</div>{children}</div>; }
function AddButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) { return <Button type="button" variant="ghost" className="h-8 w-full rounded-none border-t text-xs" onClick={onClick}>{children}</Button>; }
function RemoveButton({ disabled, onClick }: { disabled: boolean; onClick: () => void }) { return <Button type="button" variant="ghost" size="icon-xs" className="h-8 w-full rounded-none text-muted-foreground hover:text-destructive" disabled={disabled} onClick={onClick}>×</Button>; }
function MoneyInput({ value, onChange }: { value: string; onChange: (value: string) => void }) { return <div className="flex items-center border-l"><span className="pl-2 text-[11px] text-muted-foreground">₱</span><Input className="h-8 rounded-none border-0 text-right text-xs" type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} /></div>; }
function MoneyValue({ value }: { value: number }) { return <span className="flex h-8 items-center justify-end gap-1 border-l px-2 text-xs"><span className="text-[11px] text-muted-foreground">₱</span>{money(value)}</span>; }

function PricingPanel({ variant, title, label, value, onChange, prefix, suffix, total, result }: { variant: "margin" | "amount" | "price"; title: string; label: string; value: string; onChange: (value: string) => void; prefix?: string; suffix?: string; total: number; result: PricingResult }) {
  const header = variant === "amount" ? "bg-[#e2ddf3]" : "bg-[#f6d7dc]";
  const highlight = variant === "margin" ? "bg-[#dfe8fa]" : variant === "amount" ? "bg-[#e2ddf3]" : "bg-[#f6d7dc]";
  return <Card className="min-w-0 overflow-hidden"><div className={`${header} border-b px-2 py-3 text-center text-[11px] font-bold uppercase tracking-[0.14em]`}>{title}</div><CardContent className="space-y-3 p-4"><div className="flex min-w-0 items-center gap-2 text-xs font-semibold"><span className="min-w-0 flex-1 truncate">{label}</span><span className="flex min-w-0 flex-[0_1_104px] items-center border"><span className="pl-2 text-[11px] text-muted-foreground">{prefix}</span><Input className="h-7 min-w-0 rounded-none border-0 px-1 text-right text-xs" type="number" min="0" step="0.01" value={value} onChange={(e) => onChange(e.target.value)} /><span className="pr-2 text-[11px] text-muted-foreground">{suffix}</span></span></div><div className="space-y-1 text-xs"><PricingLine label="Total Product Cost" value={total} /><PricingLine label="Profit" value={result.profit} /><PricingLine label="Discount" value={result.discountAmount} /><PricingLine label="Listing Price" value={result.listingPrice} className={highlight} /><PricingLine label="Sales Tax" value={result.salesTax} /><PricingLine label="Price + Tax" value={result.finalPrice} /></div></CardContent></Card>;
}
function PricingLine({ label, value, className = "" }: { label: string; value: number; className?: string }) { return <div className={`flex items-center justify-between gap-2 px-0 py-1.5 ${className}`}><span>{label}</span><span className="font-semibold"><span className="mr-1 text-[11px] text-muted-foreground">₱</span>{money(value)}</span></div>; }

function CostSummary({ items }: { items: { label: string; value: number; color: string }[] }) { const max = Math.max(...items.map((item) => item.value), 0); const step = max <= 12 ? 2 : max <= 30 ? 5 : max <= 100 ? 10 : 100; const axisMax = Math.max(step, Math.ceil(max / step) * step); const ticks = Array.from({ length: Math.floor(axisMax / step) + 1 }, (_, index) => index * step); return <Card className="min-w-0 overflow-hidden"><CardHeader className="border-b py-3"><CardTitle className="text-center text-xs uppercase tracking-[0.2em]">Cost Summary</CardTitle></CardHeader><CardContent className="flex min-h-[280px] flex-col justify-center gap-5 p-4">{items.map((item) => <div key={item.label} className="grid grid-cols-[78px_1fr] items-center gap-2"><span className="text-right text-[10px] leading-tight">{item.label}</span><div className="h-8"><div className="h-full min-w-0" style={{ width: `${axisMax ? item.value / axisMax * 100 : 0}%`, backgroundColor: item.color }} /></div></div>)}<div className="ml-[86px] flex justify-between border-t pt-1 text-[9px] text-muted-foreground">{ticks.map((tick) => <span key={tick}>{tick.toFixed(2)}</span>)}</div></CardContent></Card>; }

  function PricingDonut({ segments }: { segments: { label: string; value: number; color: string }[] }) { const total = segments.reduce((sum, segment) => sum + Math.max(segment.value, 0), 0); const cx = 190; const cy = 150; const radius = 78; const thickness = 30; const circumference = 2 * Math.PI * radius; let running = 0; const arcs = segments.map((segment) => { const fraction = total ? Math.max(segment.value, 0) / total : 0; const length = fraction * circumference; const offset = running; const start = offset / circumference * 360 - 90; const mid = start + fraction * 180; running += length; return { segment, fraction, length, offset, mid }; }); return <svg className="h-auto w-full max-w-[460px]" viewBox="0 0 380 300" role="img" aria-label="Cost breakdown"><circle cx={cx} cy={cy} r={radius} fill="none" stroke="#ececf0" strokeWidth={thickness} />{arcs.map(({ segment, length, offset }) => <circle key={segment.label} cx={cx} cy={cy} r={radius} fill="none" stroke={segment.color} strokeWidth={thickness} strokeDasharray={`${length} ${circumference - length}`} strokeDashoffset={-offset} transform={`rotate(-90 ${cx} ${cy})`} />)}{arcs.map(({ segment, fraction, mid }) => { if (!fraction) return null; const angle = mid * Math.PI / 180; const x1 = cx + Math.cos(angle) * (radius + thickness / 2 + 8); const y1 = cy + Math.sin(angle) * (radius + thickness / 2 + 8); const x2 = cx + Math.cos(angle) * (radius + thickness / 2 + 44); const y2 = cy + Math.sin(angle) * (radius + thickness / 2 + 44); const right = Math.cos(angle) >= 0; const tx = right ? x2 + 6 : x2 - 6; return <g key={`${segment.label}-label`}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#b9b9b9" strokeWidth="1" /><text x={tx} y={y2 - 1} textAnchor={right ? "start" : "end"} className="fill-neutral-700 text-[10px]">{segment.label}</text><text x={tx} y={y2 + 12} textAnchor={right ? "start" : "end"} className="fill-neutral-500 text-[10px]">{(fraction * 100).toFixed(1)}%</text></g>; })}</svg>; }
