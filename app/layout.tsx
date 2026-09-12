import type { Metadata } from "next";
import "../src/styles.css";

export const metadata: Metadata = {
  title: "CraftBuddy Tools",
  description: "Practical pricing tools for makers and print shops.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
