import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  category,
  brands,
  priceMinMinor,
  priceMaxMinor,
  search,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  category?: string | null;
  brands?: string[];
  priceMinMinor?: number;
  priceMaxMinor?: number;
  search?: string;
}) {
  if (pageCount <= 1) return null;

  function hrefFor(target: number) {
    const params = new URLSearchParams();
    if (search) params.set("q", search);
    if (category) params.set("category", category);
    for (const brand of brands ?? []) params.append("brand", brand);
    if (priceMinMinor != null) params.set("priceMin", String(priceMinMinor));
    if (priceMaxMinor != null) params.set("priceMax", String(priceMaxMinor));
    if (target > 1) params.set("page", String(target));
    const qs = params.toString();
    return `/products${qs ? `?${qs}` : ""}`;
  }

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Compact page-number window: first, last, current ±1, with ellipses.
  const pages = new Set<number>([1, pageCount, page - 1, page, page + 1]);
  const numbers = [...pages].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);

  return (
    <nav
      aria-label="Product pages"
      className="mt-sp-4 flex flex-wrap items-center justify-between gap-sp-3"
    >
      <p className="text-[13px] text-text-tertiary m-0">
        Showing {start.toLocaleString()}–{end.toLocaleString()} of {total.toLocaleString()}
      </p>
      <div className="flex items-center gap-1.5">
        <PageLink href={hrefFor(page - 1)} disabled={page <= 1} label="← Prev" />
        {numbers.map((n, i) => (
          <span key={n} className="flex items-center gap-1.5">
            {i > 0 && numbers[i - 1] !== n - 1 && (
              <span className="text-text-tertiary px-1">…</span>
            )}
            <Link
              href={hrefFor(n)}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "min-w-9 h-9 px-2 grid place-items-center border rounded-sm font-bold text-[13px] transition-colors",
                n === page
                  ? "bg-accent border-accent text-white"
                  : "border-border bg-bg-raised hover:border-text-tertiary",
              )}
            >
              {n}
            </Link>
          </span>
        ))}
        <PageLink href={hrefFor(page + 1)} disabled={page >= pageCount} label="Next →" />
      </div>
    </nav>
  );
}

function PageLink({
  href,
  disabled,
  label,
}: {
  href: string;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="px-3 h-9 grid place-items-center border border-border rounded-sm text-[13px] font-bold text-text-tertiary opacity-40">
        {label}
      </span>
    );
  }
  return (
    <Link
      href={href}
      className="px-3 h-9 grid place-items-center border border-border rounded-sm text-[13px] font-bold hover:border-text-tertiary bg-bg-raised transition-colors"
    >
      {label}
    </Link>
  );
}
