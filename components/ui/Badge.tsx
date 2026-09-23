import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";
import type { StatusTone } from "@/lib/commerce/status";

/** The one place a literal Tailwind palette class is allowed to live for a
 *  status tone. There is no `success`/`warning`/`danger` design token in
 *  `tailwind.config.ts` yet (see `text-error`, which has been rendering as
 *  nothing in several admin/portal files) — so this map is what stands
 *  between "add a real token" and "grep 30 files" the day that happens. */
const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: "bg-fill-subtle-15 text-text-secondary",
  info: "bg-accent-tint text-accent",
  progress: "bg-blue-50 text-blue-800",
  success: "bg-green-50 text-green-800",
  warning: "bg-amber-50 text-amber-900",
  danger: "bg-red-50 text-red-800",
};

const SIZE_CLASSES = {
  sm: "text-xs px-2 py-0.5",
  md: "text-sm px-3 py-1",
};

interface BadgeProps {
  tone: StatusTone;
  size?: "sm" | "md";
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge({ tone, size = "md", icon, children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 font-bold rounded-full h-fit whitespace-nowrap",
        TONE_CLASSES[tone],
        SIZE_CLASSES[size],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
