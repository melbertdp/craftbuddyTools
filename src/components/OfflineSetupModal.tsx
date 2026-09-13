"use client";

import { Check, Download, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type OfflineModule = "core" | "pdf" | "photo";

const OPTIONS: { id: OfflineModule; title: string; description: string; size: string }[] = [
  { id: "core", title: "Everyday tools", description: "Estimators, QR generator, profiles, and benchmarks.", size: "Small" },
  { id: "pdf", title: "PDF tools", description: "Edit, sign, convert, merge, split, and compress PDFs.", size: "Medium" },
  { id: "photo", title: "Photo tools", description: "ID photos, background removal, and local image models.", size: "Large" },
];

export function OfflineSetupModal() {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<OfflineModule[]>(["core"]);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");

  useEffect(() => {
    const openForFirstVisit = () => {
      setOpen(true);
      setStatus("idle");
    };
    window.addEventListener("craftbuddy-open-offline-setup", openForFirstVisit);
    return () => window.removeEventListener("craftbuddy-open-offline-setup", openForFirstVisit);
  }, []);

  if (!open) return null;

  function toggle(module: OfflineModule) {
    setSelected((current) =>
      current.includes(module) ? current.filter((item) => item !== module) : [...current, module],
    );
  }

  function dismiss() {
    localStorage.setItem("cb-offline-setup-dismissed", "1");
    setOpen(false);
  }

  async function prepareOffline() {
    if (selected.length === 0 || !("serviceWorker" in navigator)) return;
    setStatus("loading");
    try {
      const registration = await navigator.serviceWorker.ready;
      const worker = registration.active;
      if (!worker) throw new Error("Offline storage is not ready.");
      const channel = new MessageChannel();
      const result = await new Promise<{ ok: boolean }>((resolve, reject) => {
        const timeout = window.setTimeout(() => reject(new Error("Download timed out.")), 120000);
        channel.port1.onmessage = (event) => {
          window.clearTimeout(timeout);
          resolve(event.data);
        };
        worker.postMessage({ type: "CACHE_OFFLINE_MODULES", modules: selected }, [channel.port2]);
      });
      if (!result.ok) throw new Error("Some offline files could not be downloaded.");
      localStorage.setItem("cb-offline-setup-complete", "1");
      window.dispatchEvent(new Event("craftbuddy-offline-ready"));
      setOpen(false);
    } catch {
      setStatus("error");
    }
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-[#172238]/55 p-4" role="dialog" aria-modal="true" aria-labelledby="offline-title">
      <div className="relative w-full max-w-lg rounded-3xl border border-[#d7e1d1] bg-[#fbfcf8] p-6 text-[#2f3d32] shadow-2xl sm:p-8">
        <button type="button" onClick={dismiss} className="absolute right-5 top-5 rounded-full p-2 text-[#718096] hover:bg-[#edf2e9]" aria-label="Close offline setup">
          <X className="size-5" />
        </button>
        <div className="mb-6 pr-8">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-[#5d7052]">Offline setup</p>
          <h2 id="offline-title" className="text-2xl font-bold tracking-tight">Choose what to keep available</h2>
          <p className="mt-2 text-sm leading-6 text-[#718096]">Select the tools you want to use without an internet connection. Files are downloaded only after you confirm.</p>
        </div>
        <div className="space-y-3">
          {OPTIONS.map((option) => {
            const checked = selected.includes(option.id);
            return (
              <label key={option.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 transition ${checked ? "border-[#5d7052] bg-[#eef4e9]" : "border-[#d7e1d1] bg-white hover:border-[#9caf93]"}`}>
                <input type="checkbox" checked={checked} onChange={() => toggle(option.id)} className="sr-only" />
                <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded border ${checked ? "border-[#5d7052] bg-[#5d7052] text-white" : "border-[#b7c6b0] bg-white"}`}>
                  {checked && <Check className="size-3.5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-3 text-sm font-bold"><span>{option.title}</span><span className="text-[11px] font-medium text-[#718096]">{option.size}</span></span>
                  <span className="mt-1 block text-xs leading-5 text-[#718096]">{option.description}</span>
                </span>
              </label>
            );
          })}
        </div>
        {status === "error" && <p className="mt-4 text-sm text-red-700">The download could not finish. Check your connection and try again.</p>}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3">
          <button type="button" onClick={dismiss} className="text-sm font-semibold text-[#718096] hover:text-[#2f3d32]">Not now</button>
          <Button type="button" disabled={selected.length === 0 || status === "loading"} onClick={prepareOffline}>
            {status === "loading" ? <Loader2 className="animate-spin" /> : <Download />}
            {status === "loading" ? "Preparing…" : "Make available offline"}
          </Button>
        </div>
      </div>
    </div>
  );
}
