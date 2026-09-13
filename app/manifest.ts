import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CraftBuddy Tools",
    short_name: "CraftBuddy",
    description:
      "Practical, private tools for makers and print shops, including pricing, QR, and PDF tools.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6ef",
    theme_color: "#5d7052",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon-192.svg", sizes: "192x192", type: "image/svg+xml", purpose: "maskable" },
      { src: "/icon-512.svg", sizes: "512x512", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
