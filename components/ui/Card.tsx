import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

type CardTone = "default" | "raised" | "accent" | "warning" | "danger";

const TONE_CLASSES: Record<CardTone, string> = {
  default: "border-border bg-bg-raised",
  raised: "border-border bg-bg-raised shadow-card",
  accent: "border-accent-tint-strong bg-accent-tint",
  warning: "border-amber-200 bg-amber-50",
  danger: "border-red-200 bg-red-50",
};

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  tone?: CardTone;
  padded?: boolean;
  children: ReactNode;
}

/** The one card shape every admin page already draws by hand, ~30 times
 *  over, as `border border-border rounded-md p-sp-3/4 bg-bg-raised`. Pulled
 *  out so a section can carry a tone (an accent-tinted card for the rush
 *  request, a warning card for a stock shortfall) without re-deriving the
 *  Tailwind string at every call site. */
export function Card({
  tone = "default",
  padded = true,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      className={cn(
        "border rounded-md",
        padded && "p-sp-4",
        TONE_CLASSES[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}

interface SectionCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  eyebrow?: ReactNode;
  /** Right-aligned next to the title — a Badge, a count, a link. */
  aside?: ReactNode;
  level?: 2 | 3;
  tone?: CardTone;
  children: ReactNode;
}

/** A `Card` with a titled header — the workhorse for every section of the
 *  job page (Products, Inventory, Proofs, Fulfilment, …). One heading per
 *  card keeps the page scannable, which is the client's own complaint about
 *  the current layout: "all information has roughly the same visual
 *  importance." */
export function SectionCard({
  title,
  eyebrow,
  aside,
  level = 2,
  tone = "default",
  className,
  children,
  ...rest
}: SectionCardProps) {
  const Heading = level === 2 ? "h2" : "h3";
  return (
    <Card tone={tone} className={cn("space-y-sp-3", className)} {...rest}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {eyebrow && (
            <p className="text-xs font-bold uppercase tracking-wider text-accent m-0 mb-1">
              {eyebrow}
            </p>
          )}
          <Heading className="font-display font-bold text-lg m-0">
            {title}
          </Heading>
        </div>
        {aside && <div className="shrink-0">{aside}</div>}
      </div>
      {children}
    </Card>
  );
}
