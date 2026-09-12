import { CraftBuddyProductCard, type ProductCardTheme } from "./CraftBuddyProductCard";
import { BrowserAppIllustration, DesktopAppIllustration } from "./ProductIllustrations";

// Replace with the real destinations when the CraftBuddy web app and desktop
// pricing pages ship. The web tools already live on this page, so the web app
// link anchors to them; the desktop link stays in-section until pricing exists.
const CRAFTBUDDY_WEB_APP_URL = "https://craftbuddy.app";
const CRAFTBUDDY_DESKTOP_PLANS_URL = "#workspace";

const WEB_THEME: ProductCardTheme = {
  background: "bg-[#eef2e8]",
  border: "border-[rgba(56,82,60,0.16)] hover:border-[rgba(56,82,60,0.34)]",
  label: "text-[#5d7052]",
  offer: "text-[#2f463a]",
  cta: "text-[#2f463a]",
};

const DESKTOP_THEME: ProductCardTheme = {
  background: "bg-[#dde8de]",
  border: "border-[rgba(56,82,60,0.20)] hover:border-[rgba(56,82,60,0.40)]",
  label: "text-[#41604b]",
  offer: "text-[#20372b]",
  cta: "text-[#2f463a]",
};

export function WorkspaceSection() {
  return (
    <section
      id="workspace"
      aria-labelledby="workspace-heading"
      className="scroll-mt-24 border-t border-[rgba(56,82,60,0.16)] px-6 py-14 sm:px-10 sm:py-16 lg:px-16 lg:py-20"
    >
      <div className="mx-auto w-full max-w-[1320px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[#6f8368]">
          Choose your workspace
        </p>
        <h2
          id="workspace-heading"
          className="mt-4 font-heading text-[clamp(30px,5vw,48px)] font-extrabold leading-[1.04] tracking-[-0.035em] text-[#20372b]"
        >
          Use CraftBuddy on the web or on your desktop.
        </h2>
        <p className="mt-4 max-w-[54ch] text-[15px] leading-7 text-[#526057] sm:text-base">
          Start free in the browser or choose a desktop plan that fits your
          workflow.
        </p>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
          <CraftBuddyProductCard
            eyebrow="Web app"
            title="CraftBuddy Web"
            offer="Try for free"
            description="Use it in your browser for pricing, orders, inventory, and everyday maker workflows."
            cta="Open web app"
            href={CRAFTBUDDY_WEB_APP_URL}
            theme={WEB_THEME}
            illustration={<BrowserAppIllustration />}
          />
          <CraftBuddyProductCard
            eyebrow="Desktop app"
            title="CraftBuddy Desktop"
            offer="From ₱50/month"
            offerNote="Quarterly and lifetime plans available"
            description="A dedicated desktop app for focused day-to-day production, pricing, inventory, orders, and maker workflows."
            cta="Explore plans"
            href={CRAFTBUDDY_DESKTOP_PLANS_URL}
            theme={DESKTOP_THEME}
            illustration={<DesktopAppIllustration />}
          />
        </div>
      </div>
    </section>
  );
}
