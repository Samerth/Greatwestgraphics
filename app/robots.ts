import type { MetadataRoute } from "next";
import { resolveStoreContext } from "@/lib/commerce/store-context";
import { allowSearchIndexing } from "@/lib/seo/indexing";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const store = await resolveStoreContext().catch(() => null);
  const isBrandedStore = Boolean(store?.accentColor || store?.logoUrl);

  // Branded corporate stores aren't indexed until they have their own custom
  // domain — dozens of subdomains all serving the same underlying catalog
  // would read to search engines as duplicate content and could suppress
  // ranking for every one of them, including the primary GWG site.
  //
  // The migration spec also requires the new build to stay closed to crawlers
  // until the WordPress cutover (SEO_ALLOW_INDEX=true).
  if (isBrandedStore || !allowSearchIndexing()) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/portal", "/account", "/invite", "/cart", "/checkout"],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
