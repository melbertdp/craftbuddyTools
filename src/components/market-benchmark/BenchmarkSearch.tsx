import { Search } from "lucide-react";

export function BenchmarkSearch({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <Search aria-hidden="true" className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#849187]" />
      <input aria-label="Search benchmarks" value={value} onChange={(event) => onChange(event.target.value)} placeholder="Search services, sizes, or categories…" className="h-10 w-full rounded-lg border border-[rgba(53,78,57,0.18)] bg-white pl-9 pr-3 text-sm text-[#20372B] outline-none placeholder:text-[#8a968c] focus:border-[#5d7052] focus:ring-4 focus:ring-[#5d7052]/10" />
    </label>
  );
}
