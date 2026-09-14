import { Hero } from "./Hero";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";
import { ToolCard, type ToolCardTheme } from "./ToolCard";
import {
  PdfToolsIllustration,
  PhotoIdIllustration,
  PrintSheetsIllustration,
  ProductCostIllustration,
  QrCodeIllustration,
} from "./ToolIllustrations";
import { TrustBar } from "./TrustBar";
import { WorkspaceSection } from "./WorkspaceSection";

type Tool = {
  category: string;
  title: string;
  description: string;
  cta: string;
  href: string;
  external?: boolean;
  theme: ToolCardTheme;
  illustration: React.ReactNode;
};

const TOOLS: Tool[] = [
  {
    category: "01 / Printing",
    title: "Print cost estimator",
    description:
      "Read a design, account for paper and ink, then set a price that protects your margin.",
    cta: "Estimate a print job",
    href: "/print-estimator-v2",
    theme: {
      background: "bg-[#e1e9da]",
      border: "border-[rgba(56,82,60,0.18)] hover:border-[rgba(56,82,60,0.36)]",
      label: "text-[#4f6449]",
      cta: "text-[#2f463a]",
    },
    illustration: <PrintSheetsIllustration />,
  },
  {
    category: "02 / Pricing",
    title: "Product cost estimator",
    description:
      "Build a cost base from materials, labor, and overhead with simple manual inputs.",
    cta: "Price a product",
    href: "/cost-estimator",
    theme: {
      background: "bg-[#f2e8d3]",
      border: "border-[rgba(150,116,60,0.22)] hover:border-[rgba(150,116,60,0.42)]",
      label: "text-[#9a7434]",
      cta: "text-[#8a6323]",
    },
    illustration: <ProductCostIllustration />,
  },
  {
    category: "03 / Reference",
    title: "Market price benchmark",
    description:
      "Compare common printing service prices against observed market ranges in the Philippines.",
    cta: "Browse market prices",
    href: "/market-benchmark",
    theme: {
      background: "bg-[#e8eee4]",
      border: "border-[rgba(56,82,60,0.18)] hover:border-[rgba(56,82,60,0.36)]",
      label: "text-[#4f6449]",
      cta: "text-[#2f463a]",
    },
    illustration: <ProductCostIllustration />,
  },
  {
    category: "04 / Creative",
    title: "QR code designer",
    description:
      "Create branded QR codes locally with flexible styling, logo support, and production-ready exports.",
    cta: "Design a QR code",
    href: "/qr-generator",
    theme: {
      background: "bg-[#f4ded2]",
      border: "border-[rgba(178,105,80,0.22)] hover:border-[rgba(178,105,80,0.44)]",
      label: "text-[#a85f45]",
      cta: "text-[#9a4f38]",
    },
    illustration: <QrCodeIllustration />,
  },
  {
    category: "05 / Photos",
    title: "Photo ID editor",
    description:
      "Crop, retouch, and tile passport or ID photos onto a print-ready sheet without leaving your browser.",
    cta: "Make ID photos",
    href: "/id-photo-print",
    theme: {
      background: "bg-[#dbe7ef]",
      border: "border-[rgba(58,102,140,0.22)] hover:border-[rgba(58,102,140,0.44)]",
      label: "text-[#4d6c86]",
      cta: "text-[#37556b]",
    },
    illustration: <PhotoIdIllustration />,
  },
  {
    category: "06 / Documents",
    title: "PDF tools",
    description:
      "Edit, sign, merge, split, convert, watermark, and compress PDFs. Every document stays on your device.",
    cta: "Open PDF tools",
    href: "/pdf",
    theme: {
      background: "bg-[#dce7de]",
      border: "border-[rgba(56,82,60,0.18)] hover:border-[rgba(56,82,60,0.36)]",
      label: "text-[#41604b]",
      cta: "text-[#2f463a]",
    },
    illustration: <PdfToolsIllustration />,
  },
];

export function LandingPage() {
  return (
    <div className="craft-landing min-h-screen">
      <SiteHeader />
      <main>
        <Hero />
        <section
          id="tools"
          aria-label="Craft tools"
          className="mx-auto w-full max-w-[1320px] scroll-mt-24 px-6 pb-16 sm:px-10 sm:pb-20 lg:px-16 lg:pb-24"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
            {TOOLS.map((tool) => (
              <ToolCard
                key={tool.href}
                category={tool.category}
                title={tool.title}
                description={tool.description}
                cta={tool.cta}
                href={tool.href}
                external={tool.external}
                theme={tool.theme}
                illustration={tool.illustration}
              />
            ))}
          </div>
        </section>
        <TrustBar />
        <WorkspaceSection />
      </main>
      <SiteFooter />
    </div>
  );
}
