import { CONTENT_PAGES } from "./content-pages";
import { LEFTOVER_REDIRECTS } from "./leftovers";
import { LOCATION_PAGES } from "./location-pages";
import { canonicalizePath } from "./paths";
import { isProtectedAppPath } from "./protected-paths";
import { resolveLegacyRedirect } from "./redirects";

const FALLBACK = "/services";

const CITY_SLUGS = [...new Set(LOCATION_PAGES.map((page) => page.citySlug))].sort(
  (a, b) => b.length - a.length,
);

function tokens(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []);
}

function scorePath(from: string, candidatePath: string, extra = ""): number {
  const source = tokens(from);
  const dest = tokens(`${candidatePath} ${extra}`);
  let score = 0;
  for (const token of source) {
    if (dest.has(token)) score += 1;
  }
  return score;
}

/**
 * Permanent destination for an inventoried URL that we are not keeping as
 * its own page. Never returns "/" — leftover traffic goes to a relevant
 * service or city page, not a homepage dump.
 */
export function closestRelevantPath(path: string): string {
  const canonical = canonicalizePath(path);
  if (canonical === "/") return FALLBACK;

  // Nested WP FAQ rows sit under /faq/... — leftover aliases, not the live
  // /faq page. Resolve them before the protected-path guard.
  if (canonical.startsWith("/faq/") && canonical !== "/faq") return "/faqs";

  // Never invent a destination for a live commerce route.
  if (isProtectedAppPath(canonical)) return canonical;

  const knownRedirect = resolveLegacyRedirect(canonical);
  if (knownRedirect) return knownRedirect;

  const leftover = LEFTOVER_REDIRECTS[canonical];
  if (leftover) return leftover;
  if (
    canonical.startsWith("/product-category") ||
    canonical.startsWith("/product-tag")
  ) {
    return "/products";
  }
  if (canonical.startsWith("/tag/")) {
    return "/blogs-screen-printing";
  }
  if (canonical.startsWith("/slider/")) return "/rush-t-shirts-printing";
  if (canonical.startsWith("/pd_template/")) return "/custom-t-shirts";
  if (canonical.startsWith("/author/")) return "/about-us-great-west-graphics";

  const matchedCities = CITY_SLUGS.filter((city) =>
    canonical.includes(city),
  );
  const locationPool =
    matchedCities.length > 0
      ? LOCATION_PAGES.filter((page) => matchedCities.includes(page.citySlug))
      : LOCATION_PAGES;

  let bestPath = FALLBACK;
  let bestScore = 0;

  for (const page of locationPool) {
    const score = scorePath(
      canonical,
      page.path,
      `${page.city} ${page.citySlug} ${page.service} ${page.kind}`,
    );
    if (score > bestScore) {
      bestScore = score;
      bestPath = page.path;
    }
  }

  for (const page of CONTENT_PAGES) {
    if (page.indexable === false) continue;
    const score = scorePath(
      canonical,
      page.path,
      `${page.service ?? ""} ${page.h1}`,
    );
    if (score > bestScore) {
      bestScore = score;
      bestPath = page.path;
    }
  }

  return bestPath === "/" ? FALLBACK : bestPath;
}
