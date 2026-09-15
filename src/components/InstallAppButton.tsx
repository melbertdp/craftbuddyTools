"use client";

import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    __craftBuddyInstallPrompt?: BeforeInstallPromptEvent;
  }
}

export function InstallAppButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);

  useEffect(() => {
    setOfflineReady(localStorage.getItem("cb-offline-setup-complete") === "1");
    if (window.__craftBuddyInstallPrompt) {
      setInstallPrompt(window.__craftBuddyInstallPrompt);
    }
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const prompt = event as BeforeInstallPromptEvent;
      window.__craftBuddyInstallPrompt = prompt;
      setInstallPrompt(prompt);
    };
    const handleOfflineReady = () => setOfflineReady(true);
    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("craftbuddy-offline-ready", handleOfflineReady);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("craftbuddy-offline-ready", handleOfflineReady);
    };
  }, []);

  if (hidden) return null;
  if (offlineReady && !installPrompt) return null;

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    setInstallPrompt(null);
  }

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-[340px] md:inset-x-auto md:bottom-auto md:right-8 md:top-6 md:mx-0">
      <div className="relative flex flex-col items-center">
        <img src="/baloon.png" alt="" className="relative z-10 h-[230px] w-auto max-w-none" />
        <div className="relative -mt-[65px] w-full rounded-[28px] border border-[#eae5d7] bg-[#fdfbf4] px-5 pb-5 pt-12 text-center shadow-[0_18px_45px_rgba(31,52,87,0.16)]">
          <button
            type="button"
            className="absolute right-3 top-3 rounded-full bg-white p-1.5 text-[#475569] shadow-[0_4px_12px_rgba(15,23,42,0.14)] transition hover:bg-[#f1f5f9]"
            onClick={() => setHidden(true)}
            aria-label="Dismiss install prompt"
          >
            <X className="size-4" aria-hidden />
          </button>
          <strong className="block text-[17px] font-bold tracking-[-0.01em] text-[#1b2942]">
            Install CraftBuddy
          </strong>
          <p className="mt-1.5 text-sm text-[#8b96a8]">
            {offlineReady ? "Keep your tools one click away." : "Set up offline access first."}
          </p>
          {offlineReady ? (
            <Button
              type="button"
              size="lg"
              className="mt-4 h-11 w-full rounded-xl bg-[#5d7052] hover:bg-[#4f6449]"
              onClick={installApp}
            >
              <Download aria-hidden />
              Install app
            </Button>
          ) : (
            <Button
              type="button"
              size="lg"
              className="mt-4 h-11 w-full rounded-xl bg-[#5d7052] hover:bg-[#4f6449]"
              onClick={() => window.dispatchEvent(new Event("craftbuddy-open-offline-setup"))}
            >
              <Download aria-hidden />
              Download for offline
            </Button>
          )}
        </div>
      </div>
    </aside>
  );
}
