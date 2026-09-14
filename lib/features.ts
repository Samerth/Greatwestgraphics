/**
 * Shopper-facing feature switches. Engines and routes stay in the repo.
 * Flip a flag to restore the public UI without resurrecting deleted code.
 */
export const SHOW_PUBLIC_QUOTE_CALCULATOR = false;
/**
 * Branded per-client storefronts — the team store / web store feature served
 * at `/s/<slug>`.
 *
 * Off for the first deployment. UAT row 51 asks for the existing team store to
 * be disabled in the interim, and row 52 replaces it with a different design
 * altogether, so nothing customer-facing should reference it in the meantime.
 *
 * Every route, component, API handler and database table stays exactly where
 * it is — this hides the feature, it does not remove it. Turning the flag back
 * on restores the whole thing, which is what makes the rebuild in row 52 a
 * decision rather than a salvage job.
 */
export const SHOW_TEAM_STORES = false;
/** Experimental FLUX identity try-out — not print-ready. */
export const SHOW_DESIGN_STUDIO_AI_CONCEPT = true;

const PUBLIC_QUOTE_PATHS = new Set(["/quote", "/get-a-quote"]);

/** True when `href` is the public quote calculator (with or without query). */
export function isPublicQuotePath(href: string): boolean {
  const path = href.split("?")[0].replace(/\/+$/, "") || "/";
  return PUBLIC_QUOTE_PATHS.has(path);
}

export function withoutPublicQuoteLinks<T extends { href?: string; path?: string }>(
  items: T[],
): T[] {
  if (SHOW_PUBLIC_QUOTE_CALCULATOR) return items;
  return items.filter((item) => {
    const target = item.href ?? item.path ?? "";
    return !isPublicQuotePath(target);
  });
}

/** Service tiles used to deep-link the calculator; keep them on live pages. */
export function publicPrintMethodHref(
  method: "embroidery" | "screen" | "dtf" | "sublimation",
): string {
  if (SHOW_PUBLIC_QUOTE_CALCULATOR) {
    return `/quote?method=${method}`;
  }
  if (method === "embroidery") return "/decoration-processes/embroidery";
  if (method === "screen") return "/decoration-processes/custom-screen-printing";
  return "/services";
}

export function publicQuoteOrFallback(fallback: string): string {
  return SHOW_PUBLIC_QUOTE_CALCULATOR ? "/quote" : fallback;
}
