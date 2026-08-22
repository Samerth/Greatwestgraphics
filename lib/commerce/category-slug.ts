/** Match `?category=` without depending on the casing the URL or DB stored. */
export function resolveCategoryId(
  categories: { id: string; slug: string }[],
  categorySlug?: string | null,
): string | undefined {
  const wanted = categorySlug?.trim().toLowerCase();
  if (!wanted) return undefined;
  return categories.find((c) => c.slug.toLowerCase() === wanted)?.id;
}
