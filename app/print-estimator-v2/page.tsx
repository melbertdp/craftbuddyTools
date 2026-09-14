"use client";

import dynamic from "next/dynamic";

const PrintEstimatorV2 = dynamic(
  () => import("@/print-estimator-v2/PrintEstimatorV2").then((m) => m.PrintEstimatorV2),
  { ssr: false },
);

export default function PrintEstimatorV2Page() {
  return <PrintEstimatorV2 />;
}
