"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import {
  AlertTriangle,
  Download,
  FileImage,
  FileText,
  Grid3X3,
  Lock,
  Palette,
  Redo2,
  Shuffle,
  Sparkles,
  Type,
  Undo2,
  Upload,
  X,
} from "lucide-react";

type ContentType = "URL" | "Wi-Fi";
type Tab = "content" | "shape" | "color" | "logo";
type Design = {
  shape: string;
  frame: string;
  pupil: string;
  join: "Separate" | "Horizontal" | "Vertical" | "Both";
  thickness: number;
  rotation: "None" | "Random" | "45°" | "90°" | "180°";
  jitter: number;
  fg: string;
  bg: string;
  gradient: "None" | "Linear" | "Radial";
  c1: string;
  c2: string;
  separateEyes: boolean;
  eyeFrame: string;
  eyePupil: string;
  logo: "None" | "Built-in" | "Custom";
  logoText: string;
  logoSize: number;
  logoPadding: number;
  logoBg: "None" | "White" | "Match";
  quiet: number;
  ec: "L" | "M" | "Q" | "H";
  seed: number;
};

const shapes = ["Square", "Rounded Square", "Circle", "Diamond", "Triangle", "Hexagon", "Plus", "Horizontal Pill", "Heart", "Blob", "Dot"];
const frames = ["Square", "Rounded Square", "Circle", "Heavy Rounded", "Octagon", "Diamond"];
const pupils = ["Square", "Rounded Square", "Circle", "Diamond", "Plus", "Heart"];
const brands = ["QR", "FB", "YT", "X", "IG", "TT", "GH", "IN", "WA", "TG"];
const initial: Design = {
  shape: "Square", frame: "Square", pupil: "Square", join: "Separate", thickness: 100,
  rotation: "None", jitter: 0, fg: "#282421", bg: "#fffdf9", gradient: "None",
  c1: "#bb563a", c2: "#557463", separateEyes: false, eyeFrame: "#282421", eyePupil: "#282421",
  logo: "None", logoText: "QR", logoSize: 18, logoPadding: 4, logoBg: "None", quiet: 4, ec: "H", seed: 13,
};

const defaults: Record<ContentType, Record<string, string>> = {
  URL: { value: "https://example.com" },
  "Wi-Fi": { ssid: "", password: "", security: "WPA", hidden: "false" },
};

function escapeWifi(value: string) { return value.replace(/([\\;,:])/g, "\\$1").replace(/\r?\n/g, "\\n"); }
function encodeContent(type: ContentType, values: Record<string, string>) {
  if (type === "URL") return values.value || "";
  return `WIFI:T:${values.security === "None" ? "nopass" : values.security};S:${escapeWifi(values.ssid || "")};P:${escapeWifi(values.password || "")};H:${values.hidden === "true"};;`;
}
function shapeNode(shape: string, x: number, y: number, size: number, rotation = 0): ReactNode {
  const cx = x + size / 2, cy = y + size / 2, a = size * 0.1;
  const transform = `rotate(${rotation} ${cx} ${cy})`;
  if (["Circle", "Dot"].includes(shape)) return <circle cx={cx} cy={cy} r={size * 0.4} />;
  if (shape === "Diamond") return <polygon transform={transform} points={`${cx},${y + a} ${x + size - a},${cy} ${cx},${y + size - a} ${x + a},${cy}`} />;
  if (shape === "Triangle") return <polygon transform={transform} points={`${cx},${y + a} ${x + size - a},${y + size - a} ${x + a},${y + size - a}`} />;
  if (shape === "Hexagon") return <polygon points={`${x + a},${cy} ${x + size * .25},${y + a} ${x + size * .75},${y + a} ${x + size - a},${cy} ${x + size * .75},${y + size - a} ${x + size * .25},${y + size - a}`} />;
  if (shape === "Plus") return <path transform={transform} d={`M${x + size * .35} ${y + a}h${size * .3}v${size * .25}h${size * .25}v${size * .3}h-${size * .25}v${size * .25}h-${size * .3}v-${size * .25}H${x + a}v-${size * .3}h${size * .25}z`} />;
  if (shape === "Horizontal Pill") return <rect x={x + a / 2} y={y + size * .25} width={size - a} height={size * .5} rx={size * .25} />;
  if (shape === "Heart") return <path transform={transform} d={`M${cx} ${y + size - a}C${x + a} ${cy} ${x + a} ${y + a} ${cx} ${y + size * .3}C${x + size - a} ${y + a} ${x + size - a} ${cy} ${cx} ${y + size - a}Z`} />;
  return <rect x={x + a / 2} y={y + a / 2} width={size - a} height={size - a} rx={shape.includes("Rounded") || ["Blob"].includes(shape) ? size * .22 : 0} />;
}
function matrixFor(value: string, ec: Design["ec"]) {
  if (!value) return null;
  try { const qr = qrcode(0, ec); qr.addData(value, "Byte"); qr.make(); const n = qr.getModuleCount(); return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c))); } catch { return null; }
}
function finder(row: number, col: number, n: number) { return (row < 7 && col < 7) || (row < 7 && col >= n - 7) || (row >= n - 7 && col < 7); }
function functional(row: number, col: number, n: number) { return finder(row, col, n) || row === 6 || col === 6 || (row <= 8 && col <= 8) || (row <= 8 && col >= n - 8) || (row >= n - 8 && col <= 8); }
function randomAt(row: number, col: number, seed: number) { const n = Math.sin(row * 127.1 + col * 311.7 + seed * 74.3) * 43758.5453; return n - Math.floor(n); }
function luminance(hex: string) { const rgb = hex.replace("#", "").match(/../g)?.map(v => parseInt(v, 16) / 255) || [0, 0, 0]; return rgb.map(v => v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4)).reduce((sum, v, i) => sum + v * [0.2126, .7152, .0722][i], 0); }

export default function QRDesigner() {
  const [tab, setTab] = useState<Tab>("content");
  const [type, setType] = useState<ContentType>("URL");
  const [values, setValues] = useState(defaults.URL);
  const [design, setDesign] = useState(initial);
  const [history, setHistory] = useState<Design[]>([]);
  const [future, setFuture] = useState<Design[]>([]);
  const [exportSize, setExportSize] = useState(1024);
  const [logoData, setLogoData] = useState("");
  const [logoName, setLogoName] = useState("");
  const [locked, setLocked] = useState({ body: false, layout: false, eyes: false, colors: false });
  const svgRef = useRef<SVGSVGElement>(null);
  const raw = useMemo(() => encodeContent(type, values), [type, values]);
  const matrix = useMemo(() => matrixFor(raw, design.ec), [raw, design.ec]);
  const update = (patch: Partial<Design>) => { setHistory(items => [...items.slice(-39), design]); setFuture([]); setDesign(item => ({ ...item, ...patch })); };
  const safety = useMemo(() => { const contrast = (Math.max(luminance(design.fg), luminance(design.bg)) + .05) / (Math.min(luminance(design.fg), luminance(design.bg)) + .05); const score = (contrast >= 4.5 ? 3 : contrast >= 3 ? 2 : 1) + (design.ec === "H" ? 2 : design.ec === "Q" ? 1 : 0) + (design.quiet >= 4 ? 1 : 0) - (design.jitter > 20 ? 2 : design.jitter > 10 ? 1 : 0) - (design.logoSize > 25 ? 2 : design.logo !== "None" ? 1 : 0); return score >= 5 ? "Excellent" : score >= 3 ? "Good" : "Risky"; }, [design]);
  const issues = useMemo(() => {
    const list: { level: "error" | "warn"; text: string }[] = [];
    const contrast = (Math.max(luminance(design.fg), luminance(design.bg)) + .05) / (Math.min(luminance(design.fg), luminance(design.bg)) + .05);
    if (contrast < 3) list.push({ level: "error", text: "Contrast is too low. Scanners may not be able to separate the code from the background." });
    else if (contrast < 4.5) list.push({ level: "warn", text: "Contrast is below the recommended 4.5:1. Test the code before printing." });
    if (design.logo !== "None" && design.ec !== "H" && design.ec !== "Q") list.push({ level: "error", text: "A logo needs error correction Q or H so the hidden data can be recovered." });
    if (design.logo !== "None" && design.logoSize > 25) list.push({ level: "error", text: "The logo covers too much of the code. Keep it at 25% or smaller." });
    if (design.jitter > 15) list.push({ level: "warn", text: "Heavy jitter distorts modules and can break scanning." });
    if (design.thickness < 60) list.push({ level: "warn", text: "Very thin modules are harder for scanners to detect." });
    if (design.gradient !== "None") list.push({ level: "warn", text: "Gradients lower contrast at the darker end. Verify with a real scanner." });
    if (["Random", "45°"].includes(design.rotation)) list.push({ level: "warn", text: "Rotated modules reduce scan reliability at small sizes." });
    if (design.separateEyes && luminance(design.eyeFrame) > luminance(design.bg)) list.push({ level: "warn", text: "Finder eye frames should stay darker than the background." });
    return list;
  }, [design]);
  const blocked = issues.some(issue => issue.level === "error");
  const randomize = () => { const seed = (design.seed + 17) % 10000; const patch: Partial<Design> = { seed }; if (!locked.body) patch.shape = shapes[seed % shapes.length]; if (!locked.layout) { patch.join = ["Separate", "Horizontal", "Vertical", "Both"][seed % 4] as Design["join"]; patch.thickness = 60 + seed % 41; patch.jitter = seed % 21; patch.rotation = ["None", "45°", "90°", "180°", "Random"][seed % 5] as Design["rotation"]; } if (!locked.eyes) { patch.frame = frames[seed % frames.length]; patch.pupil = pupils[seed % pupils.length]; } if (!locked.colors) { patch.fg = ["#282421", "#8f3e2b", "#557463", "#46336d"][seed % 4]; patch.bg = ["#fffdf9", "#fbf3e9", "#eef3ef", "#f4f0fa"][seed % 4]; } update(patch); };

  function render(size = 1000) {
    if (!matrix) return null;
    const n = matrix.length, cell = size / (n + design.quiet * 2), quiet = design.quiet * cell;
    const logoHalf = design.logo === "None" ? 0 : ((size * design.logoSize / 200) + (size * design.logoPadding / 100)) / cell;
    const nodes: ReactNode[] = [];
    for (let row = 0; row < n; row++) for (let col = 0; col < n; col++) if (matrix[row][col] && !finder(row, col, n) && !(design.logo !== "None" && Math.abs(col + .5 - n / 2) < logoHalf && Math.abs(row + .5 - n / 2) < logoHalf)) {
      const connected = !functional(row, col, n) && (design.join === "Both" || (design.join === "Horizontal" && col < n - 1 && matrix[row][col + 1]) || (design.join === "Vertical" && row < n - 1 && matrix[row + 1][col]));
      const jitter = design.jitter ? randomAt(row, col, design.seed) * design.jitter / 100 : 0;
      const moduleSize = cell * design.thickness / 100 * (1 - jitter), x = quiet + col * cell + (cell - moduleSize) / 2, y = quiet + row * cell + (cell - moduleSize) / 2;
      const rotation = design.rotation === "Random" ? Math.floor(randomAt(row, col, design.seed) * 4) * 90 : design.rotation === "None" ? 0 : parseInt(design.rotation);
      nodes.push(<g key={`${row}-${col}`} fill={design.gradient === "None" ? design.fg : "url(#qr-gradient)"}>{shapeNode(design.shape, x, y, moduleSize + (connected ? cell * .12 : 0), rotation)}</g>);
    }
    return <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Generated QR code"><defs>{design.gradient === "Linear" && <linearGradient id="qr-gradient"><stop stopColor={design.c1} /><stop offset="1" stopColor={design.c2} /></linearGradient>}{design.gradient === "Radial" && <radialGradient id="qr-gradient"><stop stopColor={design.c1} /><stop offset="1" stopColor={design.c2} /></radialGradient>}</defs><rect width={size} height={size} fill={design.bg} />{nodes}{[[0, 0], [n - 7, 0], [0, n - 7]].map(([col, row], i) => <g key={i}><rect x={quiet + col * cell} y={quiet + row * cell} width={7 * cell} height={7 * cell} rx={design.frame === "Circle" ? 3.5 * cell : design.frame.includes("Rounded") ? cell : 0} fill={design.separateEyes ? design.eyeFrame : design.fg} /><rect x={quiet + (col + 1) * cell} y={quiet + (row + 1) * cell} width={5 * cell} height={5 * cell} rx={cell / 2} fill={design.bg} /><g fill={design.separateEyes ? design.eyePupil : design.fg}>{shapeNode(design.pupil, quiet + (col + 2) * cell, quiet + (row + 2) * cell, 3 * cell)}</g></g>)}{design.logo !== "None" && <g><rect x={size / 2 - size * design.logoSize / 200} y={size / 2 - size * design.logoSize / 200} width={size * design.logoSize / 100} height={size * design.logoSize / 100} rx={size * .01} fill={design.logoBg === "None" ? "none" : design.logoBg === "White" ? "#fff" : design.bg} />{logoData ? <image href={logoData} x={size / 2 - size * design.logoSize / 200} y={size / 2 - size * design.logoSize / 200} width={size * design.logoSize / 100} height={size * design.logoSize / 100} preserveAspectRatio="xMidYMid meet" /> : <text x="50%" y="51%" textAnchor="middle" dominantBaseline="middle" fontSize={size * design.logoSize / 180} fontWeight="bold" fill={design.fg}>{design.logoText.slice(0, 2)}</text>}</g>}</svg>;
  }

  async function download(format: "png" | "svg" | "pdf" | "eps") {
    if (!matrix || !svgRef.current) return;
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14), name = `qr-code-${stamp}.${format}`;
    const xml = new XMLSerializer().serializeToString(svgRef.current);
    if (format === "svg") { const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return; }
    if (format === "eps") { const cell = exportSize / (matrix.length + design.quiet * 2), quiet = design.quiet * cell; const body = matrix.map((row, r) => row.map((on, c) => on ? `newpath ${quiet + c * cell} ${exportSize - quiet - (r + 1) * cell} moveto ${cell} 0 rlineto 0 ${cell} rlineto ${-cell} 0 rlineto closepath fill` : "").join("\n")).join("\n"); const url = URL.createObjectURL(new Blob([`%!PS-Adobe-3.0 EPSF-3.0\n%%BoundingBox: 0 0 ${exportSize} ${exportSize}\n0 0 0 setrgbcolor\n${body}\nshowpage`], { type: "application/postscript" })); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); return; }
    const image = new Image(); image.onload = async () => { const canvas = document.createElement("canvas"); canvas.width = canvas.height = exportSize; canvas.getContext("2d")!.drawImage(image, 0, 0, exportSize, exportSize); if (format === "pdf") { const { jsPDF } = await import("jspdf"); const pdf = new jsPDF({ unit: "pt", format: [512, 512] }); pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, 512, 512); pdf.save(name); } else canvas.toBlob(blob => { if (!blob) return; const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, "image/png"); }; image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  }

  const valid = type === "URL" ? Boolean(values.value?.trim()) : Boolean(values.ssid?.trim());
  const field = (label: string, key: string) => <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted"><span>{label}</span><input className="h-10 rounded border border-line bg-paper px-2.5 text-sm text-ink outline-none transition focus:border-rust focus:ring-2 focus:ring-rust/15" value={values[key] || ""} onChange={e => setValues(v => ({ ...v, [key]: e.target.value }))} /></label>;
  const control = (label: string, key: "thickness" | "jitter" | "quiet" | "logoSize") => <label className="flex flex-col gap-1.5 text-xs font-semibold text-muted"><span>{label}</span><div className="flex items-center gap-2"><input className="flex-1 accent-rust" type="range" min={key === "quiet" ? 4 : key === "logoSize" ? 5 : key === "thickness" ? 60 : 0} max={key === "quiet" ? 8 : key === "logoSize" ? 25 : key === "thickness" ? 100 : 20} value={design[key]} onChange={e => update({ [key]: Number(e.target.value) })} /><code className="w-14 text-right text-[10px] font-medium text-muted">{design[key]}{key === "quiet" ? " modules" : "%"}</code></div></label>;
  const tabs: [Tab, typeof Type, string][] = [["content", Type, "Content"], ["shape", Grid3X3, "Shape"], ["color", Palette, "Color"], ["logo", FileImage, "Logo"]];

  useEffect(() => { const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); if (e.shiftKey && future.length) { const next = future.at(-1)!; setFuture(x => x.slice(0, -1)); setHistory(x => [...x, design]); setDesign(next); } else if (history.length) { const next = history.at(-1)!; setHistory(x => x.slice(0, -1)); setFuture(x => [...x, design]); setDesign(next); } } }; window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey); }, [design, history, future]);

  return <main className="mx-auto flex w-full max-w-[1440px] flex-col gap-4 px-4 py-6 text-ink md:px-7 md:py-8"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="mb-2 text-[11px] font-bold uppercase tracking-[.16em] text-rust">Creative tools / QR generator</p><h1 className="font-display text-4xl font-bold tracking-[-.055em] md:text-5xl">QR code designer</h1><p className="mt-2 text-sm text-muted">Make a branded QR code locally. Nothing is uploaded.</p></div><div className="rounded-full border border-line bg-paper px-3 py-1.5 text-xs text-muted">Scan safety: <strong className="text-rust">{safety}</strong></div></div><div className="grid min-h-[680px] grid-cols-1 overflow-hidden border border-line bg-paper shadow-sm lg:grid-cols-[minmax(0,1fr)_380px]"><section className="flex min-h-[620px] flex-col bg-[#f8f6f1]"><div className="grid min-h-0 flex-1 place-items-center overflow-hidden bg-[radial-gradient(#deded7_.9px,transparent_.9px)] bg-[length:15px_15px] p-6"><div className="aspect-square w-[min(72vw,540px)] rounded bg-[#dfeadf] p-[2.5%] shadow-[0_18px_44px_rgba(38,36,30,.05)]">{matrix && valid ? render() : <div className="grid h-full place-items-center p-8 text-center text-xs text-muted">{valid ? "Generating QR code…" : "Enter content to generate a QR code."}</div>}</div></div>{issues.length > 0 && <div className="border-t border-line bg-[#fdf6ea] px-5 py-3"><ul className="space-y-1 text-xs">{issues.map((issue, index) => <li key={index} className={`flex items-start gap-1.5 ${issue.level === "error" ? "text-red-700" : "text-amber-800"}`}><AlertTriangle size={13} className="mt-0.5 shrink-0" /><span>{issue.text}</span></li>)}</ul></div>}<div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-paper px-5 py-3 text-xs text-muted"><span>Generated in your browser</span><div className="flex gap-2"><button className="rounded border border-line px-3 py-2 transition hover:border-rust" onClick={() => update(initial)}>Reset style</button><button className="flex items-center gap-1.5 rounded bg-rust px-3 py-2 font-bold text-white transition hover:bg-rust-dark" onClick={randomize}><Sparkles size={14} /> Randomize</button></div></div></section><aside className="min-w-0 overflow-y-auto border-t border-line bg-paper lg:border-l lg:border-t-0"><nav className="grid grid-cols-4 border-b border-line px-2"><div className="col-span-4 grid grid-cols-4">{tabs.map(([id, Icon, label]) => <button key={id} className={`flex flex-col items-center gap-1 border-b-2 px-1 py-3 text-[10px] font-bold ${tab === id ? "border-rust text-rust" : "border-transparent text-muted"}`} onClick={() => setTab(id)}><Icon size={15} />{label}</button>)}</div></nav><div className="space-y-5 p-4">{tab === "content" && <><section className="space-y-3 border-b border-line pb-5"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Content type</h2><div className="flex gap-1.5"><button className={`flex-1 rounded border px-2 py-2 text-xs ${type === "URL" ? "border-rust bg-rust/10 font-bold text-rust" : "border-line text-muted"}`} onClick={() => { setType("URL"); setValues(defaults.URL); }}>URL</button><button className={`flex-1 rounded border px-2 py-2 text-xs ${type === "Wi-Fi" ? "border-rust bg-rust/10 font-bold text-rust" : "border-line text-muted"}`} onClick={() => { setType("Wi-Fi"); setValues(defaults["Wi-Fi"]); }}>Wi-Fi</button></div>{type === "URL" ? field("Destination URL", "value") : <>{field("Network name", "ssid")}{field("Password", "password")}<label className="flex flex-col gap-1.5 text-xs font-semibold text-muted"><span>Security</span><select className="h-10 rounded border border-line bg-paper px-2.5" value={values.security} onChange={e => setValues(v => ({ ...v, security: e.target.value }))}><option>WPA</option><option>WEP</option><option>None</option></select></label><label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={values.hidden === "true"} onChange={e => setValues(v => ({ ...v, hidden: String(e.target.checked) }))} /> Hidden network</label></>}</section><section className="space-y-3"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">QR settings</h2><label className="flex flex-col gap-1.5 text-xs font-semibold text-muted"><span>Error correction</span><select className="h-10 rounded border border-line bg-paper px-2.5" value={design.ec} onChange={e => update({ ec: e.target.value as Design["ec"] })}><option disabled={design.logo !== "None"}>L</option><option disabled={design.logo !== "None"}>M</option><option>Q</option><option>H</option></select></label><p className="text-xs leading-5 text-muted">Higher correction is recommended for logos and decorative styles.</p>{control("Quiet zone", "quiet")}</section></>}{tab === "shape" && <><section className="space-y-3 border-b border-line pb-5"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Body shape</h2><div className="grid grid-cols-5 gap-1">{shapes.map(item => <button key={item} title={item} className={`grid aspect-square place-items-center rounded border p-1 text-[9px] ${design.shape === item ? "border-rust bg-rust/10 text-rust" : "border-line text-muted"}`} onClick={() => update({ shape: item })}><svg viewBox="0 0 40 40" className="h-7 w-7" fill="currentColor">{shapeNode(item, 5, 5, 30)}</svg></button>)}</div></section><section className="space-y-3 border-b border-line pb-5"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Layout</h2><div className="grid grid-cols-2 gap-1">{(["Separate", "Horizontal", "Vertical", "Both"] as const).map(item => <button key={item} className={`rounded border px-2 py-2 text-[10px] ${design.join === item ? "border-rust bg-rust/10 text-rust" : "border-line text-muted"}`} onClick={() => update({ join: item })}>{item}</button>)}</div>{control("Thickness", "thickness")}{control("Jitter", "jitter")}<button className="flex items-center gap-1.5 rounded border border-line px-3 py-2 text-xs text-muted" onClick={() => update({ seed: design.seed + 1 })}><Shuffle size={13} /> Reshuffle</button></section><section className="space-y-3"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Rotation</h2><div className="flex flex-wrap gap-1">{(["None", "Random", "45°", "90°", "180°"] as const).map(item => <button key={item} className={`rounded border px-2 py-2 text-[10px] ${design.rotation === item ? "border-rust bg-rust/10 text-rust" : "border-line text-muted"}`} onClick={() => update({ rotation: item })}>{item}</button>)}</div></section><section className="space-y-3"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Randomize locks</h2><div className="flex flex-wrap gap-1">{(["body", "layout", "eyes", "colors"] as const).map(key => <button key={key} className={`flex items-center gap-1 rounded border px-2 py-1.5 text-[10px] ${locked[key] ? "border-foreground bg-foreground text-background" : "border-line text-muted"}`} onClick={() => setLocked(x => ({ ...x, [key]: !x[key] }))}><Lock size={11} />{key}</button>)}</div></section></>}{tab === "color" && <><section className="space-y-3 border-b border-line pb-5"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Colors</h2><div className="grid grid-cols-2 gap-3"><label className="flex flex-col gap-1.5 text-xs text-muted">Foreground<input className="h-10 w-full cursor-pointer rounded border border-line p-1" type="color" value={design.fg} onChange={e => update({ fg: e.target.value })} /></label><label className="flex flex-col gap-1.5 text-xs text-muted">Background<input className="h-10 w-full cursor-pointer rounded border border-line p-1" type="color" value={design.bg} onChange={e => update({ bg: e.target.value })} /></label></div></section><section className="space-y-3"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Gradient</h2><div className="flex gap-1">{(["None", "Linear", "Radial"] as const).map(item => <button key={item} className={`flex-1 rounded border px-2 py-2 text-[10px] ${design.gradient === item ? "border-rust bg-rust/10 text-rust" : "border-line text-muted"}`} onClick={() => update({ gradient: item })}>{item}</button>)}</div>{design.gradient !== "None" && <div className="grid grid-cols-2 gap-3"><input className="h-10 w-full rounded border border-line p-1" type="color" value={design.c1} onChange={e => update({ c1: e.target.value })} /><input className="h-10 w-full rounded border border-line p-1" type="color" value={design.c2} onChange={e => update({ c2: e.target.value })} /></div>}<label className="flex items-center gap-2 text-xs text-muted"><input type="checkbox" checked={design.separateEyes} onChange={e => update({ separateEyes: e.target.checked })} /> Use separate eye colors</label>{design.separateEyes && <div className="grid grid-cols-2 gap-3"><input className="h-10 w-full rounded border border-line p-1" type="color" value={design.eyeFrame} onChange={e => update({ eyeFrame: e.target.value })} /><input className="h-10 w-full rounded border border-line p-1" type="color" value={design.eyePupil} onChange={e => update({ eyePupil: e.target.value })} /></div>}</section></>}{tab === "logo" && <><section className="space-y-3"><h2 className="text-[10px] font-extrabold uppercase tracking-[.12em] text-muted">Logo</h2><div className="flex gap-1"><button className={`flex-1 rounded border px-2 py-2 text-[10px] ${design.logo === "None" ? "border-rust bg-rust/10 text-rust" : "border-line text-muted"}`} onClick={() => update({ logo: "None" })}>No logo</button><button className={`flex-1 rounded border px-2 py-2 text-[10px] ${design.logo === "Built-in" ? "border-rust bg-rust/10 text-rust" : "border-line text-muted"}`} onClick={() => update({ logo: "Built-in" })}>Built-in</button><button className={`flex-1 rounded border px-2 py-2 text-[10px] ${design.logo === "Custom" ? "border-rust bg-rust/10 text-rust" : "border-line text-muted"}`} onClick={() => update({ logo: "Custom" })}>Custom</button></div>{design.logo === "Built-in" && <div className="grid grid-cols-5 gap-1">{brands.map(item => <button key={item} className={`rounded border py-3 text-xs font-bold ${design.logoText === item ? "border-rust bg-rust/10 text-rust" : "border-line text-muted"}`} onClick={() => update({ logoText: item })}>{item}</button>)}</div>}{design.logo === "Custom" && <><label className="flex cursor-pointer items-center justify-center gap-2 rounded border border-dashed border-rust bg-rust/5 px-3 py-3 text-xs font-bold text-rust"><Upload size={14} /> Upload logo<input hidden type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={e => { const file = e.target.files?.[0]; if (!file || file.size > 5e6) return; setLogoName(file.name); const reader = new FileReader(); reader.onload = () => setLogoData(String(reader.result || "")); reader.readAsDataURL(file); }} /></label>{logoName && <p className="flex items-center justify-between text-xs text-muted">{logoName}<button onClick={() => { setLogoName(""); setLogoData(""); update({ logo: "None" }); }}><X size={13} /></button></p>}</>}{design.logo !== "None" && <>{control("Logo size", "logoSize")}<label className="flex flex-col gap-1.5 text-xs font-semibold text-muted"><span>Logo background</span><select className="h-10 rounded border border-line bg-paper px-2.5" value={design.logoBg} onChange={e => update({ logoBg: e.target.value as Design["logoBg"] })}><option>None</option><option>White</option><option>Match</option></select></label></>}</section></>}</div><div className="border-t border-line bg-canvas p-4"><div className="mb-2 flex flex-wrap items-center gap-1.5"><span className="mr-auto text-[10px] font-mono uppercase text-muted">History</span><button className="rounded border border-line p-1.5 text-muted disabled:opacity-40" disabled={!history.length} onClick={() => { const next = history.at(-1)!; setHistory(x => x.slice(0, -1)); setFuture(x => [...x, design]); setDesign(next); }}><Undo2 size={13} /></button><button className="rounded border border-line p-1.5 text-muted disabled:opacity-40" disabled={!future.length} onClick={() => { const next = future.at(-1)!; setFuture(x => x.slice(0, -1)); setHistory(x => [...x, design]); setDesign(next); }}><Redo2 size={13} /></button></div><div className="grid grid-cols-4 gap-1.5"><select className="col-span-4 h-9 rounded border border-line bg-paper px-2 text-xs sm:col-span-1" value={exportSize} onChange={e => setExportSize(Number(e.target.value))}><option value="512">512 × 512</option><option value="1024">1024 × 1024</option><option value="2048">2048 × 2048</option><option value="4096">4096 × 4096</option></select>{(["png", "svg", "pdf", "eps"] as const).map(format => <button key={format} disabled={!matrix || !valid || blocked} className={`flex items-center justify-center gap-1 rounded px-2 py-2 text-[10px] font-bold uppercase disabled:cursor-not-allowed disabled:opacity-40 ${format === "png" ? "bg-rust text-white" : "border border-line text-muted"}`} onClick={() => download(format)}>{format === "png" ? <Download size={13} /> : format === "eps" ? <Type size={13} /> : <FileText size={13} />}{format}</button>)}</div></div></aside></div></main>;
}
