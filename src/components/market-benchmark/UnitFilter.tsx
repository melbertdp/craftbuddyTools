const UNITS = ["per page", "per piece", "per package", "per sq. inch"] as const;

export function UnitFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <select aria-label="Filter by unit" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-lg border border-[rgba(53,78,57,0.18)] bg-white px-3 text-sm text-[#20372B] outline-none focus:border-[#5d7052] focus:ring-4 focus:ring-[#5d7052]/10"><option value="">All</option>{UNITS.map((unit) => <option key={unit} value={unit}>{unit.replace("per ", "Per ")}</option>)}</select>;
}
