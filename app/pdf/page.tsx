import { Lock } from "lucide-react";
import { BrandHeader } from "@/components/BrandHeader";
import { ToolsNav } from "@/components/ToolsNav";
import { ToolCard } from "@/pdf/components/common/ToolCard";
import { PDF_TOOL_CATEGORIES } from "@/pdf/tools";
import { SiteFooter } from "@/components/SiteFooter";

export default function PdfHomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <BrandHeader>
        <div className="flex items-center gap-5">
          <ToolsNav className="hidden md:flex" />
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
            <Lock className="size-3" aria-hidden />
            Local processing
          </span>
        </div>
      </BrandHeader>

      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-10">
        <div className="max-w-[720px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-primary">
            Private PDF platform
          </p>
          <h1 className="mt-3 font-heading text-[clamp(32px,5vw,52px)] font-extrabold leading-none tracking-[-0.04em]">
            PDF tools that stay
            <br />
            <span className="text-primary">on your device.</span>
          </h1>
          <p className="mt-5 text-base leading-relaxed text-muted-foreground">
            Your documents stay on your device. PDF processing happens directly in your browser -
            no uploads, no accounts, no queues.
          </p>
        </div>

        <div className="mt-12 space-y-12">
          {PDF_TOOL_CATEGORIES.map((category) => (
            <section key={category.id} aria-labelledby={`category-${category.id}`}>
              <h2
                id={`category-${category.id}`}
                className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground"
              >
                {category.title}
              </h2>
              <div className="mt-4 grid grid-cols-4 gap-4 max-[1100px]:grid-cols-3 max-[760px]:grid-cols-2 max-[520px]:grid-cols-1">
                {category.tools.map((tool) => (
                  <ToolCard
                    key={tool.slug}
                    href={`/pdf/${tool.slug}`}
                    title={tool.title}
                    description={tool.description}
                    icon={tool.icon}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
