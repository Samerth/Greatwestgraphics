import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary";
type Size = "default" | "sm";

const base =
  "inline-flex items-center justify-center gap-sp-2 font-body font-bold rounded-md border transition-colors duration-fast whitespace-nowrap";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white border-transparent hover:bg-accent-hover",
  secondary:
    "bg-transparent text-text-primary border-border hover:border-text-tertiary hover:bg-fill-subtle-15",
};

const sizes: Record<Size, string> = {
  default: "px-5 py-3 text-body",
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
  ...props
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={cn(base, variants[variant], sizes[size], className)} {...props}>
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
}: CommonProps & { href: string }) {
  return (
    <Link href={href} className={cn(base, variants[variant], sizes[size], className)}>
      {children}
    </Link>
  );
}
