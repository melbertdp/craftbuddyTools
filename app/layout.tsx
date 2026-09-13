import type { Metadata, Viewport } from "next";
import "./globals.css";
import { InstallAppButton } from "@/components/InstallAppButton";
import { ServiceWorkerRegistrar } from "@/pdf/components/common/ServiceWorkerRegistrar";

export const metadata: Metadata = {
  title: "CraftBuddy Tools",
  description: "Practical tools for makers and print shops.",
  applicationName: "CraftBuddy Tools",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.svg", type: "image/svg+xml", sizes: "192x192" },
      { url: "/icon-512.svg", type: "image/svg+xml", sizes: "512x512" },
    ],
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
        {children}
        <InstallAppButton />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  );
}
