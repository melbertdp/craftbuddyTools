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

  useEffect(() => {
    if (window.__craftBuddyInstallPrompt) {
      setInstallPrompt(window.__craftBuddyInstallPrompt);
    }
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      const prompt = event as BeforeInstallPromptEvent;
      window.__craftBuddyInstallPrompt = prompt;
      setInstallPrompt(prompt);
    };
    const handleAppInstalled = () => {
      setHidden(true);
      window.__craftBuddyInstallPrompt = undefined;
      setInstallPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (!installPrompt || hidden) return null;

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") setHidden(true);
    setInstallPrompt(null);
  }

  return (
    <aside className="fixed inset-x-4 top-4 z-50 mx-auto flex max-w-[430px] items-center gap-3 rounded-2xl border border-[#bcd5ff] bg-[#fff] px-4 py-3 shadow-[0_12px_30px_rgba(31,52,87,0.16)] sm:inset-x-auto sm:right-8 sm:ml-auto sm:max-w-[430px]">
      <img src="/icon-192.png" alt="" className="size-12 shrink-0 rounded-xl object-contain" />
      <div className="min-w-0 flex-1">
        <strong className="block text-sm text-[#172238]">Install CraftBuddy</strong>
        <span className="block text-xs text-[#718096]">Get faster access anytime!</span>
      </div>
      <Button type="button" size="sm" onClick={installApp}>
        <Download aria-hidden />
        Install
      </Button>
      <button
        type="button"
        className="rounded p-1 text-[#9aa7ba] hover:bg-[#f0f4fa] hover:text-[#536175]"
        onClick={() => setHidden(true)}
        aria-label="Dismiss install prompt"
      >
        <X className="size-4" aria-hidden />
      </button>
    </aside>
  );
}
