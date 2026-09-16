import type { MetadataRoute } from "next";
import { resolveStoreContext } from "@/lib/commerce/store-context";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";
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
    return {
      rules: [
        // The one crawler that is still welcome while the site is closed to
        // search: CodChat's knowledge-base importer, which is how the
        // assistant learns this site's own answers. Without this it reads the
        // `*` group, refuses, and the only content it can be taught is the old
        // WordPress site - which is exactly the fault the 15 Sep test found
        // (drop shipping offered, published hours and shipping unknown).
        //
        // Their matcher takes the most specific user-agent group whose token
        // the crawler string contains, so this group beats the `*` group for
        // CodChatKnowledgeBot and for nobody else. Search engines still read
        // the blanket Disallow below.
        { userAgent: "CodChatKnowledgeBot", allow: "/" },
        { userAgent: "*", disallow: "/" },
      ],
    };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/api",
          "/portal",
          "/account",
          "/invite",
          "/cart",
          "/checkout",
          ...(SHOW_PUBLIC_QUOTE_CALCULATOR ? [] : ["/quote", "/get-a-quote"]),
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
