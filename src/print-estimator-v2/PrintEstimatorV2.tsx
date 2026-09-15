"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calculator,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
  Layers,
  Leaf,
  Receipt,
  RotateCw,
  Search,
  Tag,
  Trash2,
  Upload,
} from "lucide-react";
import type { V2ClassifiedPage, V2ColorClass } from "./types";
import { V2_COLOR_LABELS, V2_CONTENT_LABELS } from "./types";
import {
  V2_DEFAULT_RATES,
  V2_MARKET_RATES,
  loadV2Rates,
  loadV2Thresholds,
  saveV2Rates,
} from "./settings";
import { analyzeV2Image, analyzeV2Pdf, validateV2File } from "./analysis-engine";
import { applyOverride, averageColorCoverage, calculateV2Total, reviewCount } from "./pricing";

const PAGE_SIZE = 6;

const peso = (value: number) =>
  `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const OVERRIDE_OPTIONS: Array<{ value: "" | V2ColorClass; label: string }> = [
  { value: "", label: "Auto" },
  { value: "BW", label: "B&W" },
  { value: "LIGHT", label: "Light" },
  { value: "SEMI", label: "Semi" },
  { value: "FULL", label: "Full" },
];

const DOT_COLORS: Record<V2ColorClass, string> = {
  BW: "bg-gray-400",
  LIGHT: "bg-green-500",
  SEMI: "bg-amber-500",
  FULL: "bg-red-500",
};

const SUMMARY_STYLE: Record<V2ColorClass, { chip: string; icon: string }> = {
  BW: { chip: "bg-gray-100", icon: "text-gray-500" },
  LIGHT: { chip: "bg-green-100", icon: "text-green-600" },
  SEMI: { chip: "bg-amber-100", icon: "text-amber-600" },
  FULL: { chip: "bg-red-100", icon: "text-red-500" },
};

type FilterKey = "ALL" | V2ColorClass;

function rateFor(category: V2ColorClass, rates: typeof V2_DEFAULT_RATES): number {
  if (category === "BW") return rates.bw;
  if (category === "LIGHT") return rates.light;
  if (category === "SEMI") return rates.semi;
  return rates.full;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function timeAgo(timestamp: number | null): string {
  if (!timestamp) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 10) return "a few seconds ago";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours} hour${hours === 1 ? "" : "s"} ago`;
}

function pageNumbers(current: number, total: number): Array<number | "gap"> {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "gap", total];
  if (current >= total - 3) return [1, "gap", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "gap", current - 1, current, current + 1, "gap", total];
}

function SectionHeader({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-green-100 text-green-700">
        {icon}
      </span>
      <div>
        <h2 className="text-[17px] font-bold text-gray-900">{title}</h2>
        <p className="mt-0.5 text-[13px] text-gray-500">{subtitle}</p>
      </div>
    </div>
  );
}

function PriceField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[12px] font-medium text-gray-600">{label}</span>
      <input
        type="number"
        min="0"
        step="0.01"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-[14px] text-gray-900 outline-none focus:border-green-700 focus:ring-2 focus:ring-green-700/15"
      />
    </label>
  );
}

export function PrintEstimatorV2() {
  const [rates, setRates] = useState(loadV2Rates);
  const [thresholds] = useState(loadV2Thresholds);
  const [pages, setPages] = useState<V2ClassifiedPage[]>([]);
  const [fileName, setFileName] = useState("");
  const [fileMeta, setFileMeta] = useState({ kind: "", size: 0 });
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState("");
  const [analyzedAt, setAnalyzedAt] = useState<number | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [filter, setFilter] = useState<FilterKey>("ALL");
  const [search, setSearch] = useState("");
  const [tablePage, setTablePage] = useState(1);
  const [showCalibration, setShowCalibration] = useState(false);

  // Pricing drafts (applied on Recalculate).
  const [draftRates, setDraftRates] = useState({
    bw: String(rates.bw),
    light: String(rates.light),
    semi: String(rates.semi),
    full: String(rates.full),
  });
  const [draftCopies, setDraftCopies] = useState("1");
  const [draftPaper, setDraftPaper] = useState("0");
  const [draftAddons, setDraftAddons] = useState("0");
  const [draftDiscount, setDraftDiscount] = useState("0");
  const [appliedPricing, setAppliedPricing] = useState({
    copies: 1,
    paper: 0,
    addons: 0,
    discount: 0,
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const totals = useMemo(
    () =>
      calculateV2Total(pages, rates, {
        copies: appliedPricing.copies,
        paperAdjustmentPerPage: appliedPricing.paper,
        addons: appliedPricing.addons,
        discount: appliedPricing.discount,
        otherCharges: 0,
      }),
    [pages, rates, appliedPricing],
  );
  const avgColor = useMemo(() => averageColorCoverage(pages), [pages]);
  const needsReview = useMemo(() => reviewCount(pages), [pages]);

  const counts = useMemo(() => {
    const result: Record<V2ColorClass, number> = { BW: 0, LIGHT: 0, SEMI: 0, FULL: 0 };
    for (const page of pages) {
      if (page.status === "complete") result[page.finalCategory] += 1;
    }
    return result;
  }, [pages]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return pages.filter((page) => {
      if (filter !== "ALL" && page.finalCategory !== filter) return false;
      if (!query) return true;
      const haystack =
        `${page.pageNumber} ${V2_COLOR_LABELS[page.finalCategory]} ${V2_CONTENT_LABELS[page.contentClass]} ${V2_COLOR_LABELS[page.detectedCategory]}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [pages, filter, search]);

  const totalTablePages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safeTablePage = Math.min(tablePage, totalTablePages);
  const visiblePages = filtered.slice((safeTablePage - 1) * PAGE_SIZE, safeTablePage * PAGE_SIZE);
  const activePage = pages.find((p) => p.pageNumber === selectedPage) ?? pages[0];

  useEffect(() => {
    setTablePage(1);
  }, [filter, search, pages.length]);

  const progressPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;

  function handleFile(next: File | undefined) {
    if (!next) return;
    try {
      validateV2File(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unsupported file.");
      return;
    }
    const name = next.name.toLowerCase();
    const kind = next.type === "application/pdf" || name.endsWith(".pdf") ? "PDF" : "Image";
    setError("");
    setFile(next);
    setFileName(next.name);
    setFileMeta({ kind, size: next.size });
    setPages([]);
    setChecked(new Set());
    setSelectedPage(1);
    setTablePage(1);
    setAnalyzedAt(null);
    setProgress({ completed: 0, total: 0 });
  }

  async function analyze() {
    if (!file || processing) return;
    setError("");
    setProcessing(true);
    setPages([]);
    setChecked(new Set());
    setAnalyzedAt(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (isPdf) {
        const result = await analyzeV2Pdf(
          file,
          thresholds,
          (page, prog) => {
            setPages((current) => {
              const next = [...current.filter((p) => p.pageNumber !== page.pageNumber), page].sort(
                (a, b) => a.pageNumber - b.pageNumber,
              );
              return next;
            });
            setProgress(prog);
          },
          controller.signal,
        );
        setPages(result);
      } else {
        const result = await analyzeV2Image(file, thresholds);
        setPages(result);
        setProgress({ completed: 1, total: 1 });
      }
      setSelectedPage(1);
      setTablePage(1);
      setAnalyzedAt(Date.now());
    } catch (e) {
      if (e instanceof Error && e.message === "Analysis was cancelled.") {
        setError("Analysis was cancelled.");
      } else {
        setError(e instanceof Error ? e.message : "Could not analyze this file.");
        setPages([]);
      }
    } finally {
      setProcessing(false);
      abortRef.current = null;
    }
  }

  function setOverride(pageNumber: number, value: "" | V2ColorClass) {
    setPages((current) =>
      current.map((p) =>
        p.pageNumber === pageNumber ? applyOverride(p, value === "" ? null : value) : p,
      ),
    );
  }

  function toggleChecked(pageNumber: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else next.add(pageNumber);
      return next;
    });
  }

  function toggleVisible() {
    setChecked((current) => {
      const visibleIds = visiblePages.map((p) => p.pageNumber);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => current.has(id));
      const next = new Set(current);
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }

  function recalculate() {
    const nextRates = {
      bw: Number(draftRates.bw) || 0,
      light: Number(draftRates.light) || 0,
      semi: Number(draftRates.semi) || 0,
      full: Number(draftRates.full) || 0,
    };
    setRates(nextRates);
    saveV2Rates(nextRates);
    setAppliedPricing({
      copies: Math.max(1, Math.floor(Number(draftCopies) || 1)),
      paper: Number(draftPaper) || 0,
      addons: Number(draftAddons) || 0,
      discount: Number(draftDiscount) || 0,
    });
  }

  function useMarketRates() {
    setRates(V2_MARKET_RATES);
    setDraftRates({
      bw: String(V2_MARKET_RATES.bw),
      light: String(V2_MARKET_RATES.light),
      semi: String(V2_MARKET_RATES.semi),
      full: String(V2_MARKET_RATES.full),
    });
    saveV2Rates(V2_MARKET_RATES);
  }

  const visibleIds = visiblePages.map((p) => p.pageNumber);
  const allVisibleChecked =
    visibleIds.length > 0 && visibleIds.every((id) => checked.has(id));

  const pills: Array<{ key: FilterKey; label: string; count: number }> = [
    { key: "ALL", label: "All", count: pages.filter((p) => p.status === "complete").length },
    { key: "BW", label: "B&W", count: counts.BW },
    { key: "LIGHT", label: "Light", count: counts.LIGHT },
    { key: "SEMI", label: "Semi", count: counts.SEMI },
    { key: "FULL", label: "Full", count: counts.FULL },
  ];

  return (
    <main className="min-h-screen bg-[#f3f4f1] pb-20 text-gray-900">
      <div className="mx-auto w-full max-w-[1280px] px-5 py-8">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-[640px]">
            <h1 className="text-[32px] font-extrabold leading-tight tracking-tight">
              Print price calculator V2
            </h1>
            <p className="mt-2 text-[13.5px] leading-relaxed text-gray-500">
              Upload a PDF or image file and we&rsquo;ll analyze each page to estimate your print
              cost. Our tool detects content, color coverage, and layout to give you accurate
              pricing.
            </p>
          </div>
          
        </div>

        <div className="mt-6 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* Main column */}
          <div className="min-w-0 space-y-5">
            {/* 01 Document */}
            <section className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <SectionHeader
                icon={<Upload className="size-4" />}
                title="01 · Document"
                subtitle="Upload a document to analyze. We support PDF, PNG, JPG and more."
              />
              {!file ? (
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  className="mt-5 flex min-h-[110px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 text-gray-700 transition-colors hover:border-green-600 hover:bg-green-50/50"
                >
                  <strong className="text-[14px]">Drop a PDF or image here, or click to browse</strong>
                  <span className="text-[12px] text-gray-500">
                    PDF, PNG, JPG, or WEBP · analyzed at ~120 DPI · max 500 pages
                  </span>
                </button>
              ) : (
                <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-gray-200/70 bg-white px-4 py-3.5">
                  <span
                    className={`grid h-11 w-10 shrink-0 place-items-center rounded-lg text-[11px] font-extrabold text-white ${
                      fileMeta.kind === "PDF" ? "bg-red-500" : "bg-slate-500"
                    }`}
                  >
                    {fileMeta.kind === "PDF" ? "PDF" : "IMG"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-bold">{fileName}</p>
                    <p className="mt-0.5 truncate text-[12px] text-gray-500">
                      {fileMeta.kind}
                      {pages.length > 0 && ` · ${pages.length} pages`} · {formatBytes(fileMeta.size)}
                      {analyzedAt && ` · Analyzed ${timeAgo(analyzedAt)}`}
                    </p>
                  </div>
                  {pages.length > 0 && !processing && (
                    <CheckCircle2 className="size-6 shrink-0 text-green-500" />
                  )}
                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={analyze}
                      disabled={processing}
                      className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#23402f] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1a3124] disabled:opacity-50"
                    >
                      <RotateCw className="size-4" />
                      {pages.length > 0 ? "Re-analyze" : "Analyze file"}
                    </button>
                    {processing && (
                      <button
                        type="button"
                        onClick={() => abortRef.current?.abort()}
                        className="inline-flex h-10 items-center rounded-lg border border-red-200 px-3 text-[13px] font-semibold text-red-600"
                      >
                        Cancel
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setFile(null);
                        setFileName("");
                        setPages([]);
                        setChecked(new Set());
                        setAnalyzedAt(null);
                        setProgress({ completed: 0, total: 0 });
                      }}
                      disabled={processing}
                      className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 text-[13px] font-semibold text-red-500 transition-colors hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                      Remove
                    </button>
                  </div>
                </div>
              )}
              <input
                ref={inputRef}
                hidden
                type="file"
                accept="image/*,.pdf,application/pdf"
                onChange={(event) => handleFile(event.target.files?.[0] ?? undefined)}
              />
              {processing && progress.total > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-[12px] text-gray-500">
                    <span>
                      Analyzing pages… {progress.completed} / {progress.total}
                    </span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-100">
                    <div
                      className="h-full rounded-full bg-green-700 transition-[width]"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}
              {error && (
                <div className="mt-3 rounded-lg bg-red-50 p-3 text-[12px] text-red-700">{error}</div>
              )}
            </section>

            {/* 02 Document summary */}
            <section className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <SectionHeader
                  icon={<Tag className="size-4" />}
                  title="02 · Document summary"
                  subtitle="Detected page types and estimated subtotal based on current rates."
                />
                <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
                  {(["BW", "LIGHT", "SEMI", "FULL"] as V2ColorClass[]).map((category) => (
                    <div
                      key={category}
                      className="flex items-center gap-3 rounded-xl border border-gray-200/70 bg-white p-4"
                    >
                      <span
                        className={`grid size-10 shrink-0 place-items-center rounded-lg ${SUMMARY_STYLE[category].chip}`}
                      >
                        <FileText className={`size-5 ${SUMMARY_STYLE[category].icon}`} />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-[12px] text-gray-500">
                          {V2_COLOR_LABELS[category]}
                        </p>
                        <p className="text-[22px] font-extrabold leading-tight">
                          {counts[category]}
                        </p>
                        <p className="text-[12px] text-gray-500">
                          {peso(totals.subtotals[category] * totals.copies)} subtotal
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[12px] text-gray-500">
                  Average color coverage {avgColor.toFixed(1)}% · {needsReview} page
                  {needsReview === 1 ? "" : "s"} requiring review
                </p>
            </section>

            {/* 03 Pages */}
            <section className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <SectionHeader
                  icon={<Layers className="size-4" />}
                  title="03 · Pages"
                  subtitle="Review and edit page classification, or override rates if needed."
                />
                <div className="mt-5 flex flex-wrap items-center gap-2">
                  <div className="relative min-w-[200px] flex-1">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search pages..."
                      disabled={pages.length === 0}
                      className="h-10 w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-[13px] outline-none placeholder:text-gray-400 focus:border-green-700 focus:ring-2 focus:ring-green-700/15 disabled:bg-gray-50 disabled:text-gray-400"
                    />
                  </div>
                  {pills.map((pill) => (
                    <button
                      key={pill.key}
                      type="button"
                      onClick={() => setFilter(pill.key)}
                      disabled={pages.length === 0}
                      className={`h-10 rounded-lg px-3.5 text-[13px] font-medium transition-colors disabled:opacity-50 ${
                        filter === pill.key
                          ? "bg-[#23402f] text-white"
                          : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      {pill.label} ({pill.count})
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="grid size-10 place-items-center rounded-lg border border-gray-200">
                    <input
                      type="checkbox"
                      checked={allVisibleChecked}
                      onChange={toggleVisible}
                      disabled={visibleIds.length === 0}
                      aria-label="Select visible pages"
                      className="size-4 accent-green-800 disabled:opacity-40"
                    />
                  </span>
                  <span className="ml-1 text-[12px] text-gray-500">{checked.size} selected</span>
                </div>

                <div className="mt-3 max-h-[560px] overflow-auto rounded-xl border border-gray-200/70 [scrollbar-color:#cbd5c8_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-gray-300 [&::-webkit-scrollbar-track]:bg-transparent">
                  <table className="w-full min-w-[700px] border-collapse text-[13px]">
                    <thead className="sticky top-0 z-[1]">
                      <tr className="bg-[#f4f6f2] text-left text-[12px] text-gray-500">
                        <th className="bg-[#f4f6f2] px-3 py-3 font-medium">Page</th>
                        <th className="bg-[#f4f6f2] px-3 py-3 font-medium">Classification</th>
                        <th className="bg-[#f4f6f2] px-3 py-3 font-medium">Color %</th>
                        <th className="bg-[#f4f6f2] px-3 py-3 font-medium">Content</th>
                        <th className="bg-[#f4f6f2] px-3 py-3 font-medium">Rate</th>
                        <th className="bg-[#f4f6f2] px-3 py-3 font-medium">Override</th>
                        <th className="w-10 bg-[#f4f6f2] px-3 py-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {visiblePages.map((page) => (
                        <tr
                          key={page.pageNumber}
                          onClick={() => setSelectedPage(page.pageNumber)}
                          className={`cursor-pointer border-t border-gray-100 transition-colors hover:bg-green-50/40 ${
                            page.pageNumber === selectedPage ? "bg-green-50/60" : "bg-white"
                          }`}
                        >
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={checked.has(page.pageNumber)}
                              onChange={() => toggleChecked(page.pageNumber)}
                              aria-label={`Select page ${page.pageNumber}`}
                              className="size-4 accent-green-800"
                            />
                          </td>
                          <td className="px-3 py-3 font-medium">{page.pageNumber}</td>
                          <td className="px-3 py-3">
                            <span className="inline-flex items-center gap-2 whitespace-nowrap">
                              <span className={`size-2 rounded-full ${DOT_COLORS[page.finalCategory]}`} />
                              {V2_COLOR_LABELS[page.finalCategory]} {V2_CONTENT_LABELS[page.contentClass]}
                              {page.overrideCategory && (
                                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                                  override
                                </span>
                              )}
                            </span>
                          </td>
                          <td className="px-3 py-3 tabular-nums">
                            {(page.colorCoverage * 100).toFixed(1)}%
                          </td>
                          <td className="px-3 py-3">{V2_CONTENT_LABELS[page.contentClass]}</td>
                          <td className="px-3 py-3 tabular-nums">
                            {peso(rateFor(page.finalCategory, rates))}
                          </td>
                          <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                            <select
                              value={page.overrideCategory ?? ""}
                              onChange={(e) =>
                                setOverride(page.pageNumber, e.target.value as "" | V2ColorClass)
                              }
                              aria-label={`Override page ${page.pageNumber}`}
                              className="h-9 rounded-lg border border-gray-200 bg-white px-2 text-[13px] outline-none focus:border-green-700"
                            >
                              {OVERRIDE_OPTIONS.map((option) => (
                                <option key={option.value || "auto"} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                      {visiblePages.length === 0 && (
                        <tr className="border-t border-gray-100">
                          <td colSpan={7} className="px-3 py-8 text-center text-[13px] text-gray-500">
                            No pages match the current search or filter.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-[12px] text-gray-500">
                    Showing {visiblePages.length} of {filtered.length} pages
                  </p>
                  {totalTablePages > 1 && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={safeTablePage <= 1}
                        onClick={() => setTablePage((v) => Math.max(1, v - 1))}
                        aria-label="Previous table page"
                        className="grid size-8 place-items-center rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
                      >
                        <ChevronLeft className="size-4" />
                      </button>
                      {pageNumbers(safeTablePage, totalTablePages).map((item, index) =>
                        item === "gap" ? (
                          <span key={`gap-${index}`} className="px-1 text-[13px] text-gray-400">
                            …
                          </span>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setTablePage(item)}
                            className={`size-8 rounded-lg text-[13px] font-medium ${
                              item === safeTablePage
                                ? "bg-[#23402f] text-white"
                                : "border border-gray-200 text-gray-600 hover:border-gray-300"
                            }`}
                          >
                            {item}
                          </button>
                        ),
                      )}
                      <button
                        type="button"
                        disabled={safeTablePage >= totalTablePages}
                        onClick={() => setTablePage((v) => Math.min(totalTablePages, v + 1))}
                        aria-label="Next table page"
                        className="grid size-8 place-items-center rounded-lg border border-gray-200 text-gray-600 disabled:opacity-40"
                      >
                        <ChevronRight className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
            </section>

          </div>

          {/* Sidebar */}
          <div className="min-w-0 space-y-5">
            {/* Pricing */}
            <section className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-green-100 text-green-700">
                  <Receipt className="size-4" />
                </span>
                <div>
                  <h2 className="text-[17px] font-bold text-gray-900">Pricing</h2>
                  <p className="mt-0.5 text-[13px] text-gray-500">Set your print rates and options.</p>
                </div>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <PriceField
                  label="B&W rate (₱)"
                  value={draftRates.bw}
                  onChange={(v) => setDraftRates((d) => ({ ...d, bw: v }))}
                />
                <PriceField
                  label="Light rate (₱)"
                  value={draftRates.light}
                  onChange={(v) => setDraftRates((d) => ({ ...d, light: v }))}
                />
                <PriceField
                  label="Semi rate (₱)"
                  value={draftRates.semi}
                  onChange={(v) => setDraftRates((d) => ({ ...d, semi: v }))}
                />
                <PriceField
                  label="Full rate (₱)"
                  value={draftRates.full}
                  onChange={(v) => setDraftRates((d) => ({ ...d, full: v }))}
                />
                <PriceField label="Copies" value={draftCopies} onChange={setDraftCopies} />
                <PriceField label="Paper price (₱)" value={draftPaper} onChange={setDraftPaper} />
                <PriceField label="Add-ons (₱)" value={draftAddons} onChange={setDraftAddons} />
                <PriceField label="Discount (₱)" value={draftDiscount} onChange={setDraftDiscount} />
              </div>
              <button
                type="button"
                onClick={useMarketRates}
                className="mt-4 h-10 w-full rounded-lg border border-green-700/30 bg-green-50 px-4 text-[13px] font-semibold text-green-800 transition-colors hover:bg-green-100"
              >
                Use market rates
              </button>
              <div className="mt-4 rounded-xl bg-[#e9f1e4] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[12px] font-medium text-gray-600">Estimated total</p>
                    <p className="mt-1 text-[28px] font-extrabold leading-none text-green-800">
                      {peso(totals.grandTotal)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={recalculate}
                    className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg bg-[#23402f] px-4 text-[13px] font-semibold text-white transition-colors hover:bg-[#1a3124]"
                  >
                    <Calculator className="size-4" />
                    Recalculate
                  </button>
                </div>
                <p className="mt-2 text-right text-[11px] text-gray-500">
                  Based on current rates and {totals.printedPages} pages
                </p>
              </div>
            </section>

            {/* Preview */}
            {activePage && (
              <section className="rounded-2xl border border-gray-200/70 bg-white p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-green-100 text-green-700">
                      <Eye className="size-4" />
                    </span>
                    <div>
                      <h2 className="text-[17px] font-bold text-gray-900">Preview</h2>
                      <p className="mt-0.5 text-[13px] text-gray-500">
                        See the selected page and its analysis details.
                      </p>
                    </div>
                  </div>
                  <p className="shrink-0 text-[12px] text-gray-500">
                    Page {activePage.pageNumber} of {pages.length}
                  </p>
                </div>
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    disabled={activePage.pageNumber <= 1}
                    onClick={() => setSelectedPage((v) => Math.max(1, v - 1))}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-[13px] font-medium text-gray-600 disabled:opacity-40"
                  >
                    <ChevronLeft className="size-4" />
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={activePage.pageNumber >= pages.length}
                    onClick={() => setSelectedPage((v) => Math.min(pages.length, v + 1))}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-gray-200 px-4 text-[13px] font-medium text-gray-600 disabled:opacity-40"
                  >
                    Next
                    <ChevronRight className="size-4" />
                  </button>
                </div>
                <div className="mt-4 flex gap-4">
                  <div className="w-[46%] shrink-0 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
                    {activePage.previewUrl ? (
                      <img
                        src={activePage.previewUrl}
                        alt={`Page ${activePage.pageNumber} preview`}
                        className="h-auto w-full"
                      />
                    ) : (
                      <p className="p-6 text-center text-[12px] text-gray-400">
                        No preview available.
                      </p>
                    )}
                  </div>
                  <dl className="min-w-0 flex-1 space-y-2.5 text-[12.5px]">
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Detected</dt>
                      <dd className="inline-flex items-center gap-1.5 font-medium">
                        <span className={`size-2 rounded-full ${DOT_COLORS[activePage.finalCategory]}`} />
                        {V2_COLOR_LABELS[activePage.finalCategory]} {V2_CONTENT_LABELS[activePage.contentClass]}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Confidence</dt>
                      <dd className="font-medium tabular-nums">
                        {Math.round(activePage.confidence * 100)}%
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Color coverage</dt>
                      <dd className="font-medium tabular-nums">
                        {(activePage.colorCoverage * 100).toFixed(1)}%
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Content</dt>
                      <dd className="font-medium">{V2_CONTENT_LABELS[activePage.contentClass]}</dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Layout</dt>
                      <dd className="font-medium">
                        {activePage.layoutModel === "pp-doclayout"
                          ? "Model"
                          : activePage.layoutModel === "heuristic-fallback"
                            ? "Fallback"
                            : "-"}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <dt className="text-gray-500">Rate</dt>
                      <dd className="font-bold tabular-nums">
                        {peso(rateFor(activePage.finalCategory, rates))}
                      </dd>
                    </div>
                  </dl>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCalibration((v) => !v)}
                  className="mt-4 w-full rounded-lg border border-gray-200 px-3 py-2 text-[12px] font-semibold text-gray-600 hover:border-gray-300"
                >
                  {showCalibration ? "Hide calibration" : "Show calibration"}
                </button>
                {showCalibration && (
                  <div className="mt-3 rounded-lg bg-[#23402f] p-3 font-mono text-[11px] leading-relaxed text-green-100">
                    <div>Color coverage: {(activePage.colorCoverage * 100).toFixed(2)}%</div>
                    <div>Ink coverage: {(activePage.inkCoverage * 100).toFixed(2)}%</div>
                    <div>B&W coverage: {(activePage.bwCoverage * 100).toFixed(2)}%</div>
                    <div>White coverage: {(activePage.whiteCoverage * 100).toFixed(2)}%</div>
                    <div>Avg saturation: {activePage.averageSaturation.toFixed(3)}</div>
                    <div>Avg brightness: {activePage.averageBrightness.toFixed(3)}</div>
                    <div>Text coverage: {(activePage.textCoverage * 100).toFixed(1)}%</div>
                    <div>Image coverage: {(activePage.imageCoverage * 100).toFixed(1)}%</div>
                  </div>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
