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
  { path: "/start", priority: 0.6, frequency: "monthly" as const },
];

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
    const catalog = await loadStorefrontCatalog({ limit: 5000 });
    for (const product of catalog.products) {
      if (!product.available) continue;
      entries.push({
        url: `${siteUrl}/product/${encodeURIComponent(product.slug)}?id=${product.id}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 0.6,
      });
    }
  } catch {
    // Catalog unavailable — static + category routes above still get indexed.
  }

  return entries;
}
