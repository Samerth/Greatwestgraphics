import type { Metadata } from "next";

/**
 * The spec forbids a publicly crawlable new build alongside WordPress.
 * Indexing stays off until launch sets SEO_ALLOW_INDEX=true (same moment
 * DNS cuts over and the new sitemap is submitted).
 */
export function allowSearchIndexing(): boolean {
  if (process.env.SEO_ALLOW_INDEX !== "true") return false;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
  // Staging hostnames stay closed even if someone flips the launch flag early.
  if (/staging|localhost|127\.0\.0\.1/i.test(siteUrl)) return false;
  return true;
}

export function publicRobots(indexable = true): Metadata["robots"] {
  if (!allowSearchIndexing() || !indexable) {
    return { index: false, follow: true };
  }
  return { index: true, follow: true };
}
