import { useMemo, type ReactNode } from "react";
import {
  ArrowUpRight,
  Bell,
  Briefcase,
  ChartColumn,
  ChevronDown,
  Clock,
  FileText,
  Image as ImageIcon,
  Inbox,
  LayoutDashboard,
  Search,
  Settings,
  Users,
  Wallet,
} from "lucide-react";
import qrcode from "qrcode-generator";
import { cn } from "@/lib/utils";

type Tone = "green" | "amber" | "slate" | "blue";

const STATUS_TONES: Record<Tone, string> = {
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-500",
  blue: "bg-indigo-50 text-indigo-600",
};

function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-[1px] text-[7.5px] font-semibold whitespace-nowrap",
        STATUS_TONES[tone],
      )}
    >
      {children}
    </span>
  );
}

const DASH_NAV = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Requests", icon: Inbox, active: false },
  { label: "Jobs", icon: Briefcase, active: false },
  { label: "Customers", icon: Users, active: false },
  { label: "Reports", icon: ChartColumn, active: false },
  { label: "Settings", icon: Settings, active: false },
] as const;

const DASH_STATS = [
  {
    label: "New requests",
    value: "12",
    sub: "Awaiting review",
    icon: Clock,
    tone: "bg-orange-50 text-orange-500",
  },
  {
    label: "Created",
    value: "4",
    sub: "Ready for production",
    icon: FileText,
    tone: "bg-emerald-50 text-emerald-500",
  },
  {
    label: "Total revenue",
    value: "₱43821",
    sub: "Last 30 days",
    icon: Wallet,
    tone: "bg-violet-50 text-violet-500",
  },
] as const;

const RECENT_REQUESTS = [
  { id: "P004", meta: "Sep 14, 10:25 AM", status: "In progress", tone: "amber" as Tone },
  { id: "5th", meta: "Sep 13, 3:54 PM", status: "In progress", tone: "amber" as Tone },
  { id: "7-Day", meta: "Sep 12, 5:33 PM", status: "Processing", tone: "blue" as Tone },
];

const AWAITING = [
  { id: "QD-001", amount: "₱22.50" },
  { id: "QD-002", amount: "₱42.80" },
  { id: "QD-003", amount: "₱76.00" },
];

const REQUEST_FILES = [
  { name: "id_card_scan.jpg", size: "2.4 MB", tone: "green" as Tone, status: "Ready" },
  { name: "poster_final.pdf", size: "28.1 MB", tone: "amber" as Tone, status: "Review" },
  { name: "logo_pack.zip", size: "14.6 MB", tone: "blue" as Tone, status: "New" },
];

const JOBS = [
  { id: "QD-001", name: "Sarah M.", amount: "₱22.50", status: "Ready", tone: "green" as Tone },
  { id: "QD-002", name: "Mia T.", amount: "₱46.00", status: "Processing", tone: "amber" as Tone },
  { id: "QD-003", name: "Ana R.", amount: "₱116.00", status: "Completed", tone: "slate" as Tone },
  { id: "QD-004", name: "John D.", amount: "₱85.00", status: "Ready", tone: "green" as Tone },
];

function DashboardMock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[18px] border border-slate-200/80 bg-white text-slate-900 shadow-[0_34px_70px_-28px_rgba(15,23,42,0.38)]",
        className,
      )}
    >
      <div className="flex">
        <aside className="hidden w-[104px] shrink-0 border-r border-slate-100 bg-[#fbfbfd] p-2.5 sm:block">
          <div className="flex items-center gap-1.5 px-1 pb-2.5">
            <span className="grid size-5 place-items-center rounded-md bg-[#22c55e] text-[10px] font-black leading-none text-white">
              q
            </span>
            <span className="font-heading text-[11px] font-extrabold tracking-[-0.03em] text-slate-900">
              quickdrop
            </span>
          </div>
          <nav className="space-y-0.5">
            {DASH_NAV.map((item) => (
              <div
                key={item.label}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-1.5 py-[5px] text-[8.5px] font-medium",
                  item.active
                    ? "bg-indigo-50 text-indigo-600"
                    : "text-slate-500",
                )}
              >
                <item.icon className="size-2.5 shrink-0" aria-hidden />
                {item.label}
              </div>
            ))}
          </nav>
          <div className="mt-3 flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1.5">
            <span className="grid size-4 shrink-0 place-items-center rounded-full bg-indigo-500 text-[7px] font-bold text-white">
              J
            </span>
            <span className="truncate text-[7.5px] text-slate-500">quickdrop.app</span>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
            <div className="relative flex h-6 flex-1 items-center rounded-md border border-slate-200 bg-slate-50 pl-5 pr-2">
              <Search className="absolute left-1.5 size-2.5 text-slate-400" aria-hidden />
              <span className="truncate text-[8px] text-slate-400">
                Search jobs, customers, files...
              </span>
              <span className="ml-auto hidden rounded border border-slate-200 bg-white px-1 text-[7px] text-slate-400 sm:block">
                ⌘K
              </span>
            </div>
            <Bell className="size-3 shrink-0 text-slate-400" aria-hidden />
            <span className="hidden shrink-0 items-center gap-1 rounded-md bg-[#4f46e5] px-2 py-1.5 text-[8px] font-semibold text-white sm:inline-flex">
              Open a new request
            </span>
          </div>

          <div className="space-y-2.5 p-3">
            <div>
              <p className="font-heading text-[13px] font-extrabold tracking-[-0.02em] text-slate-900">
                Good morning, Jordan 👋
              </p>
              <p className="text-[8px] text-slate-500">
                Here&apos;s what&apos;s happening in your shop today.
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {DASH_STATS.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg border border-slate-200/80 bg-white p-1.5"
                >
                  <span
                    className={cn(
                      "grid size-4 place-items-center rounded-md",
                      stat.tone,
                    )}
                  >
                    <stat.icon className="size-2.5" aria-hidden />
                  </span>
                  <p className="mt-1 text-[7.5px] font-medium text-slate-500">
                    {stat.label}
                  </p>
                  <p className="font-heading text-[12px] font-extrabold leading-tight text-slate-900">
                    {stat.value}
                  </p>
                  <p className="text-[6.5px] leading-tight text-slate-400">{stat.sub}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-[1.15fr_1fr] gap-2">
              <div className="rounded-lg border border-slate-200/80 bg-white p-2">
                <div className="flex items-start justify-between gap-1">
                  <p className="text-[8.5px] font-semibold text-slate-600">
                    Today&apos;s revenue
                  </p>
                  <span className="rounded bg-emerald-50 px-1 text-[6.5px] font-semibold text-emerald-600">
                    +28%
                  </span>
                </div>
                <p className="font-heading text-[14px] font-extrabold leading-tight text-slate-900">
                  ₱22.50
                </p>
                <p className="text-[6.5px] text-slate-400">
                  From customer files and jobs this month
                </p>
                <div className="relative mt-1.5">
                  <svg viewBox="0 0 120 40" preserveAspectRatio="none" className="h-10 w-full">
                    <defs>
                      <linearGradient id="qd-revenue-fill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.28" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M0 34 L18 30 L36 32 L54 26 L72 28 L90 11 L108 21 L120 17 L120 40 L0 40 Z"
                      fill="url(#qd-revenue-fill)"
                    />
                    <path
                      d="M0 34 L18 30 L36 32 L54 26 L72 28 L90 11 L108 21 L120 17"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="90" cy="11" r="2.2" fill="#6366f1" stroke="#fff" strokeWidth="1" />
                  </svg>
                  <span className="absolute right-[18%] top-0 rounded bg-slate-900 px-1 py-[1px] text-[6px] font-semibold text-white">
                    ₱18.4
                  </span>
                </div>
                <div className="mt-1 flex items-center justify-between text-[6.5px] text-slate-400">
                  <span>12AM</span>
                  <span>6AM</span>
                  <span>12PM</span>
                  <span>6PM</span>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200/80 bg-white p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[8.5px] font-semibold text-slate-600">
                    Recent requests
                  </p>
                  <span className="text-[6.5px] font-medium text-indigo-600">View all</span>
                </div>
                <div className="mt-1.5 space-y-1">
                  {RECENT_REQUESTS.map((req) => (
                    <div
                      key={req.id}
                      className="flex items-center gap-1.5 rounded-md bg-slate-50 px-1.5 py-1"
                    >
                      <span className="grid size-3.5 shrink-0 place-items-center rounded bg-white text-slate-400">
                        <FileText className="size-2" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[7.5px] font-semibold text-slate-700">
                          {req.id}
                        </p>
                        <p className="truncate text-[6.5px] text-slate-400">{req.meta}</p>
                      </div>
                      <StatusPill tone={req.tone}>{req.status}</StatusPill>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-slate-200/80 bg-white p-2">
                <p className="text-[8.5px] font-semibold text-slate-600">
                  3 awaiting checkout
                </p>
                <div className="mt-1.5 space-y-1">
                  {AWAITING.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between text-[7.5px]"
                    >
                      <span className="text-slate-500">{row.id}</span>
                      <span className="font-semibold text-slate-700">{row.amount}</span>
                    </div>
                  ))}
                </div>
                <p className="mt-1.5 flex items-center gap-0.5 text-[6.5px] font-medium text-indigo-600">
                  Open tabs
                  <ArrowUpRight className="size-2" aria-hidden />
                </p>
              </div>

              <div className="rounded-lg border border-slate-200/80 bg-white p-2">
                <div className="flex items-center justify-between">
                  <p className="text-[8.5px] font-semibold text-slate-600">
                    Receiver status
                  </p>
                  <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-[1px] text-[6.5px] font-semibold text-emerald-600">
                    <span className="size-1 rounded-full bg-emerald-500" />
                    Online
                  </span>
                </div>
                <div className="mt-1.5 space-y-1 text-[7px]">
                  <div className="flex items-center gap-1 text-slate-500">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Status
                    <span className="ml-auto font-semibold text-slate-700">Online</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Local IP</span>
                    <span className="font-semibold text-slate-700">192.168.1.99</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Port</span>
                    <span className="font-semibold text-slate-700">43821</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-500">
                    <span>Active uploads</span>
                    <span className="font-semibold text-slate-700">0</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RequestsMiniCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_26px_50px_-24px_rgba(15,23,42,0.4)]",
        className,
      )}
    >
      <p className="font-heading text-[14px] font-extrabold tracking-[-0.02em] text-slate-900">
        Requests
      </p>
      <div className="mt-2 flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5">
        <Search className="size-2.5 text-slate-400" aria-hidden />
        <span className="text-[8px] text-slate-400">Search customer files, IDs, notes...</span>
      </div>
      <div className="mt-2 space-y-1.5">
        {REQUEST_FILES.map((file) => (
          <div key={file.name} className="flex items-center gap-2">
            <span className="grid size-6 shrink-0 place-items-center rounded-md bg-slate-100 text-slate-400">
              {file.name.endsWith(".jpg") ? (
                <ImageIcon className="size-3" aria-hidden />
              ) : (
                <FileText className="size-3" aria-hidden />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-semibold text-slate-700">{file.name}</p>
              <p className="text-[7.5px] text-slate-400">{file.size}</p>
            </div>
            <StatusPill tone={file.tone}>{file.status}</StatusPill>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReportsMiniCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_26px_50px_-24px_rgba(15,23,42,0.4)]",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-heading text-[14px] font-extrabold tracking-[-0.02em] text-slate-900">
          Reports
        </p>
        <ChevronDown className="size-3 text-slate-400" aria-hidden />
      </div>
      <div className="mt-2 inline-flex rounded-lg bg-slate-100 p-0.5 text-[8px] font-semibold">
        <span className="rounded-md bg-white px-2 py-1 text-slate-700 shadow-sm">
          This month
        </span>
        <span className="px-2 py-1 text-slate-400">Last month</span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <div>
          <p className="text-[7.5px] text-slate-400">Files created</p>
          <p className="font-heading text-[13px] font-extrabold text-slate-900">4480</p>
        </div>
        <div>
          <p className="text-[7.5px] text-slate-400">Jobs value</p>
          <p className="font-heading text-[13px] font-extrabold text-slate-900">₱51,58</p>
        </div>
      </div>
      <div className="mt-2">
        <p className="text-[7.5px] font-medium text-slate-500">Past 7 days</p>
        <svg viewBox="0 0 140 34" preserveAspectRatio="none" className="mt-1 h-8 w-full">
          <path
            d="M0 26 L20 22 L40 24 L60 18 L80 20 L100 10 L120 14 L140 8"
            fill="none"
            stroke="#6366f1"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="flex items-center justify-between text-[6.5px] text-slate-400">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
            <span key={day}>{day.charAt(0)}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function DropZoneQr({ className }: { className?: string }) {
  const matrix = useMemo(() => {
    try {
      const qr = qrcode(0, "M");
      qr.addData("http://192.168.1.99:43821");
      qr.make();
      const count = qr.getModuleCount();
      return Array.from({ length: count }, (_, row) =>
        Array.from({ length: count }, (_, col) => qr.isDark(row, col)),
      );
    } catch {
      return null;
    }
  }, []);

  if (!matrix) {
    return <div className={cn("rounded-md bg-slate-100", className)} aria-hidden />;
  }

  const count = matrix.length;
  return (
    <svg
      viewBox={`0 0 ${count} ${count}`}
      className={cn("text-slate-900", className)}
      role="img"
      aria-label="QuickDrop drop zone QR code"
    >
      <rect width={count} height={count} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill="currentColor" />
          ) : null,
        ),
      )}
    </svg>
  );
}

function DropZoneCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_26px_50px_-24px_rgba(15,23,42,0.4)]",
        className,
      )}
    >
      <p className="font-heading text-[14px] font-extrabold tracking-[-0.02em] text-slate-900">
        Your drop zone
      </p>
      <p className="mt-1 text-[8px] leading-snug text-slate-500">
        Your customers can scan this QR code to send you files directly.
      </p>
      <div className="mt-2.5 grid place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-2.5">
        <DropZoneQr className="size-[86px]" />
        <p className="mt-1.5 text-[9px] font-semibold text-slate-800">Scan to send files</p>
        <p className="text-center text-[7px] leading-snug text-slate-400">
          Customers can scan this QR code to send files to your local network.
        </p>
      </div>
    </div>
  );
}

const JOB_TABS = ["All", "Print", "Apparel", "Photo", "Custom"] as const;

function JobsMiniCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-[0_26px_50px_-24px_rgba(15,23,42,0.4)]",
        className,
      )}
    >
      <p className="font-heading text-[14px] font-extrabold tracking-[-0.02em] text-slate-900">
        Jobs
      </p>
      <div className="mt-2 flex items-center gap-1 overflow-hidden text-[7.5px] font-semibold">
        {JOB_TABS.map((tab, index) => (
          <span
            key={tab}
            className={cn(
              "rounded-md px-1.5 py-[3px]",
              index === 0 ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500",
            )}
          >
            {tab}
          </span>
        ))}
      </div>
      <div className="mt-2 space-y-1.5">
        {JOBS.map((job) => (
          <div key={job.id} className="flex items-center gap-2 text-[8px]">
            <span className="w-[34px] shrink-0 font-medium text-slate-400">{job.id}</span>
            <span className="min-w-0 flex-1 truncate font-semibold text-slate-700">
              {job.name}
            </span>
            <span className="font-semibold text-slate-600">{job.amount}</span>
            <StatusPill tone={job.tone}>{job.status}</StatusPill>
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuickDropShowcase({ className }: { className?: string }) {
  return (
    <div className={cn("relative", className)}>
      

      <div className="relative lg:h-[604px]">
        <DashboardMock className="mx-auto w-full max-w-[520px] lg:absolute lg:left-1/2 lg:top-1/2 lg:mx-0 lg:w-[442px] lg:max-w-none lg:-translate-x-1/2 lg:-translate-y-1/2" />

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:mt-0 lg:block">
          <RequestsMiniCard className="lg:absolute lg:left-0 lg:top-[58px] lg:w-[202px] xl:-left-8" />
          <ReportsMiniCard className="lg:absolute lg:left-0 lg:top-[330px] lg:w-[202px] xl:-left-8" />
          <DropZoneCard className="lg:absolute lg:right-0 lg:top-[32px] lg:w-[206px] xl:-right-8" />
          <JobsMiniCard className="lg:absolute lg:right-0 lg:top-[336px] lg:w-[212px] xl:-right-8" />
        </div>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute -right-4 top-1/2 hidden size-40 -translate-y-1/2 rounded-full bg-indigo-200/30 blur-3xl xl:block"
      />
    </div>
  );
}
