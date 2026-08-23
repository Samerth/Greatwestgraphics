import { canonicalizePath } from "./paths";
import { CONTENT_PAGES, getContentPage } from "./content-pages";
import { getLocationPage, LOCATION_PAGES } from "./location-pages";
import { resolveLegacyRedirect } from "./redirects";

export type LegacyRoute =
  | { type: "home" }
  | { type: "redirect"; to: string }
  | { type: "location"; path: string }
  | { type: "content"; path: string }
  | { type: "existing"; path: string }
  | { type: "missing" };

/**
 * Transactional URLs the new commerce app already serves at the same path.
 * The other six WooCommerce paths are redirects (see redirects.ts).
 */
export const EXISTING_TRANSACTIONAL_PATHS = ["/cart", "/checkout"] as const;

export function resolveLegacyRoute(path: string): LegacyRoute {
  const canonical = canonicalizePath(path);
  if (canonical === "/") return { type: "home" };

  const to = resolveLegacyRedirect(canonical);
  if (to) return { type: "redirect", to };

  if (
    (EXISTING_TRANSACTIONAL_PATHS as readonly string[]).includes(canonical)
  ) {
    return { type: "existing", path: canonical };
  }

  if (getLocationPage(canonical)) {
    return { type: "location", path: canonical };
  }

  if (getContentPage(canonical)) {
    return { type: "content", path: canonical };
  }

  return { type: "missing" };
}

export function sitemapLegacyPaths(): string[] {
  const paths = new Set<string>(LOCATION_PAGES.map((page) => page.path));
  for (const page of CONTENT_PAGES) {
    if (page.indexable === false) continue;
    paths.add(page.canonicalPath ?? page.path);
  }
  return [...paths].sort();
}

export function catchAllStaticPaths(): string[] {
  const reuse = new Set(
    CONTENT_PAGES.filter((page) => page.mode === "reuse").map((page) =>
      canonicalizePath(page.path),
    ),
  );
  return [
    ...LOCATION_PAGES.map((page) => page.path),
    ...CONTENT_PAGES.filter(
      (page) => !reuse.has(canonicalizePath(page.path)),
    ).map((page) => page.path),
  ];
}
