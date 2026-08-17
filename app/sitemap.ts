import type { MetadataRoute } from "next";
import { resolveStoreContext } from "@/lib/commerce/store-context";
import { loadStorefrontCatalog, loadStorefrontCategories } from "@/lib/commerce/catalog";

const STATIC_ROUTES = [
  { path: "/", priority: 1, frequency: "daily" as const },
  { path: "/products", priority: 0.9, frequency: "daily" as const },
  { path: "/quote", priority: 0.8, frequency: "weekly" as const },
  { path: "/design", priority: 0.8, frequency: "weekly" as const },
  { path: "/contact", priority: 0.5, frequency: "monthly" as const },
  { path: "/about", priority: 0.5, frequency: "monthly" as const },
  { path: "/faq", priority: 0.5, frequency: "monthly" as const },
  { path: "/shipping", priority: 0.4, frequency: "monthly" as const },
  { path: "/privacy", priority: 0.3, frequency: "yearly" as const },
  { path: "/start", priority: 0.6, frequency: "monthly" as const },
];

/**
 * Building this walks the entire catalogue, which at the API's 500-row page
 * cap is around twenty sequential round trips for a 10,100-product catalogue.
 * That is fine hourly and not fine per request: crawlers and uptime checks hit
 * /sitemap.xml often enough that recomputing it each time would spend real
 * database capacity on a document that changes only when the vendor sync runs.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const store = await resolveStoreContext().catch(() => null);
  const isBrandedStore = Boolean(store?.accentColor || store?.logoUrl);

  // Matches robots.ts: branded corporate stores stay out of search entirely
  // until they have their own custom domain, so their sitemap is empty.
  if (isBrandedStore) return [];

  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified: now,
    changeFrequency: route.frequency,
    priority: route.priority,
  }));

  try {
    const categories = await loadStorefrontCategories();
    for (const category of categories) {
      entries.push({
        url: `${siteUrl}/products?category=${encodeURIComponent(category.slug)}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.7,
      });
    }
  } catch {
    // Categories unavailable — static routes above still get indexed.
  }

  try {
    // Walked a page at a time rather than asked for in one call. A single
    // request for the whole catalogue used to cap the sitemap at 5,000
    // products, which silently hid about half of a 10,100-product catalogue
    // from search, and the API now refuses pages that large anyway.
    //
    // The ceiling is a runaway guard, not a target: it sits well above the
    // catalogue and above the sitemap protocol's own 50,000-URL limit, so a
    // pagination bug cannot spin here forever.
    const PAGE_SIZE = 500;
    const MAX_PRODUCT_URLS = 50_000;

    for (let page = 1; entries.length < MAX_PRODUCT_URLS; page += 1) {
      // loadStorefrontCatalog uses the storefront-only listing, so rows a
      // staff member has hidden never arrive here and cannot leak into the
      // sitemap. Everything that does arrive is browsable on /products.
      //
      // Out-of-stock colourways used to be skipped, and that is what left the
      // sitemap listing 4,895 URLs against a 10,100-product catalogue. They
      // are not hidden from shoppers: the listing shows them behind an "Out
      // of Stock" badge, and their detail pages render in full with
      // schema.org/OutOfStock in the product markup. Google's guidance is to
      // submit those and let availability markup speak for itself, which is
      // also the only stable option here — stock counts move with every
      // vendor sync, so filtering on them would add and drop thousands of
      // URLs an hour and teach crawlers that this document is noise.
      const catalog = await loadStorefrontCatalog({ limit: PAGE_SIZE, page });
      for (const product of catalog.products) {
        entries.push({
          url: `${siteUrl}/product/${encodeURIComponent(product.slug)}?id=${product.id}`,
          lastModified: now,
          changeFrequency: "weekly",
          // In-stock lines are the ones worth crawling first. Priority is a
          // hint rather than a filter, which is the right strength for a
          // signal that flips on the next inventory sync.
          priority: product.available ? 0.6 : 0.4,
        });
      }
      // A short page means the catalogue is exhausted. Checking the returned
      // length rather than pageCount also stops the loop if a page comes back
      // empty, which is what an out-of-range request degrades to.
      if (catalog.products.length < PAGE_SIZE) break;
    }
  } catch {
    // Catalog unavailable — static + category routes above still get indexed.
  }

  return entries;
}
