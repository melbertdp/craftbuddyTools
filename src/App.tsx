"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes } from "react-router-dom";
import {
  analyzeImage,
  analyzePdf,
  renderPdfPreview,
  type InkPage,
} from "./lib/analysis";
import {
  calculatePrintCost,
  DEFAULT_PROFILE,
  PAPER_SIZES,
  PAPER_TYPES,
  type PrintPricingBasis,
  type PaperSize,
  type PaperType,
  type PrintProfile,
} from "./lib/calculator";
import { PricingCalculator } from "./PricingCalculator";
import QRDesigner from "./qr/QRDesigner";
import { LandingPage } from "./components/landing/LandingPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

function Layout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-6 py-5 sm:px-8 lg:px-10">
        <Link className="flex items-center" to="/">
          <img className="h-7 w-auto max-w-[210px] object-contain" src="/logo.png" alt="CraftBuddy Tools" />
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-3 sm:gap-6">
          {[
            ["/print-estimator", "Print estimator"],
            ["/cost-estimator", "Cost estimator"],
            ["/qr-generator", "QR generator"],
            ["/profiles", "Profiles"],
          ].map(([to, label]) => (
            <Button key={to} className="h-auto rounded-none px-0 py-0 text-sm" variant="ghost" asChild>
              <NavLink
                to={to}
                className={({ isActive }) =>
                  isActive ? "text-foreground" : "text-muted-foreground"
                }
              >
                {label}
              </NavLink>
            </Button>
          ))}
          <Button className="h-auto rounded-none px-0 py-0 text-sm" variant="ghost" asChild>
            <a href="/pdf" className="text-muted-foreground">
              PDF tools
            </a>
          </Button>
        </nav>
      </header>
      <Outlet />
      <footer className="mx-auto w-full max-w-[1240px] px-6 py-8 text-sm text-muted-foreground sm:px-8 lg:px-10">
        Private by design. Your files are processed in this browser.
      </footer>
    </div>
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
    <Label className="flex flex-col items-stretch gap-2 text-xs font-semibold text-muted-foreground">
      <span>{label}</span>
      <div className="relative">
        {prefix && <i className="absolute left-3 top-1/2 z-[1] -translate-y-1/2 text-xs not-italic text-muted-foreground">{prefix}</i>}
        <Input
           className={`h-[42px] rounded border-[#cbd8c3] bg-[#fbfcf8] text-[#2f3d32] outline-none focus-visible:border-[#5d7052] focus-visible:ring-[3px] focus-visible:ring-[#5d7052]/[.18] ${prefix ? "pl-[34px]" : ""} ${suffix ? "pr-[35px]" : ""}`}
          type="number"
          min="0"
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        {suffix && <i className="absolute right-3 top-1/2 z-[1] -translate-y-1/2 text-xs not-italic text-muted-foreground">{suffix}</i>}
      </div>
    </Label>
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
    <main className="mx-auto w-full max-w-[1184px] px-7 py-[62px] pb-[100px] max-[760px]:px-5 max-[760px]:py-12 max-[760px]:pb-[70px]">
      <div className="mb-[38px] flex items-end justify-between max-[760px]:block">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">Production / print job</div>
          <h1 className="mt-2 font-heading text-[45px] font-extrabold leading-[1.02] tracking-[-0.055em] max-[760px]:text-[37px]">Print cost estimator</h1>
          <p className="mt-2 text-muted-foreground">Analyze artwork locally, then build a defensible selling price.</p>
        </div>
        <Link className="text-[13px] text-muted-foreground no-underline max-[760px]:mt-5 max-[760px]:inline-block" to="/profiles">
          Manage profiles ↗
        </Link>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_350px] items-start gap-[22px] max-[760px]:grid-cols-1">
        <section className="flex flex-col gap-[14px]">
          <div className="border border-[#cbd8c3] bg-[#fbfcf8] p-6 max-[760px]:p-[18px]">
            <div className="mb-[22px] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-heading text-[11px] font-bold text-primary">01</span>
                <h2 className="font-heading text-xl tracking-[-0.04em]">Your artwork</h2>
              </div>
              {processing && (
                <span className="text-xs text-primary">
                  Analyzing {Math.round(progress)}%
                </span>
              )}
            </div>
            <label className="my-[18px] mb-1 flex items-center justify-between gap-4 border border-[#cbd8c3] bg-[#f2f6ee] px-3.5 py-3">
              <span className="flex flex-col gap-[3px]">
                <strong>AI Assist</strong>
                <small className="text-[11px] text-muted-foreground">
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
              className="flex min-h-[135px] w-full flex-col items-center justify-center gap-2 border border-dashed border-[#b7c7ad] bg-[#f2f6ee] text-[#2f3d32] disabled:opacity-75"
              onClick={() => inputRef.current?.click()}
              disabled={processing}
            >
              <strong>{fileName || "Drop a PDF or image here"}</strong>
                <span className="text-xs text-muted-foreground">
                {processing
                  ? "Reading every page locally…"
                  : "JPG, PNG, WEBP, or PDF · up to 20 PDF pages"}
              </span>
              {processing && (
                  <span className="mt-2 h-1 w-[70%] bg-[#dce7d5]">
                    <b className="block h-full bg-[#5d7052] transition-[width] duration-200" style={{ width: `${progress}%` }} />
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
            {error && <div className="mt-[14px] bg-[#f3e1dc] p-[11px] text-xs text-[#8b4b44]">{error}</div>}
            {artworkFile && pages.length === 0 && !processing && (
              <div className="mt-[14px] flex items-center gap-2 text-xs text-[#5f7d4f]">
                <span className="size-[7px] shrink-0 rounded-full bg-[#5f7d4f]" />
                {fileName} is ready to analyze
                <button
                  className="ml-0 border border-[#5d7052] bg-[#5d7052] px-3 py-2 text-xs font-bold text-[#f7faf4] hover:bg-[#4b5d42] disabled:cursor-not-allowed disabled:opacity-55"
                  onClick={analyzeArtwork}
                  disabled={aiAssistEnabled && aiCooldown > 0}
                >
                  {aiAssistEnabled && aiCooldown > 0
                    ? `Analyze file (${aiCooldown}s)`
                    : "Analyze file"}
                </button>
                <button className="ml-auto border-0 bg-transparent text-xs text-muted-foreground underline"
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
              <div className="mt-[14px] flex items-center gap-2 text-xs text-[#5f7d4f]">
                <span className="size-[7px] shrink-0 rounded-full bg-[#5f7d4f]" />
                {pages.length} page{pages.length === 1 ? "" : "s"} analyzed ·
                rendered ink-load estimate{" "}
                {aiAssistEnabled && (
                  <button
                    className="ml-0 border border-[#5d7052] bg-[#5d7052] px-3 py-2 text-xs font-bold text-[#f7faf4] hover:bg-[#4b5d42] disabled:cursor-not-allowed disabled:opacity-55"
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
                <button className="ml-auto border-0 bg-transparent text-xs text-muted-foreground underline"
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
              <div className="mt-[14px] bg-[#f2f6ee] p-3 text-[13px] leading-[1.5] text-[#2f3d32]">{aiResult}</div>
            )}
          </div>
          <div className="border border-[#cbd8c3] bg-[#fbfcf8] p-6 max-[760px]:p-[18px]">
            <div className="mb-[22px] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="font-heading text-[11px] font-bold text-primary">02</span>
                <h2 className="font-heading text-xl tracking-[-0.04em]">Print settings</h2>
              </div>
            </div>
            <div className="flex gap-[14px] max-[760px]:grid max-[760px]:grid-cols-2 max-[420px]:grid-cols-1">
              <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-muted-foreground max-[760px]:col-span-full max-[420px]:col-span-1">
                <span>Printer profile</span>
                <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]" value={profile.id} onChange={() => undefined}>
                  <option value={profile.id}>{profile.name}</option>
                </select>
              </label>
              <label className="flex flex-1 flex-col gap-2 text-xs font-semibold text-muted-foreground">
                <span>Quality</span>
                <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]"
                  value={quality}
                  onChange={(event) => setQuality(event.target.value)}
                >
                  {Object.keys(profile.qualityRates).map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-[14px] max-[760px]:grid-cols-2 max-[420px]:grid-cols-1">
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                 <span>Print type</span>
                 <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]"
                  value={printType}
                  onChange={(event) =>
                    setPrintType(event.target.value as MarketService)
                  }
                >
                  <option value="document_print">Document</option>
                  <option value="photo_print">Photo</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                 <span>Paper type</span>
                 <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]"
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
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                 <span>Paper size</span>
                 <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]"
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
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                 <span>Pricing basis</span>
                 <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]"
                  value={pricingBasis}
                  onChange={(event) =>
                    setPricingBasis(event.target.value as PrintPricingBasis)
                  }
                >
                  <option value="markup">Markup on cost</option>
                  <option value="margin">Margin on selling price</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                 <span>Content type</span>
                 <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]"
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
              <label className="flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                 <span>Color mode</span>
                 <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]"
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
            <p className="mt-[14px] text-[11px] leading-[1.5] text-muted-foreground">
              {paperType} · {PAPER_SIZES[paperSize].label}. Paper dimensions are
              calculated from the selected size.
            </p>
            <details>
              <summary>Operating costs & pricing</summary>
              <div className="grid grid-cols-3 gap-[14px] max-[760px]:grid-cols-2 max-[420px]:grid-cols-1">
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
              <label className="mt-[14px] flex flex-col gap-2 text-xs font-semibold text-muted-foreground">
                 <span>Price rounding</span>
                 <select className="h-[42px] w-full rounded border border-[#cbd8c3] bg-[#fbfcf8] px-3 text-[#2f3d32] outline-none focus:border-[#5d7052] focus:ring-[3px] focus:ring-[#5d7052]/[.18]"
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
        <aside className="sticky top-5 border border-[#26372b] bg-[#26372b] p-[26px] text-[#f7faf4] max-[760px]:static max-[760px]:order-[-1]">
          {pages.length === 0 || processing || aiBusy ? (
            <div className="flex min-h-[360px] flex-col justify-center">
              <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b7c9ab]">
                {processing || aiBusy ? "Analyzing artwork" : "Your estimate"}
              </div>
              <div className="mt-11 font-heading text-xs font-bold tracking-[0.12em] text-[#80917c]">01</div>
              <h2 className="mt-3 text-[25px] leading-[1.1] tracking-[-0.04em]">
                {processing
                  ? "Reading File"
                  : aiBusy
                    ? "Identifying artwork"
                    : "Upload artwork"}
                {!processing && !aiBusy && <><br />to begin</>}
              </h2>
              <p className="mt-[14px] max-w-[235px] text-xs leading-[1.6] text-[#a9b8a0]">
                {processing || aiBusy
                  ? "Your production estimate will appear after analysis is complete."
                  : "Once your file is analyzed, your production cost and suggested price will appear here."}
              </p>
            </div>
          ) : (
            <>
               <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#b7c9ab]">Estimated production cost</div>
               <div className="mt-[11px] font-heading text-[40px] font-extrabold tracking-[-0.06em] max-[760px]:text-4xl max-[420px]:text-[32px]">{peso(result.totalCost)}</div>
                <div className="text-xs text-[#afbea9]">
                {result.pageCount} printed page
                {result.pageCount === 1 ? "" : "s"}
              </div>
               <div className="my-[27px] grid grid-cols-2 gap-2.5">
                 <div className="bg-[#3c4f40] p-3.5">
                   <span className="block text-[11px] text-[#afbea9]">Cost / print</span>
                   <strong className="mt-[7px] block text-base">{peso(result.costPerPrint)}</strong>
                </div>
                 <div className="bg-[#3c4f40] p-3.5">
                   <span className="block text-[11px] text-[#afbea9]">Ink load</span>
                   <strong className="mt-[7px] block text-base">{result.averageInkLoad.toFixed(1)}%</strong>
                </div>
              </div>
                <div className="my-5 border border-[#7f947d] bg-[#34463a] p-[15px]">
                <div>
                    <span className="block text-[11px] text-[#afbea9]">Market reference</span>
                   <strong className="mt-1.5 block font-heading text-[21px]">
                    {result.marketReferenceAvailable &&
                    result.marketReference != null
                      ? peso(result.marketReference)
                      : "Unavailable"}
                  </strong>
                </div>
                {result.marketReferenceAvailable &&
                  result.marketReference != null && (
                      <p className="mt-3 border-t border-[#5f745f] pt-2.5 text-[11px] leading-[1.5] text-[#c8d5c5]">
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
                <div className="border-y border-[#5f745f] py-3">
                <Row label="Ink" value={result.inkCost} />
                <Row label="Paper" value={result.paperCost} />
                <Row label="Maintenance" value={result.maintenanceCost} />
                <Row label="Electricity" value={result.electricityCost} />
                <Row label="Labor" value={result.laborCost} />
                <Row label="Waste" value={result.wasteCost} />
                <Row label="Overhead" value={result.overhead} />
              </div>
                 <div className="mt-5 bg-[#5d7052] p-[17px]">
                   <span className="block text-[11px] text-[#afbea9]">Suggested job price</span>
                  <strong className="mt-[7px] block font-heading text-[27px] tracking-[-0.04em]">{peso(result.suggestedJobPrice)}</strong>
                  <small className="mt-1.5 block text-[11px] text-[#d7e6d3]">
                  {peso(result.profit)} profit ·{" "}
                   {result.actualMargin.toFixed(1)}% actual margin
                 </small>
               </div>
                 <p className="mt-5 text-[10px] leading-[1.5] text-[#9dad9f]">
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
    <div className="flex justify-between py-[7px] text-xs">
      <span>{label}</span>
      <b className="font-medium">{peso(value)}</b>
    </div>
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
    <main className="mx-auto w-full max-w-[1184px] px-7 py-16 max-[760px]:px-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
        Configuration / this device
      </div>
      <h1 className="mt-2 font-heading text-5xl font-extrabold tracking-[-0.055em] max-[760px]:text-[37px]">
        Reusable profiles
      </h1>
      <p className="mt-3 max-w-[580px] text-base leading-relaxed text-muted-foreground">
        Keep your everyday printer assumptions close. These settings stay in
        this browser and are never synced.
      </p>
      <Card className="mt-9 max-w-[620px]">
        <CardContent className="space-y-5 p-6">
          <div className="space-y-2">
            <Label htmlFor="profile-name">Printer profile name</Label>
            <Input
              id="profile-name"
              value={profile.name}
              onChange={(event) => {
                const next = { ...profile, name: event.target.value };
              setProfile(next);
              window.localStorage.setItem("cb-profile", JSON.stringify(next));
              }}
            />
          </div>
        <div className="grid grid-cols-2 gap-4 max-[420px]:grid-cols-1">
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
        <div className="flex flex-wrap gap-2">
          <Button onClick={exportProfile}>
            Export JSON
          </Button>
          <Button variant="outline" asChild>
            <label>
            Import JSON
            <input
              hidden
              type="file"
              accept=".json,application/json"
              onChange={(event) => importProfile(event.target.files?.[0])}
            />
            </label>
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              window.localStorage.removeItem("cb-profile");
              setProfile(DEFAULT_PROFILE);
            }}
          >
            Restore defaults
          </Button>
        </div>
        </CardContent>
      </Card>
    </main>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route element={<Layout />}>
          <Route path="/print-estimator" element={<PrintEstimator />} />
          <Route path="/cost-estimator" element={<PricingCalculator />} />
          <Route path="/qr-generator" element={<QRDesigner />} />
          <Route path="/profiles" element={<Profiles />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
