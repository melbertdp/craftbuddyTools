"use client";

import { Info, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { BenchmarkDisclaimer } from "./BenchmarkDisclaimer";
import { BenchmarkSearch } from "./BenchmarkSearch";
import { BenchmarkTable, type SortKey } from "./BenchmarkTable";
import { BENCHMARKS, BENCHMARK_CATEGORIES } from "./data";
import { CategoryFilter } from "./CategoryFilter";
import { UnitFilter } from "./UnitFilter";

const QUICK_CATEGORIES = ["Document Printing", "Photo Printing", "Lamination", "Rush ID"];

export function MarketBenchmarkPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("category");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return BENCHMARKS.filter((record) => {
      const searchable = [record.category, record.service, record.variant, record.size, record.notes].filter(Boolean).join(" ").toLowerCase();
      return (!normalized || searchable.includes(normalized)) && (!category || record.category === category) && (!unit || record.unit === unit);
    }).sort((a, b) => {
      const left = a[sortKey];
      const right = b[sortKey];
      const comparison = typeof left === "number" && typeof right === "number" ? left - right : String(left).localeCompare(String(right));
      return direction === "asc" ? comparison : -comparison;
    });
  }, [category, direction, query, sortKey, unit]);

  function sortBy(nextKey: SortKey) {
    if (nextKey === sortKey) setDirection((value) => value === "asc" ? "desc" : "asc");
    else { setSortKey(nextKey); setDirection("asc"); }
  }

  function clearFilters() { setQuery(""); setCategory(""); setUnit(""); }

  return (
    <main className="min-h-[calc(100vh-72px)] bg-[#F7F8F2] text-[#20372B]">
      <div className="mx-auto w-full max-w-[1600px] px-4 py-8 md:px-7 md:py-10 xl:px-10">
        <header>
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#5d7052]">Reference library / Philippines</p>
          <h1 className="mt-2 text-[32px] font-extrabold leading-[1.05] tracking-[-0.045em] md:text-[42px]">Market Price Benchmark</h1>
          <p className="mt-3 max-w-[840px] text-[15px] leading-relaxed text-[#66736A]">Reference price ranges for common printing and related services. Use these prices as a market benchmark only - actual prices may vary depending on location, materials, print quality, quantity, and service provider.</p>
        </header>

        <div className="mt-5 flex items-start gap-2.5 border border-[#cbd8c3] bg-[#eef4ea] px-4 py-3 text-xs text-[#52684e]" role="note">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>Market prices are for reference only and do not affect your calculated cost or suggested selling price.</span>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2 border-b border-[rgba(53,78,57,0.14)] pb-4">
          {QUICK_CATEGORIES.map((item) => <button type="button" key={item} onClick={() => setCategory(category === item ? "" : item)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${category === item ? "border-[#5d7052] bg-[#5d7052] text-white" : "border-[#cbd8c3] bg-white text-[#526057] hover:bg-[#eef4ea]"}`}>{item}</button>)}
          <button type="button" onClick={() => setCategory(category && !QUICK_CATEGORIES.includes(category) ? "" : "")} className="rounded-full border border-dashed border-[#aebca8] px-3 py-1.5 text-xs font-semibold text-[#66736A] hover:bg-white">More Services <span className="ml-1 text-[10px]">{BENCHMARK_CATEGORIES.length - QUICK_CATEGORIES.length}</span></button>
        </div>

        <section className="mt-4 overflow-hidden rounded-[14px] border border-[rgba(53,78,57,0.14)] bg-[#FBFCF8] shadow-[0_8px_24px_rgba(36,56,41,0.05)]" aria-labelledby="benchmark-table-title">
          <div className="flex flex-wrap items-center gap-2 border-b border-[rgba(53,78,57,0.12)] p-3 md:p-4">
            <BenchmarkSearch value={query} onChange={setQuery} />
            <CategoryFilter value={category} onChange={setCategory} />
            <UnitFilter value={unit} onChange={setUnit} />
            <button type="button" onClick={clearFilters} className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-transparent px-3 text-sm text-[#66736A] hover:border-[#cbd8c3] hover:bg-white"><RotateCcw aria-hidden="true" className="size-3.5" />Clear Filters</button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 bg-[#f8faf6] px-4 py-2.5"><h2 id="benchmark-table-title" className="text-xs font-bold uppercase tracking-[0.1em] text-[#66736A]">Market benchmarks</h2><span className="text-xs text-[#66736A]">Showing <strong className="text-[#20372B]">{filtered.length}</strong> of {BENCHMARKS.length} benchmarks</span></div>
          <BenchmarkTable records={filtered} sortKey={sortKey} direction={direction} onSort={sortBy} />
        </section>

        <div className="mt-8"><BenchmarkDisclaimer /></div>
      </div>
    </main>
  );
}
