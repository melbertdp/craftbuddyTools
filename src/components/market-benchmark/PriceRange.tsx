export function PriceRange({ low, high }: { low: number; high: number }) {
  const format = (value: number) => `₱${value.toLocaleString("en-PH")}`;
  return <span className="font-semibold tabular-nums">{format(low)}{low !== high && <> <span className="text-[#9aaa9a]">–</span> {format(high)}</>}</span>;
}
