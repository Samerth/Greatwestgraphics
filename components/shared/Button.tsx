import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";
type Size = "default" | "sm";

// `active:translate-y-px` is the whole of the press feedback — buttons
// previously transitioned colour only, so nothing on the site acknowledged
// being clicked. Kept deliberately small: a press response, not a bounce.
const base =
  "inline-flex items-center justify-center gap-sp-2 font-body font-bold rounded-md border transition-[background-color,border-color,color,box-shadow,transform] duration-fast ease-out-custom active:translate-y-px whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none disabled:active:translate-y-0";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent !text-white border-transparent hover:bg-accent-hover",
  secondary:
    "bg-transparent text-text-primary border-border hover:border-text-tertiary hover:bg-fill-subtle-15",
};

const sizes: Record<Size, string> = {
  // `text-body` is a custom font-size token. tailwind-merge treats unknown
  // `text-*` classes as colours and removed `text-white` from primary buttons,
  // leaving dark inherited text on the blue accent background.
  default: "px-5 py-3 text-[length:var(--fs-body)] leading-[var(--lh-body)]",
  sm: "px-3.5 py-2 text-sm",
};

interface CommonProps {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "default",
  className,
  children,
  type = "button",
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(base, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "default",
  className,
  children,
  target,
  rel,
}: CommonProps & {
  href: string;
  /** Set for links leaving the site, so a visitor doesn't lose their place. */
  target?: string;
  rel?: string;
}) {
  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? (rel ?? "noreferrer noopener") : rel}
      className={cn(base, variants[variant], sizes[size], className)}
    >
      {children}
    </Link>
  );
}
