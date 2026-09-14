"use client";

import { useMemo, useRef, useState } from "react";
import type { V2ClassifiedPage, V2ColorClass } from "./types";
import { V2_COLOR_LABELS, V2_CONTENT_LABELS } from "./types";
import {
  V2_DEFAULT_RATES,
  V2_DEFAULT_THRESHOLDS,
  loadV2Rates,
  loadV2Thresholds,
  saveV2Rates,
} from "./settings";
import { analyzeV2Image, analyzeV2Pdf, validateV2File } from "./analysis-engine";
import { applyOverride, averageColorCoverage, calculateV2Total, reviewCount } from "./pricing";

const peso = (value: number) =>
  `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const OVERRIDE_OPTIONS: Array<{ value: "" | V2ColorClass; label: string }> = [
  { value: "", label: "Auto" },
  { value: "BW", label: "B&W" },
  { value: "LIGHT", label: "Light" },
  { value: "SEMI", label: "Semi" },
  { value: "FULL", label: "Full" },
];

function rateFor(category: V2ColorClass, rates: typeof V2_DEFAULT_RATES): number {
  if (category === "BW") return rates.bw;
  if (category === "LIGHT") return rates.light;
  if (category === "SEMI") return rates.semi;
  return rates.full;
}

export function PrintEstimatorV2() {
  const [rates, setRates] = useState(loadV2Rates);
  const [thresholds] = useState(loadV2Thresholds);
  const [pages, setPages] = useState<V2ClassifiedPage[]>([]);
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState("");
  const [selectedPage, setSelectedPage] = useState(1);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [copies, setCopies] = useState("1");
  const [paperAdjustment, setPaperAdjustment] = useState("0");
  const [addons, setAddons] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [otherCharges, setOtherCharges] = useState("0");
  const [showCalibration, setShowCalibration] = useState(false);
  const [layoutNotice] = useState(
    "PP-DocLayout-S loads from the hosted model asset when reachable; otherwise V2 uses a labeled heuristic fallback.",
  );
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const totals = useMemo(
    () =>
      calculateV2Total(pages, rates, {
        copies: Number(copies) || 1,
        paperAdjustmentPerPage: Number(paperAdjustment) || 0,
        addons: Number(addons) || 0,
        discount: Number(discount) || 0,
        otherCharges: Number(otherCharges) || 0,
      }),
    [pages, rates, copies, paperAdjustment, addons, discount, otherCharges],
  );
  const avgColor = useMemo(() => averageColorCoverage(pages), [pages]);
  const needsReview = useMemo(() => reviewCount(pages), [pages]);
  const activePage = pages.find((p) => p.pageNumber === selectedPage) ?? pages[0];

  function handleFile(next: File | undefined) {
    if (!next) return;
    try {
      validateV2File(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unsupported file.");
      return;
    }
    setError("");
    setFile(next);
    setFileName(next.name);
    setPages([]);
    setChecked(new Set());
    setSelectedPage(1);
    setProgress({ completed: 0, total: 0 });
  }

  async function analyze() {
    if (!file || processing) return;
    setError("");
    setProcessing(true);
    setPages([]);
    setChecked(new Set());
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

  function bulkSet(category: V2ColorClass) {
    setPages((current) =>
      current.map((p) => (checked.has(p.pageNumber) ? applyOverride(p, category) : p)),
    );
  }

  function bulkClear() {
    setPages((current) =>
      current.map((p) => (checked.has(p.pageNumber) ? applyOverride(p, null) : p)),
    );
  }

  function selectAll(predicate: (p: V2ClassifiedPage) => boolean) {
    setChecked(new Set(pages.filter(predicate).map((p) => p.pageNumber)));
  }

  function updateRate(key: keyof typeof V2_DEFAULT_RATES, value: string) {
    const next = { ...rates, [key]: Number(value) || 0 };
    setRates(next);
    saveV2Rates(next);
  }

  function toggleChecked(pageNumber: number) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(pageNumber)) next.delete(pageNumber);
      else next.add(pageNumber);
      return next;
    });
  }

  const progressPercent =
    progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
  const layoutStatus =
    pages.length === 0
      ? processing
        ? "loading"
        : "idle"
      : pages.some((p) => p.layoutModel === "pp-doclayout")
        ? "loaded"
        : "fallback";
  const layoutStatusLabel =
    layoutStatus === "loaded"
      ? "Layout model: PP-DocLayout-S loaded"
      : layoutStatus === "loading"
        ? "Layout model: loading…"
        : layoutStatus === "fallback"
          ? "Layout model: heuristic fallback (model not used)"
          : "Layout model: not run yet";

  return (
    <main className="mx-auto w-full max-w-[1280px] px-7 py-10 pb-24 max-[760px]:px-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
        Production / print job · V2
      </div>
      <h1 className="mt-2 text-[42px] font-extrabold leading-none tracking-tight max-[760px]:text-[34px]">
        Print price calculator V2
      </h1>
      <p className="mt-2 max-w-[640px] text-sm text-muted-foreground">
        Local page classification: B&W, Light, Semi, and Full Color with Text, Mixed, Image, and
        Scanned content. Overrides never destroy the automatic result.
      </p>
      <p className="mt-2 max-w-[640px] text-xs text-muted-foreground">{layoutNotice}</p>
      <p
        className={`mt-2 inline-block rounded-full px-3 py-1 text-xs font-bold ${
          layoutStatus === "loaded"
            ? "bg-[#e3f0e0] text-[#2f6b33]"
            : layoutStatus === "fallback"
              ? "bg-[#fdeecd] text-[#8a5a00]"
              : "bg-[#eef2e8] text-[#5f7d4f]"
        }`}
        role="status"
      >
        {layoutStatusLabel}
      </p>

      <div className="mt-6 rounded-xl border border-[#e8d9a8] bg-[#fdf8e7] px-4 py-3 text-[13px] text-[#7a5c00]">
        V2 is a separate workspace. The existing estimator at <strong>/print-estimator</strong> is
        unchanged.
      </div>

      <section className="mt-6 border border-[#cbd8c3] bg-[#fbfcf8] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">01 · Document</h2>
          {processing && progress.total > 0 && (
            <span className="text-xs text-primary">
              Analyzing pages… {progress.completed} / {progress.total} ({progressPercent}%)
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={processing}
          className="mt-4 flex min-h-[120px] w-full flex-col items-center justify-center gap-2 border border-dashed border-[#b7c7ad] bg-[#f2f6ee] disabled:opacity-70"
        >
          <strong>{fileName || "Drop a PDF or image here"}</strong>
          <span className="text-xs text-muted-foreground">
            PDF, PNG, JPG, or WEBP · PDF pages analyzed at ~120 DPI · max 500 pages
          </span>
          {processing && progress.total > 0 && (
            <span className="mt-2 h-1 w-[70%] bg-[#dce7d5]">
              <b className="block h-full bg-[#5d7052]" style={{ width: `${progressPercent}%` }} />
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          hidden
          type="file"
          accept="image/*,.pdf,application/pdf"
          onChange={(event) => handleFile(event.target.files?.[0] ?? undefined)}
        />
        {error && <div className="mt-3 bg-[#f3e1dc] p-3 text-xs text-[#8b4b44]">{error}</div>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={analyze}
            disabled={!file || processing}
            className="border border-[#5d7052] bg-[#5d7052] px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            {pages.length > 0 ? "Re-analyze file" : "Analyze file"}
          </button>
          {processing && (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="border border-[#8b4b44] px-4 py-2 text-xs font-bold text-[#8b4b44]"
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
              setProgress({ completed: 0, total: 0 });
            }}
            disabled={processing}
            className="px-3 py-2 text-xs text-muted-foreground underline disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </section>

      {pages.length > 0 && (
        <>
          <section className="mt-6 border border-[#cbd8c3] bg-[#fbfcf8] p-6">
            <h2 className="text-xl font-bold">02 · Document summary</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {fileName} · {pages.length} page{pages.length === 1 ? "" : "s"} · average color
              coverage {avgColor.toFixed(1)}% · {needsReview} page{needsReview === 1 ? "" : "s"}{" "}
              requiring review
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {(["BW", "LIGHT", "SEMI", "FULL"] as V2ColorClass[]).map((category) => (
                <div key={category} className="border border-[#dce7d5] bg-white p-4">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {V2_COLOR_LABELS[category]}
                  </div>
                  <div className="mt-1 text-3xl font-extrabold">{totals.counts[category]}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {peso(totals.subtotals[category])} at {peso(rateFor(category, rates))}/page
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-6 grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <section className="border border-[#cbd8c3] bg-[#fbfcf8] p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-bold">03 · Pages</h2>
                <div className="flex flex-wrap gap-2 text-xs">
                  <button type="button" onClick={() => bulkSet("BW")} className="border px-2 py-1">Set B&W</button>
                  <button type="button" onClick={() => bulkSet("LIGHT")} className="border px-2 py-1">Set Light</button>
                  <button type="button" onClick={() => bulkSet("SEMI")} className="border px-2 py-1">Set Semi</button>
                  <button type="button" onClick={() => bulkSet("FULL")} className="border px-2 py-1">Set Full</button>
                  <button type="button" onClick={bulkClear} className="border px-2 py-1">Clear overrides</button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <button type="button" className="underline" onClick={() => selectAll(() => true)}>Select all</button>
                <button type="button" className="underline" onClick={() => selectAll((p) => p.detectedCategory === "BW")}>Select all B&W</button>
                <button type="button" className="underline" onClick={() => selectAll((p) => p.detectedCategory === "LIGHT")}>Select all Light</button>
                <button type="button" className="underline" onClick={() => selectAll((p) => p.reviewRecommended)}>Select low-confidence</button>
                <button type="button" className="underline" onClick={() => setChecked(new Set())}>Clear selection</button>
                <span className="ml-auto">{checked.size} selected</span>
              </div>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-xs">
                  <thead>
                    <tr className="bg-[#eef4e9] text-left">
                      <th className="border p-2">Select</th>
                      <th className="border p-2">Page</th>
                      <th className="border p-2">Classification</th>
                      <th className="border p-2">Confidence</th>
                      <th className="border p-2">Color %</th>
                      <th className="border p-2">Content</th>
                      <th className="border p-2">Layout</th>
                      <th className="border p-2">Rate</th>
                      <th className="border p-2">Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pages.map((page) => (
                      <tr
                        key={page.pageNumber}
                        onClick={() => setSelectedPage(page.pageNumber)}
                        className={`cursor-pointer ${page.pageNumber === selectedPage ? "bg-[#e4edde]" : "bg-white"}`}
                      >
                        <td className="border p-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked.has(page.pageNumber)}
                            onChange={() => toggleChecked(page.pageNumber)}
                            aria-label={`Select page ${page.pageNumber}`}
                          />
                        </td>
                        <td className="border p-2 font-bold">{page.pageNumber}</td>
                        <td className="border p-2">
                          {V2_COLOR_LABELS[page.finalCategory]} {V2_CONTENT_LABELS[page.contentClass]}
                          {page.overrideCategory && (
                            <span className="ml-1 rounded bg-[#fef3c7] px-1">override</span>
                          )}
                        </td>
                        <td className="border p-2">
                          {Math.round(page.confidence * 100)}%
                          {page.reviewRecommended && <span className="ml-1">⚠ review</span>}
                        </td>
                        <td className="border p-2">{(page.colorCoverage * 100).toFixed(1)}%</td>
                        <td className="border p-2">{V2_CONTENT_LABELS[page.contentClass]}</td>
                        <td className="border p-2">
                          {page.layoutModel === "pp-doclayout" ? (
                            <span className="rounded bg-[#e3f0e0] px-1">model</span>
                          ) : page.layoutModel === "heuristic-fallback" ? (
                            <span className="rounded bg-[#fdeecd] px-1">fallback</span>
                          ) : (
                            <span>{page.layoutModel}</span>
                          )}
                        </td>
                        <td className="border p-2">{peso(rateFor(page.finalCategory, rates))}</td>
                        <td className="border p-2" onClick={(e) => e.stopPropagation()}>
                          <select
                            value={page.overrideCategory ?? ""}
                            onChange={(e) => setOverride(page.pageNumber, e.target.value as "" | V2ColorClass)}
                            aria-label={`Override page ${page.pageNumber}`}
                            className="border bg-white px-1 py-1"
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
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="space-y-6 lg:sticky lg:top-5">
              <section className="border border-[#cbd8c3] bg-[#fbfcf8] p-5">
                <h3 className="font-bold">Preview</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Page {selectedPage} / {pages.length}
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    disabled={selectedPage <= 1}
                    onClick={() => setSelectedPage((v) => Math.max(1, v - 1))}
                    className="border px-3 py-1 text-xs disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={selectedPage >= pages.length}
                    onClick={() => setSelectedPage((v) => Math.min(pages.length, v + 1))}
                    className="border px-3 py-1 text-xs disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
                <div className="mt-3 min-h-[220px] bg-white p-2">
                  {activePage?.previewUrl ? (
                    <img src={activePage.previewUrl} alt={`Page ${activePage.pageNumber} preview`} className="w-full" />
                  ) : (
                    <p className="p-6 text-center text-xs text-muted-foreground">No preview available.</p>
                  )}
                </div>
                {activePage && (
                  <dl className="mt-3 space-y-1 text-xs">
                    <div className="flex justify-between"><dt>Detected</dt><dd>{V2_COLOR_LABELS[activePage.detectedCategory]}</dd></div>
                    <div className="flex justify-between"><dt>Final</dt><dd>{V2_COLOR_LABELS[activePage.finalCategory]}</dd></div>
                    <div className="flex justify-between"><dt>Content</dt><dd>{V2_CONTENT_LABELS[activePage.contentClass]}</dd></div>
                    <div className="flex justify-between"><dt>Confidence</dt><dd>{Math.round(activePage.confidence * 100)}%</dd></div>
                    <div className="flex justify-between"><dt>Layout</dt><dd>{activePage.layoutModel}</dd></div>
                    <div className="flex justify-between"><dt>Ink</dt><dd>{(activePage.inkCoverage * 100).toFixed(1)}%</dd></div>
                    <div className="flex justify-between"><dt>Color</dt><dd>{(activePage.colorCoverage * 100).toFixed(1)}%</dd></div>
                  </dl>
                )}
                <button
                  type="button"
                  onClick={() => setShowCalibration((v) => !v)}
                  className="mt-3 w-full border px-3 py-2 text-xs font-bold"
                >
                  {showCalibration ? "Hide calibration" : "Show calibration"}
                </button>
                {showCalibration && activePage && (
                  <div className="mt-3 bg-[#26372b] p-3 text-[11px] leading-relaxed text-[#d7e6d3]">
                    <div>Color coverage: {(activePage.colorCoverage * 100).toFixed(2)}%</div>
                    <div>Ink coverage: {(activePage.inkCoverage * 100).toFixed(2)}%</div>
                    <div>B&W coverage: {(activePage.bwCoverage * 100).toFixed(2)}%</div>
                    <div>White coverage: {(activePage.whiteCoverage * 100).toFixed(2)}%</div>
                    <div>Average saturation: {activePage.averageSaturation.toFixed(3)}</div>
                    <div>Average brightness: {activePage.averageBrightness.toFixed(3)}</div>
                    <div>Text coverage: {(activePage.textCoverage * 100).toFixed(1)}%</div>
                    <div>Image coverage: {(activePage.imageCoverage * 100).toFixed(1)}%</div>
                    <div>Thresholds: B&W&lt;{(thresholds.bwMaxColorCoverage * 100).toFixed(1)}% · Light&lt;{(thresholds.lightMaxColorCoverage * 100).toFixed(1)}% · Semi&lt;{(thresholds.semiMaxColorCoverage * 100).toFixed(1)}%</div>
                  </div>
                )}
              </section>

              <section className="border border-[#26372b] bg-[#26372b] p-5 text-[#f7faf4]">
                <h3 className="font-bold">Pricing</h3>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  {(["bw", "light", "semi", "full"] as const).map((key) => (
                    <label key={key} className="flex flex-col gap-1">
                      <span className="uppercase text-[#afbea9]">{key} rate</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={String(rates[key])}
                        onChange={(e) => updateRate(key, e.target.value)}
                        className="h-9 rounded border border-[#5f745f] bg-[#34463a] px-2 text-white"
                      />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-[#afbea9]">Copies</span>
                    <input type="number" min="1" step="1" value={copies} onChange={(e) => setCopies(e.target.value)} className="h-9 rounded border border-[#5f745f] bg-[#34463a] px-2 text-white" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-[#afbea9]">Paper/page</span>
                    <input type="number" min="0" step="0.01" value={paperAdjustment} onChange={(e) => setPaperAdjustment(e.target.value)} className="h-9 rounded border border-[#5f745f] bg-[#34463a] px-2 text-white" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-[#afbea9]">Add-ons</span>
                    <input type="number" min="0" step="0.01" value={addons} onChange={(e) => setAddons(e.target.value)} className="h-9 rounded border border-[#5f745f] bg-[#34463a] px-2 text-white" />
                  </label>
                  <label className="flex flex-col gap-1">
                    <span className="uppercase text-[#afbea9]">Other</span>
                    <input type="number" min="0" step="0.01" value={otherCharges} onChange={(e) => setOtherCharges(e.target.value)} className="h-9 rounded border border-[#5f745f] bg-[#34463a] px-2 text-white" />
                  </label>
                  <label className="col-span-2 flex flex-col gap-1">
                    <span className="uppercase text-[#afbea9]">Discount</span>
                    <input type="number" min="0" step="0.01" value={discount} onChange={(e) => setDiscount(e.target.value)} className="h-9 rounded border border-[#5f745f] bg-[#34463a] px-2 text-white" />
                  </label>
                </div>
                <div className="mt-4 space-y-1 text-xs">
                  <div className="flex justify-between"><span>B&W {totals.counts.BW} × {peso(rates.bw)}</span><b>{peso(totals.subtotals.BW * totals.copies)}</b></div>
                  <div className="flex justify-between"><span>Light {totals.counts.LIGHT} × {peso(rates.light)}</span><b>{peso(totals.subtotals.LIGHT * totals.copies)}</b></div>
                  <div className="flex justify-between"><span>Semi {totals.counts.SEMI} × {peso(rates.semi)}</span><b>{peso(totals.subtotals.SEMI * totals.copies)}</b></div>
                  <div className="flex justify-between"><span>Full {totals.counts.FULL} × {peso(rates.full)}</span><b>{peso(totals.subtotals.FULL * totals.copies)}</b></div>
                  <div className="flex justify-between text-[#afbea9]"><span>Printed pages</span><b>{totals.printedPages}</b></div>
                  {totals.paperAdjustment > 0 && (
                    <div className="flex justify-between"><span>Paper adjustment</span><b>{peso(totals.paperAdjustment)}</b></div>
                  )}
                  {totals.discountAmount > 0 && (
                    <div className="flex justify-between"><span>Discount</span><b>-{peso(totals.discountAmount)}</b></div>
                  )}
                </div>
                <div className="mt-4 bg-[#5d7052] p-4">
                  <span className="block text-[11px] text-[#d7e6d3]">Total price</span>
                  <strong className="mt-1 block text-3xl">{peso(totals.grandTotal)}</strong>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRates({ ...V2_DEFAULT_RATES });
                    saveV2Rates({ ...V2_DEFAULT_RATES });
                  }}
                  className="mt-3 w-full border border-[#5f745f] px-3 py-2 text-xs"
                >
                  Restore default rates ₱3 / ₱4 / ₱6 / ₱10
                </button>
                <p className="mt-2 text-[10px] leading-relaxed text-[#9dad9f]">
                  Threshold defaults: B&W&lt;{(V2_DEFAULT_THRESHOLDS.bwMaxColorCoverage * 100).toFixed(0)}% ·
                  Light&lt;{(V2_DEFAULT_THRESHOLDS.lightMaxColorCoverage * 100).toFixed(0)}% ·
                  Semi&lt;{(V2_DEFAULT_THRESHOLDS.semiMaxColorCoverage * 100).toFixed(0)}%.
                </p>
              </section>
            </aside>
          </div>
        </>
      )}
    </main>
  );
}
