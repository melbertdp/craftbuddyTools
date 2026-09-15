import {
  ArrowRight,
  Briefcase,
  ChartColumn,
  Check,
  ClipboardList,
  Play,
  Upload,
  Wallet,
} from "lucide-react";
import { QuickDropShowcase } from "./QuickDropShowcase";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

const HERO_POINTS = [
  "Works on your local network",
  "No complex setup",
  "Built for print & photo shops",
];

const FEATURES = [
  {
    title: "Receive files via QR or link",
    description:
      "Customers can scan a QR code or open a link to upload files directly to your local receiver.",
    icon: Upload,
  },
  {
    title: "Organize customer requests",
    description:
      "Keep track of incoming files, customer details and request status in one place.",
    icon: ClipboardList,
  },
  {
    title: "Convert requests to jobs",
    description:
      "Turn approved requests into jobs, add services and pricing, and checkout with ease.",
    icon: Briefcase,
  },
  {
    title: "Checkout & payment tracking",
    description:
      "Simple POS-style checkout with payment status, balances, and job management.",
    icon: Wallet,
  },
  {
    title: "Insightful profit reports",
    description:
      "Track revenue, costs and profit with beautiful, easy-to-read reports.",
    icon: ChartColumn,
  },
];

export function QuickDropPage() {
  return (
    <div className="craft-landing min-h-screen">
      <SiteHeader />
      <main>
        <section className="relative">
          <div className="relative mx-auto w-full max-w-[1320px] px-6 pb-10 pt-8 sm:px-10 sm:pb-12 sm:pt-12 lg:px-16 lg:pb-8 lg:pt-12">
            <div className="grid gap-14 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-start lg:gap-10 xl:gap-12">
              <div className="craft-fade-up max-w-[440px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-slate-400">
                  Simple · Local · Powerful
                </p>
                <h1 className="mt-6 font-heading text-[clamp(28px,3.4vw,38px)] font-extrabold leading-[1.08] tracking-[-0.04em] text-[#0f172a]">
                  Receive customer files. Organize requests.{" "}
                  <span className="text-[#2f463a]">Checkout jobs faster.</span>
                </h1>
                <p className="mt-6 max-w-[44ch] text-[15px] leading-7 text-slate-500 sm:text-base">
                  QuickDrop makes it easy to collect files from customers over
                  your local network, manage requests, convert them to jobs, and
                  track payments - all in one simple, lightweight app.
                </p>

                <div className="craft-fade-up craft-delay-1 mt-8 flex flex-wrap items-center gap-3">
                  <a
                    href="https://www.messenger.com/t/itscraftbuddy"
                    rel="none"
                    target="_blank"
                    className="inline-flex items-center gap-2 rounded-xl bg-[#2f463a] px-5 py-3 text-sm font-semibold text-[#f5f8f1] shadow-[0_12px_26px_-14px_rgba(34,55,39,0.7)] transition-colors hover:bg-[#20372b] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f2]"
                  >
                    Try QuickDrop
                    <ArrowRight className="size-4" aria-hidden />
                  </a>
                  <a
                    href="#features"
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#4f46e5]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#f7f8f2]"
                  >
                    <Play className="size-3.5 fill-current" aria-hidden />
                    See demo
                  </a>
                </div>

                <ul className="craft-fade-up craft-delay-2 mt-8 space-y-2.5">
                  {HERO_POINTS.map((point) => (
                    <li
                      key={point}
                      className="flex items-center gap-2.5 text-[13.5px] font-medium text-slate-600"
                    >
                      <span className="grid size-[18px] shrink-0 place-items-center rounded-full bg-emerald-500 text-white">
                        <Check
                          className="size-2.5"
                          strokeWidth={3.5}
                          aria-hidden
                        />
                      </span>
                      {point}
                    </li>
                  ))}
                </ul>
              </div>

              <QuickDropShowcase className="craft-fade-up craft-delay-1 w-full" />
            </div>
          </div>
        </section>

        <section
          id="features"
          aria-label="QuickDrop features"
          className="scroll-mt-24 border-t border-[rgba(56,82,60,0.16)] px-6 py-8 sm:px-10 sm:py-10 lg:px-16 lg:py-12"
        >
          <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:gap-5">
            {FEATURES.map((feature) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-[rgba(56,82,60,0.16)] bg-[#eef2e8] p-5 shadow-[0_14px_34px_-24px_rgba(34,55,39,0.5)]"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-white text-[#2f463a] shadow-[0_8px_18px_-12px_rgba(34,55,39,0.6)]">
                  <feature.icon className="size-5" aria-hidden />
                </span>
                <h2 className="mt-4 font-heading text-[15px] font-bold tracking-[-0.01em] text-[#0f172a]">
                  {feature.title}
                </h2>
                <p className="mt-1.5 text-[12.5px] leading-5 text-slate-500">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
