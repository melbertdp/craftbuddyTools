"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Link, NavLink, Route, Routes } from "react-router-dom";
import {
  analyzeImage,
  analyzePdf,
  renderPdfPreview,
  type InkPage,
} from "./lib/analysis";
import {
  calculatePrintCost,
  calculatePricing,
  DEFAULT_PROFILE,
  PAPER_SIZES,
  PAPER_TYPES,
  type CalculationMethod,
  type PrintPricingBasis,
  type PaperSize,
  type PaperType,
  type PrintProfile,
} from "./lib/calculator";
import type {
  ColorClass,
  ContentType,
  MarketService,
} from "./lib/market-pricing";

const peso = (value: number) =>
  `₱${value.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const numberValue = (value: string) => Number(value) || 0;
type AiContentType = ContentType | "photo" | "photo_set" | "unknown";

function mapAiContentType(value: AiContentType): ContentType | undefined {
  if (value === "photo" || value === "photo_set") return "image_only";
  if (value === "unknown") return undefined;
  return value;
}

async function imageFileToPngDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const value = new Image();
      value.onload = () => resolve(value);
      value.onerror = () => reject(new Error("Could not read this image."));
      value.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this image for AI analysis.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadProfile(): PrintProfile {
  if (typeof window === "undefined") return DEFAULT_PROFILE;
  try {
    return JSON.parse(window.localStorage.getItem("cb-profile") || "null") || DEFAULT_PROFILE;
  } catch {
    return DEFAULT_PROFILE;
  }
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link className="brand" to="/">
          <span className="brand-mark">CB</span>
          <span>
            CraftBuddy <em>Tools</em>
          </span>
        </Link>
        <nav>
          <NavLink to="/print-estimator">Print estimator</NavLink>
          <NavLink to="/cost-estimator">Cost estimator</NavLink>
          <NavLink to="/profiles">Profiles</NavLink>
        </nav>
      </header>
      {children}
      <footer>
        Private by design. Your files are processed in this browser.
      </footer>
    </div>
  );
}

function Home() {
  return (
    <main className="home page">
      <div className="eyebrow">Craft tools for real-world pricing</div>
      <h1>
        Know your cost.
        <br />
        <span>Price with confidence.</span>
      </h1>
      <p className="lede">
        Two focused calculators for makers, print shops, and small businesses.
        No account, no upload queue, no clutter.
      </p>
      <div className="tool-grid">
        <Link className="tool-card print-card" to="/print-estimator">
          <div className="card-kicker">01 / production</div>
          <h2>Print cost estimator</h2>
          <p>
            Read a design, account for paper and ink, then set a price that
            protects your margin.
          </p>
          <span className="card-link">
            Estimate a print job <b>↗</b>
          </span>
        </Link>
        <Link className="tool-card cost-card" to="/cost-estimator">
          <div className="card-kicker">02 / product</div>
          <h2>Product cost estimator</h2>
          <p>
            Build a cost base from materials, labor, and overhead with simple
            manual inputs.
          </p>
          <span className="card-link">
            Price a product <b>↗</b>
          </span>
        </Link>
      </div>
      <div className="privacy-note">
        <strong>Local processing</strong>
        <span>
          Images and PDFs never leave this browser. Reusable profiles stay on
          this device.
        </span>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  prefix,
  suffix,
  step = "any",
  max,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  prefix?: string;
  suffix?: string;
  step?: string;
  max?: string;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-wrap">
        {prefix && <i>{prefix}</i>}
        <input
          type="number"
          min="0"
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <i>{suffix}</i>}
      </div>
    </label>
  );
}

function PrintEstimator() {
  const [profile, setProfile] = useState<PrintProfile>(loadProfile);
  const [pages, setPages] = useState<InkPage[]>([]);
  const [fileName, setFileName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [artworkFile, setArtworkFile] = useState<File>();
  const [aiBusy, setAiBusy] = useState(false);
  const [aiAssistEnabled, setAiAssistEnabled] = useState(false);
  const [aiCooldown, setAiCooldown] = useState(() => {
    try {
      const until = Number(localStorage.getItem("cb-ai-cooldown-until"));
      return Number.isFinite(until)
        ? Math.max(0, Math.ceil((until - Date.now()) / 1000))
        : 0;
    } catch {
      return 0;
    }
  });
  const [aiResult, setAiResult] = useState("");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [quality, setQuality] = useState("Standard");
  const [paperType, setPaperType] = useState<PaperType>("Bond paper");
  const [paperSize, setPaperSize] = useState<PaperSize>("A4");
  const [printType, setPrintType] = useState<MarketService>("document_print");
  const [contentType, setContentType] = useState<ContentType>("text_only");
  const [colorClass, setColorClass] = useState<ColorClass>("black_white");
  const [copies, setCopies] = useState("1");
  const [maintenance, setMaintenance] = useState("1.5");
  const [electricity, setElectricity] = useState("0.5");
  const [labor, setLabor] = useState("0.25");
  const [waste, setWaste] = useState("10");
  const [overhead, setOverhead] = useState("10");
  const [margin, setMargin] = useState("30");
  const [pricingBasis, setPricingBasis] =
    useState<PrintPricingBasis>("markup");
  const [other, setOther] = useState("0");
  const [rounding, setRounding] = useState<
    | "none"
    | "nearest-1"
    | "up-1"
    | "nearest-5"
    | "up-5"
    | "nearest-10"
    | "up-10"
  >("none");
  const inputRef = useRef<HTMLInputElement>(null);
  const result = useMemo(
    () =>
      calculatePrintCost({
        pages,
        profile,
        paperSize,
        paperType,
        contentType,
        colorClass,
        printType,
        quality,
        copies: numberValue(copies),
        maintenance: numberValue(maintenance),
        electricity: numberValue(electricity),
        labor: numberValue(labor),
        waste: numberValue(waste),
        overhead: numberValue(overhead),
        margin: numberValue(margin),
        pricingBasis,
        other: numberValue(other),
        rounding,
      }),
    [
      pages,
      profile,
      paperSize,
      paperType,
      printType,
      contentType,
      colorClass,
      quality,
      copies,
      maintenance,
      electricity,
      labor,
      waste,
      overhead,
      margin,
      pricingBasis,
      other,
      rounding,
    ],
  );
  useEffect(() => {
    if (!aiCooldown) return;
    const timer = window.setInterval(
      () => setAiCooldown((value) => Math.max(0, value - 1)),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [aiCooldown]);
  useEffect(() => {
    try {
      const enabled = localStorage.getItem("cb-ai-assist-enabled");
      if (enabled != null) setAiAssistEnabled(enabled === "true");
    } catch {
      // Local storage is optional.
    }
  }, []);
  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError("");
    setProgress(0);
    setFileName(file.name);
    setArtworkFile(file);
    setPages([]);
    setAiResult("");
  }
  async function analyzeArtwork() {
    if (!artworkFile || processing) return;
    setError("");
    setProcessing(true);
    setProgress(0);
    try {
      const next =
        artworkFile.type === "application/pdf" ||
        artworkFile.name.toLowerCase().endsWith(".pdf")
          ? await analyzePdf(artworkFile, setProgress)
          : await analyzeImage(artworkFile);
      setPages(next);
      setProgress(100);
      if (aiAssistEnabled) await runAiAssist();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not analyze this file.");
      setPages([]);
    } finally {
      setProcessing(false);
    }
  }
  async function runAiAssist() {
    if (!artworkFile || aiBusy || aiCooldown > 0) return;
    setAiBusy(true);
    setAiResult("");
    try {
      const imageDataUrl = artworkFile.type.startsWith("image/")
        ? await imageFileToPngDataUrl(artworkFile)
        : await renderPdfPreview(artworkFile);
      const response = await fetch("/api/ai/identify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileName: artworkFile.name, imageDataUrl }),
      });
      const data = (await response.json()) as {
        error?: string;
        result?: string;
        classification?: {
          contentType: AiContentType;
          colorClass: ColorClass;
          confidence: number;
        };
      };
      if (!response.ok) throw new Error(data.error || "AI analysis failed.");
      if (!data.classification) throw new Error("AI returned no classification.");
      const mappedContentType = mapAiContentType(data.classification.contentType);
      if (mappedContentType) setContentType(mappedContentType);
      setColorClass(data.classification.colorClass);
      if (data.classification.contentType !== "unknown") {
        setPrintType(
          data.classification.contentType === "photo" ||
            data.classification.contentType === "photo_set"
            ? "photo_print"
            : "document_print",
        );
      }
      setAiResult(data.result || "No identification was returned.");
    } catch (error) {
      setAiResult(error instanceof Error ? error.message : "AI analysis failed.");
    } finally {
      setAiBusy(false);
      setAiCooldown(60);
      window.localStorage.setItem("cb-ai-cooldown-until", String(Date.now() + 60_000));
    }
  }
  function updateProfile(key: keyof PrintProfile, value: string) {
    const next = {
      ...profile,
      [key]: key === "name" ? value : numberValue(value),
    } as PrintProfile;
    setProfile(next);
    window.localStorage.setItem("cb-profile", JSON.stringify(next));
  }
  return (
    <main className="page estimator">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Production / print job</div>
          <h1>Print cost estimator</h1>
          <p>Analyze artwork locally, then build a defensible selling price.</p>
        </div>
        <Link className="quiet-link" to="/profiles">
          Manage profiles ↗
        </Link>
      </div>
      <div className="workspace">
        <section className="form-stack">
          <div className="panel upload-panel">
            <div className="panel-title">
              <div>
                <span className="step">01</span>
                <h2>Your artwork</h2>
              </div>
              {processing && (
                <span className="processing">
                  Analyzing {Math.round(progress)}%
                </span>
              )}
            </div>
            <label className="ai-toggle">
              <span>
                <strong>AI Assist</strong>
                <small>
                  {aiAssistEnabled
                    ? "Analyze file also identifies the document"
                    : "Manual file analysis only"}
                </small>
              </span>
              <input
                type="checkbox"
                checked={aiAssistEnabled}
                onChange={(event) => {
                  const enabled = event.target.checked;
                  setAiAssistEnabled(enabled);
                  if (!enabled) setAiResult("");
                  window.localStorage.setItem("cb-ai-assist-enabled", String(enabled));
                }}
              />
            </label>
            <button
              className="dropzone"
              onClick={() => inputRef.current?.click()}
              disabled={processing}
            >
              <strong>{fileName || "Drop a PDF or image here"}</strong>
              <span>
                {processing
                  ? "Reading every page locally…"
                  : "JPG, PNG, WEBP, or PDF · up to 20 PDF pages"}
              </span>
              {processing && (
                <span className="progress">
                  <b style={{ width: `${progress}%` }} />
                </span>
              )}
            </button>
            <input
              ref={inputRef}
              hidden
              type="file"
              accept="image/*,.pdf,application/pdf"
              onChange={(event) => handleFile(event.target.files?.[0])}
            />
            {error && <div className="error">{error}</div>}
            {artworkFile && pages.length === 0 && !processing && (
              <div className="file-status">
                <span className="status-dot" />
                {fileName} is ready to analyze
                <button
                  className="ai-button"
                  onClick={analyzeArtwork}
                  disabled={aiAssistEnabled && aiCooldown > 0}
                >
                  {aiAssistEnabled && aiCooldown > 0
                    ? `Analyze file (${aiCooldown}s)`
                    : "Analyze file"}
                </button>
                <button
                  onClick={() => {
                    setFileName("");
                    setArtworkFile(undefined);
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            {pages.length > 0 && (
              <div className="file-status">
                <span className="status-dot" />
                {pages.length} page{pages.length === 1 ? "" : "s"} analyzed ·
                rendered ink-load estimate{" "}
                {aiAssistEnabled && (
                  <button
                    className="ai-button"
                    onClick={runAiAssist}
                    disabled={
                      aiBusy ||
                      aiCooldown > 0 ||
                      !artworkFile?.type.startsWith("image/")
                    }
                  >
                    {aiBusy
                      ? "Identifying..."
                      : aiCooldown > 0
                        ? `Identify with AI (${aiCooldown}s)`
                        : "Identify with AI"}
                  </button>
                )}
                <button
                  onClick={() => {
                    setPages([]);
                    setFileName("");
                    setArtworkFile(undefined);
                    setAiResult("");
                  }}
                >
                  Remove
                </button>
              </div>
            )}
            {aiAssistEnabled && aiResult && (
              <div className="ai-result">{aiResult}</div>
            )}
          </div>
          <div className="panel">
            <div className="panel-title">
              <div>
                <span className="step">02</span>
                <h2>Print settings</h2>
              </div>
            </div>
            <div className="profile-row">
              <label className="field wide">
                <span>Printer profile</span>
                <select value={profile.id} onChange={() => undefined}>
                  <option value={profile.id}>{profile.name}</option>
                </select>
              </label>
              <label className="field">
                <span>Quality</span>
                <select
                  value={quality}
                  onChange={(event) => setQuality(event.target.value)}
                >
                  {Object.keys(profile.qualityRates).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="field-grid">
              <label className="field">
                <span>Print type</span>
                <select
                  value={printType}
                  onChange={(event) =>
                    setPrintType(event.target.value as MarketService)
                  }
                >
                  <option value="document_print">Document</option>
                  <option value="photo_print">Photo</option>
                </select>
              </label>
              <label className="field">
                <span>Paper type</span>
                <select
                  value={paperType}
                  onChange={(event) =>
                    setPaperType(event.target.value as PaperType)
                  }
                >
                  {PAPER_TYPES.map((type) => (
                    <option key={type}>{type}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Paper size</span>
                <select
                  value={paperSize}
                  onChange={(event) =>
                    setPaperSize(event.target.value as PaperSize)
                  }
                >
                  {Object.entries(PAPER_SIZES).map(([key, size]) => (
                    <option key={key} value={key}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </label>
              <Field
                label="Copies"
                value={copies}
                onChange={setCopies}
                step="1"
              />
              <Field
                label="Paper cost / sheet"
                value={String(profile.paperCost)}
                onChange={(value) => updateProfile("paperCost", value)}
                prefix="₱"
              />
              <Field
                label={pricingBasis === "markup" ? "Target markup" : "Target margin"}
                value={margin}
                onChange={setMargin}
                suffix="%"
                max={pricingBasis === "margin" ? "99.99" : undefined}
              />
              <label className="field">
                <span>Pricing basis</span>
                <select
                  value={pricingBasis}
                  onChange={(event) =>
                    setPricingBasis(event.target.value as PrintPricingBasis)
                  }
                >
                  <option value="markup">Markup on cost</option>
                  <option value="margin">Margin on selling price</option>
                </select>
              </label>
              <label className="field">
                <span>Content type</span>
                <select
                  value={contentType}
                  onChange={(event) =>
                    setContentType(event.target.value as ContentType)
                  }
                >
                  <option value="text_only">Text only</option>
                  <option value="image_only">Image only</option>
                  <option value="text_with_image">Text with image</option>
                </select>
              </label>
              <label className="field">
                <span>Color mode</span>
                <select
                  value={colorClass}
                  onChange={(event) =>
                    setColorClass(event.target.value as ColorClass)
                  }
                >
                  <option value="black_white">Black and white</option>
                  <option value="partial_color">Partial color</option>
                  <option value="full_color">Full color</option>
                </select>
              </label>
            </div>
            <p className="setting-note">
              {paperType} · {PAPER_SIZES[paperSize].label}. Paper dimensions are
              calculated from the selected size.
            </p>
            <details>
              <summary>Operating costs & pricing</summary>
              <div className="field-grid">
                <Field
                  label="Maintenance / page"
                  value={maintenance}
                  onChange={setMaintenance}
                  prefix="₱"
                />
                <Field
                  label="Electricity / page"
                  value={electricity}
                  onChange={setElectricity}
                  prefix="₱"
                />
                <Field
                  label="Labor / page"
                  value={labor}
                  onChange={setLabor}
                  prefix="₱"
                />
                <Field
                  label="Waste"
                  value={waste}
                  onChange={setWaste}
                  suffix="%"
                />
                <Field
                  label="Overhead"
                  value={overhead}
                  onChange={setOverhead}
                  suffix="%"
                />
                <Field
                  label="Other job costs"
                  value={other}
                  onChange={setOther}
                  prefix="₱"
                />
              </div>
              <label className="field">
                <span>Price rounding</span>
                <select
                  value={rounding}
                  onChange={(event) =>
                    setRounding(event.target.value as typeof rounding)
                  }
                >
                  <option value="none">No rounding</option>
                  <option value="up-1">Round up to ₱1</option>
                  <option value="up-5">Round up to ₱5</option>
                  <option value="up-10">Round up to ₱10</option>
                </select>
              </label>
            </details>
          </div>
        </section>
        <aside className="result-panel">
          {pages.length === 0 || processing || aiBusy ? (
            <div className="result-empty">
              <div className="result-label">
                {processing || aiBusy ? "Analyzing artwork" : "Your estimate"}
              </div>
              <div className="empty-mark">01</div>
              <h2>
                {processing
                  ? "Reading File"
                  : aiBusy
                    ? "Identifying artwork"
                    : "Upload artwork"}
                {!processing && !aiBusy && <><br />to begin</>}
              </h2>
              <p>
                {processing || aiBusy
                  ? "Your production estimate will appear after analysis is complete."
                  : "Once your file is analyzed, your production cost and suggested price will appear here."}
              </p>
            </div>
          ) : (
            <>
              <div className="result-label">Estimated production cost</div>
              <div className="result-total">{peso(result.totalCost)}</div>
              <div className="result-sub">
                {result.pageCount} printed page
                {result.pageCount === 1 ? "" : "s"}
              </div>
              <div className="metric-row">
                <div>
                  <span>Cost / print</span>
                  <strong>{peso(result.costPerPrint)}</strong>
                </div>
                <div>
                  <span>Ink load</span>
                  <strong>{result.averageInkLoad.toFixed(1)}%</strong>
                </div>
              </div>
              <div className="market-card">
                <div>
                  <span>Market reference</span>
                  <strong>
                    {result.marketReferenceAvailable &&
                    result.marketReference != null
                      ? peso(result.marketReference)
                      : "Unavailable"}
                  </strong>
                </div>
                {result.marketReferenceAvailable &&
                  result.marketReference != null && (
                    <p>
                      {result.suggestedJobPrice >= result.marketReference
                        ? "Suggested price is"
                        : "Suggested price is"}{" "}
                      {peso(
                        Math.abs(
                          result.suggestedJobPrice - result.marketReference,
                        ),
                      )}{" "}
                      {result.suggestedJobPrice >= result.marketReference
                        ? "above"
                        : "below"}{" "}
                      this reference.
                    </p>
                  )}
              </div>
              <div className="breakdown">
                <Row label="Ink" value={result.inkCost} />
                <Row label="Paper" value={result.paperCost} />
                <Row label="Maintenance" value={result.maintenanceCost} />
                <Row label="Electricity" value={result.electricityCost} />
                <Row label="Labor" value={result.laborCost} />
                <Row label="Waste" value={result.wasteCost} />
                <Row label="Overhead" value={result.overhead} />
              </div>
               <div className="suggestion">
                 <span>Suggested job price</span>
                 <strong>{peso(result.suggestedJobPrice)}</strong>
                <small>
                  {peso(result.profit)} profit ·{" "}
                   {result.actualMargin.toFixed(1)}% actual margin
                 </small>
               </div>
               <p className="disclaimer">
                Browser analysis estimates ink from rendered pixels. Actual
                printer separations may differ.
              </p>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <span>{label}</span>
      <b>{peso(value)}</b>
    </div>
  );
}

const MATERIAL_COLOR = "#557463";
const LABOUR_COLOR = "#bb563a";
const OTHER_COLOR = "#c08a4a";
const MAX_MATERIAL_ROWS = 12;
const MAX_LABOUR_ROWS = 5;
const MAX_OTHER_ROWS = 5;

type MaterialRow = {
  id: number;
  name: string;
  quantity: number;
  unitCost: number;
};
type LabourRow = {
  id: number;
  description: string;
  minutes: number;
  ratePerHour: number;
};
type OtherRow = {
  id: number;
  label: string;
  quantity: number;
  cost: number;
};

let costCellId = 0;
const nextCostCellId = () => ++costCellId;

const blankMaterials = (): MaterialRow[] => [
  { id: nextCostCellId(), name: "", quantity: 1, unitCost: 0 },
];
const blankLabour = (): LabourRow[] => [
  { id: nextCostCellId(), description: "", minutes: 0, ratePerHour: 0 },
];
const blankOther = (): OtherRow[] => [
  { id: nextCostCellId(), label: "", quantity: 1, cost: 0 },
];

function CostEstimator() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [method, setMethod] = useState<CalculationMethod>("margin");
  const [margin, setMargin] = useState("30");
  const [amount, setAmount] = useState("0");
  const [price, setPrice] = useState("0");
  const [discount, setDiscount] = useState("0");
  const [tax, setTax] = useState("0");
  const [materials, setMaterials] = useState<MaterialRow[]>(blankMaterials);
  const [labourRows, setLabourRows] = useState<LabourRow[]>(blankLabour);
  const [otherRows, setOtherRows] = useState<OtherRow[]>(blankOther);

  const materialTotal = materials.reduce(
    (sum, row) => sum + row.quantity * row.unitCost,
    0,
  );
  const labourTotal = labourRows.reduce(
    (sum, row) => sum + (row.minutes / 60) * row.ratePerHour,
    0,
  );
  const otherTotal = otherRows.reduce(
    (sum, row) => sum + row.quantity * row.cost,
    0,
  );
  const total = materialTotal + labourTotal + otherTotal;

  const result = calculatePricing({
    totalCostBase: total,
    method,
    margin: numberValue(margin),
    amount: numberValue(amount),
    price: numberValue(price),
    discount: numberValue(discount),
    tax: numberValue(tax),
  });

  function reset() {
    setName("");
    setDescription("");
    setMethod("margin");
    setMargin("30");
    setAmount("0");
    setPrice("0");
    setDiscount("0");
    setTax("0");
    setMaterials(blankMaterials());
    setLabourRows(blankLabour());
    setOtherRows(blankOther());
  }

  const updateMaterial = (id: number, patch: Partial<MaterialRow>) =>
    setMaterials((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const addMaterial = () =>
    setMaterials((rows) => [
      ...rows,
      { id: nextCostCellId(), name: "", quantity: 1, unitCost: 0 },
    ]);
  const removeMaterial = (id: number) =>
    setMaterials((rows) => rows.filter((row) => row.id !== id));

  const updateLabour = (id: number, patch: Partial<LabourRow>) =>
    setLabourRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const addLabour = () =>
    setLabourRows((rows) => [
      ...rows,
      { id: nextCostCellId(), description: "", minutes: 0, ratePerHour: 0 },
    ]);
  const removeLabour = (id: number) =>
    setLabourRows((rows) => rows.filter((row) => row.id !== id));

  const updateOther = (id: number, patch: Partial<OtherRow>) =>
    setOtherRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  const addOther = () =>
    setOtherRows((rows) => [
      ...rows,
      { id: nextCostCellId(), label: "", quantity: 1, cost: 0 },
    ]);
  const removeOther = (id: number) =>
    setOtherRows((rows) => rows.filter((row) => row.id !== id));

  return (
    <main className="page estimator cost-estimator">
      <div className="page-heading">
        <div>
          <div className="eyebrow">Product / manual inputs</div>
          <h1>Product cost estimator</h1>
          <p>
            Build the real cost of a product from materials, labor, and
            overhead — no inventory system required.
          </p>
        </div>
        <button className="quiet-link" onClick={reset}>
          Start over ↻
        </button>
      </div>
      <div className="workspace">
        <section className="form-stack">
          <div className="panel">
            <div className="panel-title">
              <div>
                <span className="step">01</span>
                <h2>Product</h2>
              </div>
              <strong className="section-subtotal">
                {name || "Unnamed product"}
              </strong>
            </div>
            <label className="field">
              <span>Product name</span>
              <input
                value={name}
                placeholder="e.g. Wedding invitation set"
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label className="field field-gap">
              <span>Description</span>
              <input
                value={description}
                placeholder="Optional notes about this product"
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
          </div>

          <div className="panel cost-group">
            <SectionHead
              step="02"
              title="Materials"
              hint="What goes into the product"
              accent="materials"
              count={materials.length}
              total={materialTotal}
            />
            {materials.length > 0 && (
              <div className="calc-lines">
                <div className="calc-col-head">
                  <span>Material</span>
                  <span>Qty</span>
                  <span>Unit cost</span>
                  <span className="align-right">Total</span>
                  <span />
                </div>
                {materials.map((row) => (
                  <div className="calc-line" key={row.id}>
                    <input
                      placeholder="Material name"
                      value={row.name}
                      onChange={(event) =>
                        updateMaterial(row.id, { name: event.target.value })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.quantity === 0 ? "" : row.quantity}
                      onWheel={(event) => event.currentTarget.blur()}
                      onChange={(event) =>
                        updateMaterial(row.id, {
                          quantity: numberValue(event.target.value),
                        })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.unitCost === 0 ? "" : row.unitCost}
                      onWheel={(event) => event.currentTarget.blur()}
                      onChange={(event) =>
                        updateMaterial(row.id, {
                          unitCost: numberValue(event.target.value),
                        })
                      }
                    />
                    <span className="line-total">
                      {peso(row.quantity * row.unitCost)}
                    </span>
                    <button
                      className="row-remove"
                      aria-label="Remove material"
                      onClick={() => removeMaterial(row.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              className="calc-add"
              disabled={materials.length >= MAX_MATERIAL_ROWS}
              onClick={addMaterial}
            >
              + Add material
            </button>
          </div>

          <div className="panel cost-group">
            <SectionHead
              step="03"
              title="Labor"
              hint="Time × hourly rate"
              accent="labour"
              count={labourRows.length}
              total={labourTotal}
            />
            {labourRows.length > 0 && (
              <div className="calc-lines">
                <div className="calc-col-head">
                  <span>Task</span>
                  <span>Minutes</span>
                  <span>Rate / hr</span>
                  <span className="align-right">Cost</span>
                  <span />
                </div>
                {labourRows.map((row) => (
                  <div className="calc-line" key={row.id}>
                    <input
                      placeholder="Task description"
                      value={row.description}
                      onChange={(event) =>
                        updateLabour(row.id, {
                          description: event.target.value,
                        })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.minutes === 0 ? "" : row.minutes}
                      onWheel={(event) => event.currentTarget.blur()}
                      onChange={(event) =>
                        updateLabour(row.id, {
                          minutes: numberValue(event.target.value),
                        })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.ratePerHour === 0 ? "" : row.ratePerHour}
                      onWheel={(event) => event.currentTarget.blur()}
                      onChange={(event) =>
                        updateLabour(row.id, {
                          ratePerHour: numberValue(event.target.value),
                        })
                      }
                    />
                    <span className="line-total">
                      {peso((row.minutes / 60) * row.ratePerHour)}
                    </span>
                    <button
                      className="row-remove"
                      aria-label="Remove labor row"
                      onClick={() => removeLabour(row.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              className="calc-add"
              disabled={labourRows.length >= MAX_LABOUR_ROWS}
              onClick={addLabour}
            >
              + Add labor
            </button>
          </div>

          <div className="panel cost-group">
            <SectionHead
              step="04"
              title="Other costs"
              hint="Packaging, fees, and extras"
              accent="other"
              count={otherRows.length}
              total={otherTotal}
            />
            {otherRows.length > 0 && (
              <div className="calc-lines">
                <div className="calc-col-head">
                  <span>Type</span>
                  <span>Qty</span>
                  <span>Cost</span>
                  <span className="align-right">Total</span>
                  <span />
                </div>
                {otherRows.map((row) => (
                  <div className="calc-line" key={row.id}>
                    <input
                      placeholder="e.g. Packaging"
                      value={row.label}
                      onChange={(event) =>
                        updateOther(row.id, { label: event.target.value })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={row.quantity === 0 ? "" : row.quantity}
                      onWheel={(event) => event.currentTarget.blur()}
                      onChange={(event) =>
                        updateOther(row.id, {
                          quantity: numberValue(event.target.value),
                        })
                      }
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.cost === 0 ? "" : row.cost}
                      onWheel={(event) => event.currentTarget.blur()}
                      onChange={(event) =>
                        updateOther(row.id, {
                          cost: numberValue(event.target.value),
                        })
                      }
                    />
                    <span className="line-total">
                      {peso(row.quantity * row.cost)}
                    </span>
                    <button
                      className="row-remove"
                      aria-label="Remove other cost"
                      onClick={() => removeOther(row.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button
              className="calc-add"
              disabled={otherRows.length >= MAX_OTHER_ROWS}
              onClick={addOther}
            >
              + Add other cost
            </button>
          </div>

          <div className="kpi-grid">
            <div className="kpi-tile materials">
              <span>Material costs</span>
              <strong>{peso(materialTotal)}</strong>
            </div>
            <div className="kpi-tile labour">
              <span>Labor costs</span>
              <strong>{peso(labourTotal)}</strong>
            </div>
            <div className="kpi-tile other">
              <span>Other costs</span>
              <strong>{peso(otherTotal)}</strong>
            </div>
            <div className="kpi-tile total">
              <span>Total cost base</span>
              <strong>{peso(total)}</strong>
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              <div>
                <span className="step">05</span>
                <h2>Pricing rule</h2>
              </div>
            </div>
            <div className="segmented">
              {(["margin", "amount", "price"] as CalculationMethod[]).map(
                (item) => (
                  <button
                    className={method === item ? "active" : ""}
                    key={item}
                    onClick={() => setMethod(item)}
                  >
                    {item === "margin"
                      ? "Margin %"
                      : item === "amount"
                        ? "Profit amount"
                        : "Selling price"}
                  </button>
                ),
              )}
            </div>
            <div className="field-grid">
              <Field
                label={
                  method === "margin"
                    ? "Target margin"
                    : method === "amount"
                      ? "Profit amount"
                      : "Selling price"
                }
                value={
                  method === "margin"
                    ? margin
                    : method === "amount"
                      ? amount
                      : price
                }
                onChange={
                  method === "margin"
                    ? setMargin
                    : method === "amount"
                      ? setAmount
                      : setPrice
                }
                prefix={method === "margin" ? undefined : "₱"}
                suffix={method === "margin" ? "%" : undefined}
              />
              <Field
                label="Discount"
                value={discount}
                onChange={setDiscount}
                suffix="%"
              />
              <Field
                label="Sales tax"
                value={tax}
                onChange={setTax}
                suffix="%"
              />
            </div>
          </div>

          <div className="panel">
            <div className="panel-title">
              <div>
                <span className="step">06</span>
                <h2>Price breakdown</h2>
              </div>
            </div>
            <div className="donut-wrap">
              <CostDonut
                segments={[
                  {
                    label: "Materials",
                    value: materialTotal,
                    color: MATERIAL_COLOR,
                  },
                  {
                    label: "Labor",
                    value: labourTotal,
                    color: LABOUR_COLOR,
                  },
                  { label: "Other", value: otherTotal, color: OTHER_COLOR },
                ]}
              />
              <div className="donut-legend">
                <div>
                  <i style={{ background: MATERIAL_COLOR }} />
                  <span>Materials</span>
                  <b>{peso(materialTotal)}</b>
                </div>
                <div>
                  <i style={{ background: LABOUR_COLOR }} />
                  <span>Labor</span>
                  <b>{peso(labourTotal)}</b>
                </div>
                <div>
                  <i style={{ background: OTHER_COLOR }} />
                  <span>Other costs</span>
                  <b>{peso(otherTotal)}</b>
                </div>
              </div>
            </div>
          </div>
        </section>
           <aside className="result-panel cost-result">
          <div className="result-label">Total cost base</div>
          <div className="result-total">{peso(total)}</div>
          <div className="result-sub">{name || "Unnamed product"}</div>
          {description && <div className="result-sub">{description}</div>}
          <div className="breakdown">
            <Row label="Materials" value={materialTotal} />
            <Row label="Labor" value={labourTotal} />
            <Row label="Other costs" value={otherTotal} />
          </div>
          <div className="suggestion">
            <span>Final customer price</span>
            <strong>{peso(result.finalPrice)}</strong>
            <small>
              {peso(result.profit)} profit · {result.actualMargin.toFixed(1)}%
              actual margin
            </small>
          </div>
          <div className="breakdown">
            <Row label="Listing price" value={result.listingPrice} />
            <Row label="Discount" value={-result.discountAmount} />
            <Row label="Sales tax" value={result.salesTax} />
          </div>
        </aside>
      </div>
    </main>
  );
}

function SectionHead({
  step,
  title,
  hint,
  accent,
  count,
  total,
}: {
  step: string;
  title: string;
  hint: string;
  accent: string;
  count: number;
  total: number;
}) {
  return (
    <div className="section-head">
      <div className="section-title">
        <span className="step">{step}</span>
        <div>
          <h2>{title}</h2>
          <span className="section-sub">{hint}</span>
        </div>
      </div>
      <div className="section-title">
        <span className="count-badge">{count}</span>
        <strong className={`section-subtotal accent-${accent}`}>
          {peso(total)}
        </strong>
      </div>
    </div>
  );
}

function CostDonut({
  segments,
}: {
  segments: { label: string; value: number; color: string }[];
}) {
  const total = segments.reduce(
    (sum, segment) => sum + Math.max(0, segment.value),
    0,
  );
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg
      className="donut"
      viewBox="0 0 150 150"
      role="img"
      aria-label="Cost breakdown"
    >
      <circle
        cx="75"
        cy="75"
        r={radius}
        fill="none"
        stroke="#ece3d8"
        strokeWidth="18"
      />
      {total > 0 &&
        segments.map((segment) => {
          const length = (Math.max(0, segment.value) / total) * circumference;
          const arc = (
            <circle
              key={segment.label}
              cx="75"
              cy="75"
              r={radius}
              fill="none"
              stroke={segment.color}
              strokeWidth="18"
              strokeDasharray={`${length} ${circumference - length}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 75 75)"
            />
          );
          offset += length;
          return arc;
        })}
      <text x="75" y="72" textAnchor="middle" className="donut-total-label">
        Total
      </text>
      <text x="75" y="92" textAnchor="middle" className="donut-total-value">
        {peso(total)}
      </text>
    </svg>
  );
}

function Profiles() {
  const [profile, setProfile] = useState<PrintProfile>(loadProfile);
  function exportProfile() {
    const blob = new Blob(
      [JSON.stringify({ version: 1, printers: [profile] }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "craftbuddy-tools-profiles.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }
  function importProfile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const next = data.printers?.[0];
        if (!next || typeof next.name !== "string") throw new Error();
        setProfile(next);
        window.localStorage.setItem("cb-profile", JSON.stringify(next));
      } catch {
        alert("That profile file is not valid.");
      }
    };
    reader.readAsText(file);
  }
  return (
    <main className="page profiles">
      <div className="eyebrow">Configuration / this device</div>
      <h1>Reusable profiles</h1>
      <p className="lede">
        Keep your everyday printer assumptions close. These settings stay in
        this browser and are never synced.
      </p>
      <div className="panel profile-editor">
        <label className="field">
          <span>Printer profile name</span>
          <input
            value={profile.name}
            onChange={(event) => {
              const next = { ...profile, name: event.target.value };
              setProfile(next);
              window.localStorage.setItem("cb-profile", JSON.stringify(next));
            }}
          />
        </label>
        <div className="field-grid">
          <Field
            label="Ink cost / ml"
            value={String(profile.inkCostPerMl)}
            onChange={(value) => {
              const next = { ...profile, inkCostPerMl: numberValue(value) };
              setProfile(next);
              window.localStorage.setItem("cb-profile", JSON.stringify(next));
            }}
            prefix="₱"
          />
          <Field
            label="Paper cost / sheet"
            value={String(profile.paperCost)}
            onChange={(value) => {
              const next = { ...profile, paperCost: numberValue(value) };
              setProfile(next);
              window.localStorage.setItem("cb-profile", JSON.stringify(next));
            }}
            prefix="₱"
          />
        </div>
        <div className="profile-actions">
          <button className="primary-button" onClick={exportProfile}>
            Export JSON
          </button>
          <label className="secondary-button">
            Import JSON
            <input
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(event) => importProfile(event.target.files?.[0])}
            />
          </label>
          <button
            className="secondary-button"
            onClick={() => {
              window.localStorage.removeItem("cb-profile");
              setProfile(DEFAULT_PROFILE);
            }}
          >
            Restore defaults
          </button>
        </div>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/print-estimator" element={<PrintEstimator />} />
          <Route path="/cost-estimator" element={<CostEstimator />} />
          <Route path="/profiles" element={<Profiles />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
