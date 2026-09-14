/**
 * The published taxonomy names product types in the plural ("Crewnecks",
 * "Sweatpants", "Quarter Zips", "Teamwear") and qualifiers in the singular
 * ("Youth", "Women's", "Long Sleeve", "Performance"). A qualifier only makes
 * sense next to its department: a heading that says "Women's" or "Long
 * Sleeve" does not say women's *what*.
 *
 * Shared by the brand pages and the Best Sellers page so both say "Women's
 * T-Shirts" rather than "Women's".
 */
export function categoryStandsAlone(name: string): boolean {
  return /[^'’](?:s|wear|ware)$/i.test(name.trim());
}

/** "Long Sleeve T-Shirts", "Crewnecks", "T-Shirts". */
export function categoryDisplayName(
  category: { name: string; parentId: string | null },
  parent?: { name: string } | null,
): string {
  const name = category.name.trim();
  if (!category.parentId || !parent || categoryStandsAlone(name)) return name;
  return `${name} ${parent.name.trim()}`;
}
