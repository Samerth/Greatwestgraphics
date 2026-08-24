/** Shop-card subtitle: brand, plus a real colourway count when the style has more than one. */
export function catalogCardSubtitle(product: {
  brandName: string;
  colorwayCount?: number | null;
}): string {
  const brand = product.brandName.trim();
  const count = product.colorwayCount ?? 1;
  if (count > 1) {
    return brand ? `${brand} · ${count} colours` : `${count} colours`;
  }
  return brand;
}
