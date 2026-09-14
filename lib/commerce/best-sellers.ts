import type {
  StorefrontCatalogProduct,
  StorefrontCategory,
} from "./catalog";
import { categoryDisplayName } from "./category-label";

/**
 * The Best Sellers page, grouped by category (CodSphere UAT V2 row 68, and
 * Pavin on 11 September: "organise Best Sellers by category").
 *
 * Best Sellers is a real category in the catalogue, so which products appear
 * is already curated by staff assigning them to it — nothing new to manage.
 * What this adds is the arrangement: rather than one long undifferentiated
 * grid, the page reads "Best Sellers in Short Sleeve Shirts", "Best Sellers
 * in Hoodies", and so on, matching the reference the client supplied.
 */

export const BEST_SELLERS_SLUG = "best-sellers";

export const BEST_SELLERS_TITLE = "Great West Graphics Best Sellers";
export const BEST_SELLERS_BLURB =
  "Our most popular products, grouped by what you are shopping for. Updated as the catalogue changes.";

/** Products that could not be placed under any other category. */
export const BEST_SELLERS_OTHER = {
  slug: "more-best-sellers",
  name: "More Best Sellers",
} as const;

export type BestSellerSection = {
  /** Category slug, or `more-best-sellers` for the catch-all. */
  slug: string;
  name: string;
  /** Anchor target for the sidebar. */
  anchor: string;
  products: StorefrontCatalogProduct[];
};

export function bestSellerAnchor(slug: string): string {
  return `best-in-${slug}`;
}

/**
 * Groups best sellers under the most specific category each belongs to.
 *
 * "Most specific" matters: a tee is filed under both T-Shirts and Short
 * Sleeve Shirts, and the client's reference headings are the narrower of the
 * two. Grouping by the parent would collapse four useful sections into one.
 *
 * A product appears once, under a single heading, so the page reads as a
 * catalogue rather than as the same shirt repeated down the page.
 */
export function groupBestSellersByCategory(
  products: readonly StorefrontCatalogProduct[],
  categories: readonly StorefrontCategory[],
): BestSellerSection[] {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const byId = new Map(categories.map((category) => [category.id, category]));
  // A category with a parent is a subcategory, and is preferred as a heading.
  const isChild = (slug: string) => Boolean(bySlug.get(slug)?.parentId);

  // Section order follows the published taxonomy rather than how many
  // products happen to land in each, so the page does not reshuffle itself
  // every time staff tick a different product as a best seller.
  const order = new Map(categories.map((category, index) => [category.slug, index]));

  const sections = new Map<string, BestSellerSection>();

  for (const product of products) {
    const candidates = product.categorySlugs.filter(
      (slug) => slug !== BEST_SELLERS_SLUG && bySlug.has(slug),
    );
    const chosen =
      candidates.find(isChild) ?? candidates[0] ?? BEST_SELLERS_OTHER.slug;
    // "Women's T-Shirts", not "Women's": a subcategory heading carries its
    // department when its own name is only a qualifier (15 Sep).
    const category = bySlug.get(chosen);
    const parent = category?.parentId ? byId.get(category.parentId) : null;
    const name = category
      ? categoryDisplayName(category, parent)
      : chosen === BEST_SELLERS_OTHER.slug
        ? BEST_SELLERS_OTHER.name
        : chosen;

    const existing = sections.get(chosen);
    if (existing) {
      existing.products.push(product);
      continue;
    }
    sections.set(chosen, {
      slug: chosen,
      name,
      anchor: bestSellerAnchor(chosen),
      products: [product],
    });
  }

  return [...sections.values()].sort((a, b) => {
    // The catch-all always sits last; it is a remainder, not a department.
    if (a.slug === BEST_SELLERS_OTHER.slug) return 1;
    if (b.slug === BEST_SELLERS_OTHER.slug) return -1;
    const left = order.get(a.slug) ?? Number.MAX_SAFE_INTEGER;
    const right = order.get(b.slug) ?? Number.MAX_SAFE_INTEGER;
    return left - right || a.name.localeCompare(b.name);
  });
}

/** "Best Sellers in Hoodies" — the heading the client's reference uses. */
export function bestSellerSectionHeading(section: {
  name: string;
  slug: string;
}): string {
  if (section.slug === BEST_SELLERS_OTHER.slug) return section.name;
  return `Best Sellers in ${section.name}`;
}

/**
 * Where "View All" goes. The catch-all has no category of its own to open,
 * so it links back to the unfiltered catalogue rather than to a dead filter.
 */
export function bestSellerViewAllHref(section: { slug: string }): string {
  if (section.slug === BEST_SELLERS_OTHER.slug) return "/products";
  return `/products?category=${encodeURIComponent(section.slug)}`;
}
