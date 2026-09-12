import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CraftBuddy PDF Tools",
    short_name: "PDF Tools",
    description:
      "Private, local-first PDF tools: edit, sign, merge, split, convert, watermark, and compress PDFs in your browser.",
    start_url: "/pdf",
    scope: "/",
    display: "standalone",
    background_color: "#f5f1eb",
    theme_color: "#bb563a",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
