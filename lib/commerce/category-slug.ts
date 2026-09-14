/** Match `?category=` without depending on the casing the URL or DB stored. */
export function resolveCategoryId(
  categories: { id: string; slug: string }[],
  categorySlug?: string | null,
): string | undefined {
  const wanted = categorySlug?.trim().toLowerCase();
  if (!wanted) return undefined;
  return categories.find((c) => c.slug.toLowerCase() === wanted)?.id;
}

/** The sidebar's "no category" sentinel — `navigate()` drops the query param. */
export const ALL_CATEGORIES = "All";

/**
 * Is this sidebar row the category currently being browsed?
 *
 * Slug casing is not consistent between the URL, the DB and the nav tree, so
 * every comparison goes through here rather than `===`.
 */
export function isCategoryActive(
  slug: string,
  activeCategorySlug: string,
): boolean {
  const active = activeCategorySlug.trim().toLowerCase();
  if (!active) return false;
  return slug.trim().toLowerCase() === active;
}

/**
 * Where a sidebar checkbox should navigate when clicked.
 *
 * An earlier pass hid the active subcategory from its own sibling list, on
 * the grounds that filtering to Short Sleeve and *also* offering Short Sleeve
 * as a checkbox was redundant. In use that read as a bug — the shopper ticks
 * "Heavyweight" and watches it vanish from the list, with no way to untick it
 * (CodSphere UAT V2 row 66, reported against that very change). So the row now
 * stays put and stays ticked, and clicking it again clears it.
 *
 * Clearing steps *up* to `parentSlug` rather than jumping to All, so leaving
 * T-Shirts → Heavyweight lands on T-Shirts and keeps the shopper's place.
 * Departments pass no parent and therefore clear to All.
 */
export function categoryToggleTarget(
  slug: string,
  activeCategorySlug: string,
  parentSlug?: string,
): string {
  if (!isCategoryActive(slug, activeCategorySlug)) return slug;
  return parentSlug ?? ALL_CATEGORIES;
}
