import type { GarmentPhotoSet } from "@/lib/commerce/garment-backdrop";

export type StudioGarmentFields = {
  id: string;
  label: string;
  colorName: string;
  brandName?: string;
  styleName?: string;
  styleTitle?: string | null;
  slug?: string;
  imageUrl?: string | null;
  sideImageUrl?: string | null;
  backImageUrl?: string | null;
  isDark?: boolean;
};

export type StudioArticleOption = {
  key: string;
  label: string;
  representativeId: string;
};

export type StudioColorwayOption = {
  id: string;
  colorName: string;
  slug?: string;
  hex?: string;
  swatchImageUrl?: string;
  frontImageUrl?: string;
  sideImageUrl?: string;
  backImageUrl?: string;
  isDark?: boolean;
};

export type StudioDetailColorway = {
  id: string;
  colorName?: string | null;
  slug?: string | null;
  colorHex?: string | null;
  color1?: string | null;
  hex?: string | null;
  swatchImageUrl?: string | null;
  frontImageUrl?: string | null;
  sideImageUrl?: string | null;
  backImageUrl?: string | null;
  isDark?: boolean;
};

const NAMED_GARMENT_HEX: Record<string, string> = {
  black: "#111111",
  white: "#f4f4f4",
  navy: "#1b2a4a",
  red: "#c41e3a",
  royal: "#1e4bd1",
  forest: "#1f4d2e",
  green: "#2e7d32",
  grey: "#8a8a8a",
  gray: "#8a8a8a",
  charcoal: "#36454f",
  khaki: "#c3b091",
  natural: "#f3ead3",
  gold: "#d4a017",
  maroon: "#6e1a2b",
  purple: "#5b2c6f",
  orange: "#e07a1f",
  yellow: "#f5d76e",
  pink: "#e89bb0",
  brown: "#6b4226",
  sand: "#d6c4a3",
  ivory: "#fffff0",
  cream: "#fff1d6",
  silver: "#c0c0c0",
  teal: "#167a7a",
  arctic: "#7eb8d4",
  "arctic blue": "#7eb8d4",
  "beacon blue": "#4f8fba",
  "canyon drift": "#c2a07a",
  lime: "#b5d33d",
  hunter: "#355e3b",
};

function trimText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Vendor hex is often `253746` without a hash. */
export function normalizeStudioHex(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (!cleaned) return null;
  const hex = cleaned.startsWith("#") ? cleaned.slice(1) : cleaned;
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex.toLowerCase()}`;
}

export function hexForColorName(name: string): string | null {
  const raw = name.trim();
  if (!raw) return null;
  const lower = raw.toLowerCase();
  if (NAMED_GARMENT_HEX[lower]) return NAMED_GARMENT_HEX[lower];
  const spaced = raw.replace(/([a-z])([A-Z])/g, "$1 $2").toLowerCase();
  if (NAMED_GARMENT_HEX[spaced]) return NAMED_GARMENT_HEX[spaced];
  const tokens = spaced.replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
  for (const token of [...tokens].reverse()) {
    if (NAMED_GARMENT_HEX[token]) return NAMED_GARMENT_HEX[token];
  }
  return null;
}

export function studioColorwayFill(colorway: StudioColorwayOption): {
  hex: string | null;
  imageUrl: string | null;
} {
  return {
    hex: colorway.hex ?? hexForColorName(colorway.colorName),
    imageUrl: colorway.swatchImageUrl || colorway.frontImageUrl || null,
  };
}

/**
 * PDP swatch paint. Uses a colourway photo when the vendor shipped one;
 * otherwise vendor hex / a named-colour guess. Never the shared style shot —
 * that is the same model photo for every colour.
 */
export function pdpColorwaySwatch(colorway: {
  colorName?: unknown;
  colorHex?: unknown;
  color1?: unknown;
  hex?: unknown;
  swatchImageUrl?: unknown;
  frontImageUrl?: unknown;
}): { imageUrl: string | null; hex: string | null } {
  const imageUrl =
    trimText(colorway.swatchImageUrl) || trimText(colorway.frontImageUrl) || null;
  const hex =
    normalizeStudioHex(colorway.colorHex) ??
    normalizeStudioHex(colorway.color1) ??
    normalizeStudioHex(colorway.hex) ??
    hexForColorName(trimText(colorway.colorName));
  return { imageUrl, hex };
}

/** Swatches when a hex or photo exists; otherwise a named select. */
export function studioColorwaysUseSwatches(
  colorways: readonly StudioColorwayOption[],
): boolean {
  return colorways.some((colorway) => {
    const fill = studioColorwayFill(colorway);
    return Boolean(fill.hex || fill.imageUrl);
  });
}

function colorwayFromGarment(garment: StudioGarmentFields): StudioColorwayOption {
  const front = trimText(garment.imageUrl);
  const side = trimText(garment.sideImageUrl);
  const back = trimText(garment.backImageUrl);
  return {
    id: garment.id,
    colorName: garment.colorName || "Colour",
    ...(garment.slug ? { slug: garment.slug } : {}),
    ...(front ? { swatchImageUrl: front, frontImageUrl: front } : {}),
    ...(side ? { sideImageUrl: side } : {}),
    ...(back ? { backImageUrl: back } : {}),
    ...(garment.isDark !== undefined ? { isDark: garment.isDark } : {}),
  };
}

function colorwayFromDetail(
  colorway: StudioDetailColorway,
): StudioColorwayOption | null {
  const id = String(colorway.id || "").trim();
  if (!id) return null;
  const hex =
    normalizeStudioHex(colorway.colorHex) ??
    normalizeStudioHex(colorway.color1) ??
    normalizeStudioHex(colorway.hex);
  const slug = trimText(colorway.slug);
  const swatch = trimText(colorway.swatchImageUrl);
  const front = trimText(colorway.frontImageUrl);
  const side = trimText(colorway.sideImageUrl);
  const back = trimText(colorway.backImageUrl);
  return {
    id,
    colorName: trimText(colorway.colorName) || "Colour",
    ...(slug ? { slug } : {}),
    ...(hex ? { hex } : {}),
    ...(swatch ? { swatchImageUrl: swatch } : {}),
    ...(front ? { frontImageUrl: front } : {}),
    ...(side ? { sideImageUrl: side } : {}),
    ...(back ? { backImageUrl: back } : {}),
    ...(colorway.isDark !== undefined ? { isDark: colorway.isDark } : {}),
  };
}

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
 * Keep the product-detail colorways list only when it belongs to the
 * selected colourway. After shop listings group by style, that list is the
 * only complete sibling set — but a stale fetch from the previous article
 * must not populate the switcher.
 */
export function studioDetailColorwaysForSelection({
  selectedId,
  productId,
  colorways,
}: {
  selectedId: string | null;
  productId?: string | null;
  colorways?: readonly StudioDetailColorway[] | null;
}): readonly StudioDetailColorway[] | undefined {
  if (!selectedId || !colorways?.length) return undefined;
  if (productId === selectedId) return colorways;
  if (colorways.some((colorway) => String(colorway.id) === selectedId)) {
    return colorways;
  }
  return undefined;
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
    .map((colorway) => colorwayFromDetail(colorway))
    .filter((colorway): colorway is StudioColorwayOption => Boolean(colorway));

  if (fromDetail.length > 0) {
    if (selected && !fromDetail.some((colorway) => colorway.id === selectedId)) {
      return [colorwayFromGarment(selected), ...fromDetail];
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
    colors.push(colorwayFromGarment(garment));
  }
  return colors;
}

/**
 * Photos for the colour currently on the canvas.
 * Ignores a stale product-detail payload from the previous colourway so
 * the backdrop does not keep the old shirt while the next fetch is in flight.
 */
export function studioGarmentPhotos({
  selectedId,
  product,
  styleImageUrl,
  styleName,
  styleTitle,
  selectedGarment,
  selectedColorway,
}: {
  selectedId: string | null;
  product?: {
    id: string;
    colorFrontImageUrl?: string | null;
    colorSideImageUrl?: string | null;
    colorBackImageUrl?: string | null;
  } | null;
  styleImageUrl?: string | null;
  styleName?: string | null;
  styleTitle?: string | null;
  selectedGarment?: {
    imageUrl?: string | null;
    sideImageUrl?: string | null;
    backImageUrl?: string | null;
    styleName?: string | null;
    styleTitle?: string | null;
  } | null;
  selectedColorway?: Pick<
    StudioColorwayOption,
    "frontImageUrl" | "sideImageUrl" | "backImageUrl"
  > | null;
}): GarmentPhotoSet {
  const detailMatches = Boolean(
    selectedId && product && product.id === selectedId,
  );
  return {
    colorFrontImageUrl:
      (detailMatches ? product?.colorFrontImageUrl : null) ||
      selectedColorway?.frontImageUrl ||
      selectedGarment?.imageUrl ||
      null,
    colorSideImageUrl:
      (detailMatches ? product?.colorSideImageUrl : null) ||
      selectedColorway?.sideImageUrl ||
      selectedGarment?.sideImageUrl ||
      null,
    colorBackImageUrl:
      (detailMatches ? product?.colorBackImageUrl : null) ||
      selectedColorway?.backImageUrl ||
      selectedGarment?.backImageUrl ||
      null,
    styleImageUrl: styleImageUrl ?? null,
    styleName: styleName ?? selectedGarment?.styleName ?? null,
    styleTitle: styleTitle ?? selectedGarment?.styleTitle ?? null,
  };
}

export type StudioSizeVariant = {
  id: string;
  sizeName: string;
  qty: number;
  active?: boolean;
};

/** Roster size list. If every size is out of stock, still offer the sizes. */
export function studioRosterSizeOptions(
  variants: readonly StudioSizeVariant[],
): { id: string; label: string }[] {
  const inStock = variants.filter(
    (variant) => variant.qty > 0 && variant.active !== false,
  );
  return (inStock.length > 0 ? inStock : variants).map((variant) => ({
    id: variant.id,
    label: variant.sizeName,
  }));
}

/** Keep the shopper's size when the next colourway still offers it. */
export function studioVariantIdForColorway({
  variants,
  preferredSizeName,
}: {
  variants: readonly StudioSizeVariant[];
  preferredSizeName?: string | null;
}): string | null {
  if (variants.length === 0) return null;
  const inStock = (variant: StudioSizeVariant) =>
    variant.qty > 0 && variant.active !== false;
  if (preferredSizeName) {
    const sameName = variants.filter(
      (variant) => variant.sizeName === preferredSizeName,
    );
    const available = sameName.find(inStock);
    if (available) return available.id;
    if (sameName[0]) return sameName[0].id;
  }
  return (variants.find(inStock) ?? variants[0])?.id ?? null;
}
