import { cache } from "react";
import { CommerceApiError, createCommerceClient } from "@/lib/commerce/client";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

/**
 * Next signals control flow by throwing: notFound() and redirect() raise
 * errors tagged NEXT_NOT_FOUND / NEXT_REDIRECT, and the static-render probe
 * raises DYNAMIC_SERVER_USAGE when a route touches cookies or headers. None of
 * those are commerce API failures, and catching them here does two kinds of
 * damage — it reports a catalogue outage that is not happening (eleven of them
 * on every production build, which is exactly the false alarm this logging
 * exists to avoid), and it eats the signal Next needs to mark a route dynamic.
 *
 * Matched on the digest rather than an instanceof, because the error classes
 * live behind internal import paths that move between Next releases.
 */
function isFrameworkControlFlow(caught: unknown): boolean {
  const digest = (caught as { digest?: unknown } | null)?.digest;
  return (
    typeof digest === "string" &&
    (digest.startsWith("NEXT_") || digest === "DYNAMIC_SERVER_USAGE")
  );
}

export type StorefrontCatalogProduct = {
  id: string;
  slug: string;
  name: string;
  brandName: string;
  styleName: string;
  /** Manufacturer's descriptive name, e.g. "Men's Ultimate365 Elevated Hoodie". */
  title: string | null;
  colorName: string;
  categorySlugs: string[];
  retailMinor: number;
  costMinor: number;
  isDark: boolean;
  available: boolean;
  imageUrl: string | null;
  priceFrom: string;
};

export type StorefrontCategory = {
  id: string;
  name: string;
  slug: string;
};

export type StorefrontFilters = {
  /** Free-text query matched against brand, style, colour and slug. */
  search?: string;
  categorySlug?: string;
  limit?: number;
  /** 1-indexed. */
  page?: number;
  brands?: string[];
  priceMinMinor?: number;
  priceMaxMinor?: number;
};

export async function loadStorefrontCatalog(options?: StorefrontFilters): Promise<{
  products: StorefrontCatalogProduct[];
  categories: StorefrontCategory[];
  brands: string[];
  /** "error" means the commerce API call itself failed (network, timeout,
   * Supabase pool exhaustion, etc) — distinct from "empty", a real zero-
   * result query. Callers should show a "having trouble" message for
   * "error", not the generic "no matches" copy. */
  source: "db" | "empty" | "error";
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
}> {
  const limit = options?.limit ?? 120;
  const page = Math.max(1, options?.page ?? 1);
  const offset = (page - 1) * limit;

  try {
    const client = (await createCommerceClient());
    const [categoriesRaw, categoriesWithProductsRaw, brands] = await Promise.all([
      client.listCategories(),
      client.listCategories(undefined, true),
      client.listBrands(),
    ]);

    // Slug resolution uses the FULL (unfiltered) list so a direct URL to an
    // empty category (e.g. ?category=drinkware) still correctly resolves to
    // that category and returns 0 results, rather than silently falling
    // back to the entire unfiltered catalog.
    const allCategories: StorefrontCategory[] = categoriesRaw.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
    }));

    // The chips shown to the user only list categories that actually have
    // products, so browsing never dead-ends on an empty filter.
    const categories: StorefrontCategory[] = categoriesWithProductsRaw.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
    }));

    const categoryId =
      options?.categorySlug &&
      allCategories.find((c) => c.slug === options.categorySlug)?.id;

    // A category slug was requested but didn't resolve to a real category
    // — most likely a stale cached category list (categories.listCategories
    // revalidates every 5 minutes) right after one was added/removed, or a
    // stale bookmark to a renamed/deleted category. Either way, silently
    // querying with no category filter would show the ENTIRE unfiltered
    // catalog under a specific category's URL, which is worse than an
    // honest empty result.
    if (options?.categorySlug && !categoryId) {
      return {
        products: [],
        categories,
        brands,
        source: "empty",
        total: 0,
        page,
        pageSize: limit,
        pageCount: 0,
      };
    }

    const { products: filtered, total } = await client.listCatalogProducts({
      search: options?.search,
      categoryId: categoryId || undefined,
      limit,
      offset,
      brands: options?.brands,
      priceMinMinor: options?.priceMinMinor,
      priceMaxMinor: options?.priceMaxMinor,
    });

    if (filtered.length === 0 && total === 0) {
      return {
        products: [],
        categories,
        brands,
        source: "empty",
        total: 0,
        page,
        pageSize: limit,
        pageCount: 0,
      };
    }

    const products: StorefrontCatalogProduct[] = filtered.map((row) => {
      const retailMinor = Number(row.retailMinor || 0);
      const available = Boolean(row.available);
      return {
        id: String(row.id),
        slug: String(row.slug || row.id),
        name: `${row.brandName || ""} ${row.styleName || row.title || ""}`.trim(),
        brandName: String(row.brandName || ""),
        styleName: String(row.styleName || ""),
        title: (row.title as string | null) || null,
        colorName: String(row.colorName || ""),
        categorySlugs: [],
        retailMinor,
        costMinor: Number(row.costMinor || 0),
        isDark: Boolean(row.isDark),
        available,
        imageUrl:
          (row.colorFrontImageUrl as string | null) ||
          (row.styleImageUrl as string | null) ||
          null,
        priceFrom: available
          ? `from ${moneyFromMinor(retailMinor)}`
          : "Unavailable",
      };
    });

    return {
      products,
      categories,
      brands,
      source: "db",
      total,
      page,
      pageSize: limit,
      pageCount: Math.max(1, Math.ceil(total / limit)),
    };
  } catch (caught) {
    if (isFrameworkControlFlow(caught)) throw caught;
    // Single-line, prefixed and greppable so a catalogue outage is findable in
    // CloudWatch Logs Insights rather than buried in a stack trace. The
    // storefront no longer papers over this with demo products, so this log is
    // the only place an outage is recorded before the customer sees it.
     
    console.error(
      "[storefront] CATALOG_UNAVAILABLE loadStorefrontCatalog failed",
      JSON.stringify({
        page,
        limit,
        search: options?.search ?? null,
        categorySlug: options?.categorySlug ?? null,
        status: caught instanceof CommerceApiError ? caught.status : null,
        message: caught instanceof Error ? caught.message : String(caught),
      }),
    );
    return {
      products: [],
      categories: [],
      brands: [],
      source: "error",
      total: 0,
      page,
      pageSize: limit,
      pageCount: 0,
    };
  }
}

/** Real catalog products shaped for `CrossSellGrid` — real photos instead
 * of the static demo catalog's gradient placeholder tiles. */
export function toCrossSellItems(
  products: StorefrontCatalogProduct[],
  limit = 3,
) {
  const seenStyles = new Set<string>();
  return products
    .filter((p) => {
      if (!p.available || !p.imageUrl) return false;
      const styleKey = `${p.brandName}::${p.styleName}`;
      if (seenStyles.has(styleKey)) return false;
      seenStyles.add(styleKey);
      return true;
    })
    .slice(0, limit)
    .map((p, index) => ({
      slug: p.slug,
      name: p.name,
      meta: `${p.colorName} · ${p.priceFrom}`,
      artIndex: index + 1,
      imageUrl: p.imageUrl,
      href: `/product/${encodeURIComponent(p.slug)}?id=${p.id}`,
    }));
}

/** Defaults to onlyWithProducts so sitewide nav (Header dropdown, Footer
 * "Shop" column) never advertises a category with zero browsable inventory
 * (e.g. Drinkware/Technology, which GWG offers via custom quote but doesn't
 * carry in the synced online catalog yet). Pass `false` when resolving a
 * category slug to its display name regardless of current inventory (e.g.
 * page metadata for a direct link to an empty category). */
export async function loadStorefrontCategories(
  onlyWithProducts = true,
): Promise<StorefrontCategory[]> {
  try {
    const categoriesRaw = await (await createCommerceClient()).listCategories(
      undefined,
      onlyWithProducts,
    );
    return categoriesRaw.map((row) => ({
      id: String(row.id),
      name: String(row.name),
      slug: String(row.slug),
    }));
  } catch (caught) {
    if (isFrameworkControlFlow(caught)) throw caught;
    // Returning [] is the right call — the header and footer degrade to their
    // own fallbacks rather than breaking every page — but it used to happen in
    // total silence, so a category outage was invisible until someone noticed
    // the nav had gone quiet.
     
    console.error(
      "[storefront] CATEGORIES_UNAVAILABLE loadStorefrontCategories failed",
      JSON.stringify({
        onlyWithProducts,
        status: caught instanceof CommerceApiError ? caught.status : null,
        message: caught instanceof Error ? caught.message : String(caught),
      }),
    );
    return [];
  }
}

/**
 * "missing" and "unavailable" are deliberately separate.
 *
 * This loader used to return null for both, so a commerce API outage made
 * every product page answer "Page not found" — the worst reply available. It
 * tells a shopper the product does not exist and tells a crawler to deindex
 * the URL, and both of those outlive the outage that caused them.
 *
 * Callers decide what to do, rather than the distinction being thrown away
 * here: rendering turns "unavailable" into a real error so the visitor gets
 * the retry boundary, while metadata generation ignores it, because a missing
 * <title> is not worth failing a page over.
 */
export type StorefrontProductResult =
  | { kind: "found"; detail: Awaited<ReturnType<CommerceClient["getCatalogProduct"]>> }
  | { kind: "missing" }
  | { kind: "unavailable"; error: unknown };

type CommerceClient = Awaited<ReturnType<typeof createCommerceClient>>;

export const loadStorefrontProduct = cache(
  async (productId: string): Promise<StorefrontProductResult> => {
    try {
      const detail = await (
        await createCommerceClient()
      ).getCatalogProduct(productId);
      return detail ? { kind: "found", detail } : { kind: "missing" };
    } catch (caught) {
      if (isFrameworkControlFlow(caught)) throw caught;
      const status = caught instanceof CommerceApiError ? caught.status : null;
      if (status === 404) return { kind: "missing" };

       
      console.error(
        "[storefront] PRODUCT_UNAVAILABLE loadStorefrontProduct failed",
        JSON.stringify({
          productId,
          status,
          message: caught instanceof Error ? caught.message : String(caught),
        }),
      );
      return { kind: "unavailable", error: caught };
    }
  },
);
