import type { BrandCategory, BrandOverview } from "@gwg/contracts";
import { BEST_SELLERS_SLUG } from "./best-sellers";
import { categoryDisplayName } from "./category-label";

/**
 * Brand landing pages (UAT V2 row 62, second pass on 15 Sep).
 *
 * The first pass made Brands a dropdown, but every brand link landed on the
 * full catalogue with the brand ticked in the sidebar and "Shop All Products"
 * as the heading. The reference the client pointed at (coastalreign.com/
 * custom-products/brands/custom-gildan) gives each brand a page of its own:
 * a title, a tile per product type, and a "view all" leading to a listing
 * that still knows which brand it is showing.
 *
 * What is deliberately better here than the reference: the tiles are the
 * brand's *departments* (T-Shirts, Hoodies & Sweatshirts, Polos...) with the
 * subcategories listed inside each tile and a style count on both, so the
 * whole shape of a brand's range is visible at once and a shopper can go
 * straight to "Gildan long-sleeve tees" without a detour through T-Shirts.
 * Everything is derived from the catalogue, so nothing is curated by hand
 * and nothing goes stale.
 */

export type BrandDepartment = BrandCategory & {
  /** Subcategories of this department that hold at least one of the
   * brand's styles, largest first. */
  children: BrandCategory[];
};

/** Categories that are groupings of other things rather than product types
 * and so make poor tiles on a brand page. Best Sellers is a real category
 * but "Gildan Best Sellers" beside "Gildan T-Shirts" reads as a second copy
 * of the same shirts, so it feeds the popular row instead. */
const NOT_A_DEPARTMENT = new Set<string>([BEST_SELLERS_SLUG]);

/**
 * Departments (top-level categories) that hold the brand's styles, each with
 * its non-empty subcategories. Ordered by how many styles they hold, so the
 * tile a shopper most likely wants is first, not whichever department the
 * taxonomy happens to list first.
 */
export function brandDepartments(categories: readonly BrandCategory[]): BrandDepartment[] {
  const departments = categories.filter(
    (category) => !category.parentId && !NOT_A_DEPARTMENT.has(category.slug),
  );
  return departments
    .map((department) => ({
      ...department,
      children: categories
        .filter((category) => category.parentId === department.id)
        .sort((a, b) => b.styleCount - a.styleCount || a.name.localeCompare(b.name)),
    }))
    .sort((a, b) => b.styleCount - a.styleCount || a.name.localeCompare(b.name));
}

/** `/brands/gildan` */
export function brandPageHref(brand: { slug: string }): string {
  return `/brands/${encodeURIComponent(brand.slug)}`;
}

/**
 * The listing for a brand, optionally narrowed to one category. This is the
 * existing catalogue page with its existing filters — the brand page is a
 * front door to it, not a second catalogue.
 */
export function brandListingHref(
  brand: { name: string },
  categorySlug?: string | null,
): string {
  const params = new URLSearchParams();
  params.set("brand", brand.name);
  if (categorySlug) params.set("category", categorySlug);
  return `/products?${params.toString()}`;
}

/** "Custom Gildan" — the page title and the listing heading. */
export function brandHeading(brand: { name: string }): string {
  return `Custom ${brand.name}`;
}

/**
 * "Gildan Long Sleeve T-Shirts", "Gildan Crewnecks", "Gildan T-Shirts" -
 * see `categoryDisplayName` for why a qualifier carries its department.
 */
export function brandCategoryLabel(
  brand: { name: string },
  category: { name: string; parentId: string | null },
  parent?: { name: string } | null,
): string {
  return `${brand.name} ${categoryDisplayName(category, parent)}`;
}

/** "73 styles" / "1 style" */
export function styleCountLabel(count: number): string {
  return `${count.toLocaleString()} ${count === 1 ? "style" : "styles"}`;
}

/**
 * The page's own description of the brand, built from what the catalogue
 * holds rather than from marketing copy nobody maintains: "73 styles across
 * T-Shirts, Hoodies & Sweatshirts, Pants & Shorts and 4 more."
 */
export function brandBlurb(brand: BrandOverview): string {
  const departments = brandDepartments(brand.categories);
  const names = departments.map((department) => department.name);
  const lead = names.slice(0, 3);
  const rest = names.length - lead.length;
  const where =
    lead.length === 0
      ? ""
      : ` across ${lead.join(", ")}${rest > 0 ? ` and ${rest} more` : ""}`;
  return `${styleCountLabel(brand.styleCount)}${where}, screen printed or embroidered in Vancouver.`;
}
