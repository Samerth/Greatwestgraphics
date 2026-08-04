/**
 * Generate a size chart key from style data.
 * Used to look up the correct size chart for a garment.
 */
export function getSizeChartKey(brandName?: string, styleName?: string): string | null {
  if (!brandName || !styleName) return null;

  // Convert to kebab-case for consistency with JSON keys
  const brand = brandName.toLowerCase().replace(/\s+/g, "-");
  const style = styleName
    .toLowerCase()
    .replace(/[^\w\s-]/g, "") // Remove special chars
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-"); // Collapse multiple dashes

  return `${brand}-${style}`;
}

/**
 * Check if a size chart exists for the given style.
 */
export function hasSizeChart(key: string | null): boolean {
  if (!key) return false;

  // List of styles that have size charts
  const chartsAvailable = ["adidas-a2009", "adidas-a2020", "gildan-18500"];

  return chartsAvailable.includes(key);
}
