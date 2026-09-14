"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { BrandHeader } from "@/components/BrandHeader";
import { SiteFooter } from "@/components/SiteFooter";

const PrintEstimatorV2 = dynamic(
  () => import("@/print-estimator-v2/PrintEstimatorV2").then((m) => m.PrintEstimatorV2),
  { ssr: false },
);

export default function PrintEstimatorV2Page() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <BrandHeader>
        <nav className="flex w-full flex-col items-stretch gap-0 sm:w-max sm:flex-row sm:flex-nowrap sm:items-center sm:justify-end sm:gap-6">
          {[
            ["/print-estimator-v2", "Print Calculator"],
            ["/cost-estimator", "Cost estimator"],
            ["/qr-generator", "QR generator"],
            ["/id-photo-print", "ID photo print"],
            // ["/profiles", "Profiles"],
            ["/market-benchmark", "Market benchmark"],
            ["/pdf", "PDF tools"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className="px-3 py-2 text-left text-sm text-muted-foreground transition-colors hover:text-foreground sm:px-0 sm:py-0"
            >
              {label}
            </Link>
          ))}
        </nav>
      </BrandHeader>
      <PrintEstimatorV2 />
      <SiteFooter />
    </div>
  );
}
