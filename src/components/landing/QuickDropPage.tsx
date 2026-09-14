import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { SiteFooter } from "./SiteFooter";
import { SiteHeader } from "./SiteHeader";

export function QuickDropPage() {
  return (
    <div className="craft-landing min-h-screen">
      <SiteHeader />
      <main>
        <section className="mx-auto w-full max-w-[1320px] px-6 pb-24 pt-20 sm:px-10 lg:px-16 lg:pt-28">
          <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f8368]">
            CraftBuddy QuickDrop
          </p>
          <h1 className="mt-6 max-w-[12ch] font-heading text-[clamp(52px,9vw,110px)] font-extrabold leading-[0.9] tracking-[-0.045em] text-[#20372b]">
            Get files. Faster.
          </h1>
          <p className="mt-8 max-w-[42ch] text-base leading-8 text-[#526057] sm:text-lg">
            QuickDrop makes sending files to your workspace faster and simpler.
          </p>
          <div className="mt-14 grid max-w-5xl gap-10 border-t border-[#d9e3d5] pt-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-16">
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[#20372b]">
                A private local file receiver for print shops.
              </h2>
              <p className="mt-4 text-[15px] leading-7 text-[#526057]">
                Customers can scan a QR code or open a link on their phone, enter
                their contact details and request, and upload documents directly
                to the shop computer over the local network. Staff use the
                QuickDrop desktop app to receive, review, organize, and manage
                incoming requests without sending files through a public cloud
                service.
              </p>
            </div>
            <div>
              <h2 className="font-heading text-2xl font-bold tracking-[-0.03em] text-[#20372b]">
                What it does
              </h2>
              <ul className="mt-4 space-y-3 text-[15px] leading-7 text-[#526057]">
                <li>Hosts a secure upload page on the shop computer.</li>
                <li>Accepts documents, images, text files, and ZIP archives.</li>
                <li>Stores each upload as an organized request with sender details and attachments.</li>
                <li>Shows incoming requests in the desktop inbox in FIFO order.</li>
                <li>Supports an optional Windows mobile hotspot for customers without local Wi-Fi.</li>
                <li>Provides QR codes and shareable local network links for quick customer access.</li>
              </ul>
            </div>
          </div>
          <Link
            to="/"
            className="mt-10 inline-flex items-center gap-2 rounded-xl bg-[#2f463a] px-6 py-3.5 text-sm font-semibold text-[#f5f8f1] transition-colors hover:bg-[#20372b] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[#6f8368]/60 focus-visible:ring-offset-2"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to tools
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
