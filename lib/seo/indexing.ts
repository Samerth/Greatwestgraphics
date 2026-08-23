import type { Metadata } from "next";

/**
 * The spec forbids a publicly crawlable new build alongside WordPress.
 * Indexing stays off until launch sets SEO_ALLOW_INDEX=true (same moment
 * DNS cuts over and the new sitemap is submitted).
 */
export function allowSearchIndexing(): boolean {
  return process.env.SEO_ALLOW_INDEX === "true";
}

export function publicRobots(indexable = true): Metadata["robots"] {
  if (!allowSearchIndexing() || !indexable) {
    return { index: false, follow: true };
  }
  return { index: true, follow: true };
}
