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
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
