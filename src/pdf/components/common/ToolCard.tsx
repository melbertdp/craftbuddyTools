import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";

interface ToolCardProps {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}

export function ToolCard({ href, title, description, icon: Icon }: ToolCardProps) {
  return (
    <Link
      to={href}
      className="group flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
    >
      <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4.5" aria-hidden />
      </span>
      <span className="space-y-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </Link>
  );
}
