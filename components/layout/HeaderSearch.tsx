"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";

type SuggestResult = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  styleName: string;
  imageUrl: string | null;
  priceFrom: string;
};

const MIN_CHARS = 2;
const DEBOUNCE_MS = 220;
const SUGGEST_LIMIT = 6;

/**
 * Shared fetch + debounce + keyboard-nav logic for the predictive dropdown.
 * Both the desktop bar and the mobile overlay use this so typo/results
 * behaviour never drifts between the two.
 */
function useCatalogSuggest(query: string) {
  const [results, setResults] = useState<SuggestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_CHARS) {
      setResults([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      fetch(
        `/api/commerce/catalog/products?search=${encodeURIComponent(trimmed)}&limit=${SUGGEST_LIMIT}`,
      )
        .then((res) => (res.ok ? res.json() : { products: [] }))
        .then((data) => {
          if (cancelled) return;
          setResults(
            (data.products || []).map((p: Record<string, unknown>) => ({
              id: String(p.id),
              slug: String(p.slug),
              name: String(p.name),
              brandName: String(p.brandName || ""),
              styleName: String(p.styleName || ""),
              imageUrl: (p.imageUrl as string | null) || null,
              priceFrom: String(p.priceFrom || ""),
            })),
          );
          setSearched(true);
        })
        .catch(() => {
          if (!cancelled) {
            setResults([]);
            setSearched(true);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading, searched };
}

function SuggestDropdown({
  query,
  results,
  loading,
  searched,
  activeIdx,
  onPick,
}: {
  query: string;
  results: SuggestResult[];
  loading: boolean;
  searched: boolean;
  activeIdx: number;
  onPick: () => void;
}) {
  const trimmed = query.trim();
  if (trimmed.length < MIN_CHARS) return null;

  return (
    <div className="absolute left-0 right-0 top-full mt-2 rounded-md border border-border bg-bg-raised shadow-[0_16px_40px_rgba(0,0,0,0.14)] overflow-hidden z-50">
      {loading && results.length === 0 ? (
        <p className="px-4 py-4 text-sm text-text-tertiary">Searching…</p>
      ) : results.length > 0 ? (
        <ul className="m-0 p-1.5 list-none max-h-[70vh] overflow-y-auto">
          {results.map((r, i) => (
            <li key={r.id}>
              <Link
                href={`/product/${encodeURIComponent(r.slug)}?id=${r.id}`}
                onClick={onPick}
                className={cn(
                  "flex items-center gap-3 rounded-sm px-2.5 py-2 transition-colors",
                  activeIdx === i ? "bg-fill-subtle-15" : "hover:bg-fill-subtle-15",
                )}
              >
                <span className="relative w-11 h-11 shrink-0 rounded-sm overflow-hidden bg-bg border border-border">
                  {r.imageUrl ? (
                    <Image src={r.imageUrl} alt={r.name} fill className="object-contain p-1" sizes="44px" />
                  ) : null}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-text-primary truncate">
                    {r.name}
                  </span>
                  <span className="block text-xs text-text-tertiary truncate">
                    {[r.brandName, r.styleName].filter(Boolean).join(" · ")}
                    {r.priceFrom ? ` · ${r.priceFrom}` : ""}
                  </span>
                </span>
              </Link>
            </li>
          ))}
          <li className="border-t border-border mt-1 pt-1">
            <Link
              href={`/products?q=${encodeURIComponent(trimmed)}`}
              onClick={onPick}
              className="block px-2.5 py-2 text-sm font-bold text-accent hover:underline"
            >
              See all results for “{trimmed}”
            </Link>
          </li>
        </ul>
      ) : searched ? (
        <div className="px-4 py-4">
          <p className="text-sm font-bold text-text-primary m-0">
            No matches for “{trimmed}”
          </p>
          <p className="text-xs text-text-secondary mt-1 mb-0">
            Try a brand (Gildan, ATC), a style number, or a product type like
            “hoodie” or “polo”.
          </p>
          <Link
            href={`/products?q=${encodeURIComponent(trimmed)}`}
            onClick={onPick}
            className="inline-block mt-2 text-sm font-bold text-accent hover:underline"
          >
            Search the full catalog anyway →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

/** Persistent desktop search bar, rendered directly below the main nav row. */
export function HeaderSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { results, loading, searched } = useCatalogSuggest(open ? query : "");

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setOpen(false);
    router.push(`/products?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div ref={wrapRef} className="relative w-full max-w-[600px]">
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (activeIdx >= 0 && results[activeIdx]) {
            router.push(
              `/product/${encodeURIComponent(results[activeIdx].slug)}?id=${results[activeIdx].id}`,
            );
            setOpen(false);
            return;
          }
          submit(query);
        }}
      >
        <label htmlFor="header-search" className="sr-only">
          Search products
        </label>
        <div
          className={cn(
            "relative rounded-full border bg-bg-raised transition-all duration-med",
            open
              ? "border-accent shadow-[0_4px_16px_rgba(0,0,0,0.08)]"
              : "border-border shadow-[0_1px_2px_rgba(0,0,0,0.04)] hover:border-text-tertiary",
          )}
        >
          <Search
            size={17}
            strokeWidth={2.25}
            className={cn(
              "absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors",
              open ? "text-accent" : "text-text-tertiary",
            )}
          />
          <input
            id="header-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
              setActiveIdx(-1);
            }}
            onFocus={() => query.trim().length >= MIN_CHARS && setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, -1));
              } else if (e.key === "Escape") {
                setOpen(false);
              }
            }}
            placeholder="Search products, brands or categories"
            className="w-full h-11 bg-transparent rounded-full pl-11 pr-4 text-[15px] text-text-primary placeholder:text-text-tertiary outline-none"
          />
        </div>
      </form>
      {open && (
        <SuggestDropdown
          query={query}
          results={results}
          loading={loading}
          searched={searched}
          activeIdx={activeIdx}
          onPick={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/** Mobile: a search icon that expands into a full-width field with the same
 * predictive dropdown, rather than squeezing a persistent bar into the
 * already-tight mobile header. */
export function HeaderSearchMobile() {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { results, loading, searched } = useCatalogSuggest(expanded ? query : "");

  useEffect(() => {
    if (expanded) inputRef.current?.focus();
  }, [expanded]);

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed) return;
    setExpanded(false);
    router.push(`/products?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-label="Search"
        aria-expanded={expanded}
        className="w-10 h-10 rounded-md border border-border grid place-items-center hover:bg-fill-subtle-15 transition-colors"
      >
        {expanded ? <X size={18} /> : <Search size={18} />}
      </button>

      {expanded && (
        <div className="fixed left-0 right-0 top-[var(--header-offset)] z-50 bg-bg border-b border-border px-sp-4 py-sp-3 shadow-[0_16px_40px_rgba(0,0,0,0.14)]">
          <form
            role="search"
            onSubmit={(e) => {
              e.preventDefault();
              submit(query);
            }}
            className="relative"
          >
            <label htmlFor="header-search-mobile" className="sr-only">
              Search products
            </label>
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none"
            />
            <input
              ref={inputRef}
              id="header-search-mobile"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search products, brands, styles…"
              className="w-full min-h-11 border border-border rounded-full bg-bg-raised pl-9 pr-3.5 py-2.5 text-base text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
            />
          </form>
          <div className="relative">
            <SuggestDropdown
              query={query}
              results={results}
              loading={loading}
              searched={searched}
              activeIdx={-1}
              onPick={() => setExpanded(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}