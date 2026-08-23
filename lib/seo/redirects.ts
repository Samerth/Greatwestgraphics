import {
  LEFTOVER_REDIRECTS,
  PREFIX_REDIRECTS,
  matchPrefixRedirect,
} from "./leftovers";
import { canonicalizePath, withTrailingSlash } from "./paths";
import { isProtectedAppPath, isProtectedRedirectSource } from "./protected-paths";

/**
 * Section 2d — the only "-2" URLs that still have a live unsuffixed original.
 * Everything else on the "-2" list is the only live URL and must 200.
 */
const RETIRED: Record<string, string> = {
  "/promotional-products-burnaby-2": "/promotional-products-burnaby",
  "/safety-products-2": "/safety-products",
};

/**
 * Section 2c — old WooCommerce account/payment paths. Cart and checkout
 * already exist at the same slugs, so they are not redirected.
 */
const TRANSACTIONAL: Record<string, string> = {
  "/my-account": "/account",
  "/payment-confirmation": "/checkout",
  "/secure-payment": "/checkout",
  "/thank-you": "/account",
  "/my-wishlist": "/products",
  "/payment": "/checkout",
};

/** Section 2e — odd slugs that look like duplicates but are the only live URL. */
export const PRESERVED_ODD_SLUGS = [
  "/promotional-products-richmond-2",
  "/custom-embroidered-toques-surrey-2",
  "/screen-printed-custom-t-shirts-2",
  "/t-shirt-printing-2",
] as const;

const REDIRECTS: Record<string, string> = {
  ...RETIRED,
  ...TRANSACTIONAL,
  ...LEFTOVER_REDIRECTS,
};

export function resolveLegacyRedirect(path: string): string | null {
  const canonical = canonicalizePath(path);
  // Nested /faq/* rows are WordPress leftovers, not the live /faq page.
  if (isProtectedAppPath(canonical) && !canonical.startsWith("/faq/")) {
    return null;
  }
  if ((PRESERVED_ODD_SLUGS as readonly string[]).includes(canonical)) {
    return null;
  }
  return REDIRECTS[canonical] ?? matchPrefixRedirect(canonical);
}

export type SeoRedirect = {
  source: string;
  destination: string;
  statusCode: 301;
};

/** next.config `redirects()` entries. 301, not 308, per the migration spec. */
export function nextSeoRedirects(): SeoRedirect[] {
  const entries: SeoRedirect[] = [];
  for (const [from, to] of Object.entries(REDIRECTS)) {
    if (isProtectedRedirectSource(from)) continue;
    entries.push({ source: from, destination: to, statusCode: 301 });
    const slashed = withTrailingSlash(from);
    if (slashed !== from) {
      entries.push({
        source: slashed,
        destination: to,
        statusCode: 301,
      });
    }
  }
  for (const rule of PREFIX_REDIRECTS) {
    if (isProtectedRedirectSource(rule.source)) continue;
    entries.push({
      source: rule.source,
      destination: rule.destination,
      statusCode: 301,
    });
  }
  return entries;
}

export function retiredRedirects(): Record<string, string> {
  return { ...RETIRED };
}

export function transactionalRedirects(): Record<string, string> {
  return { ...TRANSACTIONAL };
}
