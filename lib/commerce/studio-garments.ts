export type StudioGarmentFields = {
  id: string;
  label: string;
  colorName: string;
  brandName?: string;
  styleName?: string;
};

export type StudioArticleOption = {
  key: string;
  label: string;
  representativeId: string;
};

export type StudioColorwayOption = {
  id: string;
  colorName: string;
};

export type StudioDetailColorway = {
  id: string;
  colorName?: string | null;
};

/** Group catalog colourways of one style: Brand + style name, not SKU. */
export function studioArticleKey(garment: StudioGarmentFields): string {
  const brand = garment.brandName?.trim() ?? "";
  const style = garment.styleName?.trim() ?? "";
  if (brand && style) return `${brand}::${style}`;
  return garment.label.trim() || garment.id;
}

export function studioArticleLabel(garment: StudioGarmentFields): string {
  const brand = garment.brandName?.trim() ?? "";
  const style = garment.styleName?.trim() ?? "";
  if (brand && style) return `${brand} ${style}`.trim();
  return garment.label.trim() || "Garment";
}

/** One row per article so the picker is not 500 colourways. */
export function uniqueStudioArticles(
  garments: readonly StudioGarmentFields[],
): StudioArticleOption[] {
  const seen = new Map<string, StudioArticleOption>();
  for (const garment of garments) {
    const key = studioArticleKey(garment);
    if (seen.has(key)) continue;
    seen.set(key, {
      key,
      label: studioArticleLabel(garment),
      representativeId: garment.id,
    });
  }
  return [...seen.values()];
}

export function filterStudioArticles(
  articles: readonly StudioArticleOption[],
  query: string,
): StudioArticleOption[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [...articles];
  return articles.filter((article) =>
    article.label.toLowerCase().includes(needle),
  );
}

/**
 * Colours for the article already open in the studio.
 * Prefers the product-detail `colorways` list (full style); falls back to
 * other catalog rows that share the same brand + style.
 */
export function studioColorwaysForArticle({
  selectedId,
  garments,
  detailColorways,
}: {
  selectedId: string | null;
  garments: readonly StudioGarmentFields[];
  detailColorways?: readonly StudioDetailColorway[] | null;
}): StudioColorwayOption[] {
  if (!selectedId) return [];

  const selected = garments.find((garment) => garment.id === selectedId);
  const fromDetail = (detailColorways ?? [])
    .map((colorway) => ({
      id: String(colorway.id),
      colorName: String(colorway.colorName || "").trim() || "Colour",
    }))
    .filter((colorway) => colorway.id);

  if (fromDetail.length > 0) {
    if (selected && !fromDetail.some((colorway) => colorway.id === selectedId)) {
      return [
        { id: selected.id, colorName: selected.colorName || "Colour" },
        ...fromDetail,
      ];
    }
    return fromDetail;
  }

  if (!selected) {
    return [];
  }

  const articleKey = studioArticleKey(selected);
  const siblings = garments.filter(
    (garment) => studioArticleKey(garment) === articleKey,
  );
  const seen = new Set<string>();
  const colors: StudioColorwayOption[] = [];
  for (const garment of siblings) {
    if (seen.has(garment.id)) continue;
    seen.add(garment.id);
    colors.push({
      id: garment.id,
      colorName: garment.colorName || "Colour",
    });
  }
  return colors;
}
