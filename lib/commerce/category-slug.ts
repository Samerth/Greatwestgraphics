/** Match `?category=` without depending on the casing the URL or DB stored. */
export function resolveCategoryId(
  categories: { id: string; slug: string }[],
  categorySlug?: string | null,
): string | undefined {
  const wanted = categorySlug?.trim().toLowerCase();
  if (!wanted) return undefined;
  return categories.find((c) => c.slug.toLowerCase() === wanted)?.id;
}

/**
 * Drop the currently-active subcategory from a sidebar filter list.
 *
 * A shopper who has navigated into T-Shirts → Short Sleeve is already
 * filtered to that subcategory — showing "Short Sleeve" again as a checkbox
 * beside Heavyweight/Organic/etc. is redundant and reads as if it were just
 * another optional attribute (CodSphere UAT V2). Every other sibling filter
 * stays untouched.
 */
export function visibleChildCategories<T extends { slug: string }>(
  children: T[],
  activeCategorySlug: string,
): T[] {
  const active = activeCategorySlug.trim().toLowerCase();
  if (!active) return children;
  return children.filter((c) => c.slug.toLowerCase() !== active);
}
