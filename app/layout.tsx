import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InstallAppButton } from "@/components/InstallAppButton";
import { OfflineSetupModal } from "@/components/OfflineSetupModal";
import { ServiceWorkerRegistrar } from "@/pdf/components/common/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "CraftBuddy Tools",
  description: "Practical tools for makers and print shops.",
  applicationName: "CraftBuddy Tools",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "CraftBuddy Tools",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#5d7052",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html:
              'window.addEventListener("beforeinstallprompt", function (event) { event.preventDefault(); window.__craftBuddyInstallPrompt = event; });',
          }}
        />
        {children}
        <OfflineSetupModal />
        <InstallAppButton />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
