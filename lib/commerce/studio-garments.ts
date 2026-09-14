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

/**
 * Apparel colourway names to a representative hex.
 *
 * Vendors ship a real hex for most colourways and that always wins — this is
 * the fallback for the ones that arrive without it. It was ~30 entries, which
 * covered the plain names ("Navy", "Red") and almost nothing a real catalogue
 * actually uses ("Athletic Heather", "Vegas Gold", "Carolina Blue"). Anything
 * unmatched fell through to painting the swatch with a photograph of the
 * garment, which is what "some swatches are not loading" was actually
 * describing (CodSphere UAT V2 rows 44 and 45).
 *
 * Multi-word entries are matched ahead of single words, so "Light Grey" does
 * not resolve through the bare "grey".
 */
const NAMED_GARMENT_HEX: Record<string, string> = {
  // neutrals
  black: "#111111",
  white: "#f4f4f4",
  grey: "#8a8a8a",
  gray: "#8a8a8a",
  charcoal: "#36454f",
  graphite: "#4a4d52",
  smoke: "#73797f",
  slate: "#5a6570",
  silver: "#c0c0c0",
  ash: "#c7c7c7",
  heather: "#9aa0a6",
  "athletic heather": "#b6bbc0",
  "sport grey": "#a3a3a3",
  "dark heather": "#5f6469",
  "heather grey": "#9aa0a6",
  "heather gray": "#9aa0a6",
  "light grey": "#cfd2d5",
  "light gray": "#cfd2d5",
  "dark grey": "#5a5e63",
  "dark gray": "#5a5e63",
  "steel grey": "#71787e",
  "steel gray": "#71787e",
  ivory: "#fffff0",
  cream: "#fff1d6",
  natural: "#f3ead3",
  bone: "#e3dac9",
  stone: "#cabfa8",
  sand: "#d6c4a3",
  khaki: "#c3b091",
  tan: "#cfa972",
  beige: "#d9c8ab",

  // blues
  navy: "#1b2a4a",
  "true navy": "#1b2a4a",
  "midnight navy": "#141f38",
  royal: "#1e4bd1",
  "royal blue": "#1e4bd1",
  blue: "#2456b8",
  "light blue": "#8fb8de",
  "carolina blue": "#7fa8d4",
  "columbia blue": "#9bbfdc",
  "sky blue": "#87bde0",
  "powder blue": "#a9c8de",
  "indigo blue": "#3b4d78",
  indigo: "#3b4d78",
  denim: "#4a6b8a",
  cobalt: "#1f4fa3",
  sapphire: "#1a4d8f",
  arctic: "#7eb8d4",
  "arctic blue": "#7eb8d4",
  "beacon blue": "#4f8fba",
  aqua: "#4fb3c4",
  turquoise: "#3fb8ae",
  teal: "#167a7a",
  cyan: "#3aa8c1",

  // greens
  green: "#2e7d32",
  forest: "#1f4d2e",
  "forest green": "#1f4d2e",
  hunter: "#355e3b",
  "hunter green": "#355e3b",
  kelly: "#2f9e44",
  "kelly green": "#2f9e44",
  "irish green": "#31a24c",
  olive: "#6b6b3a",
  "military green": "#5b5f42",
  army: "#5b5f42",
  sage: "#9aa88b",
  mint: "#a9d9bd",
  lime: "#b5d33d",
  "safety green": "#c6e21a",
  "neon green": "#a8e02a",

  // reds / pinks
  red: "#c41e3a",
  "true red": "#c41e3a",
  "cardinal": "#8c1a2b",
  crimson: "#a41f36",
  scarlet: "#c8242f",
  maroon: "#6e1a2b",
  burgundy: "#5e1f2c",
  wine: "#5c2233",
  rust: "#9c4a24",
  coral: "#e4736a",
  salmon: "#e79185",
  pink: "#e89bb0",
  "hot pink": "#e0489b",
  "light pink": "#f2c4d2",
  fuchsia: "#cf3d8e",
  azalea: "#e585ab",
  rose: "#d97b93",

  // oranges / yellows / golds
  orange: "#e07a1f",
  "burnt orange": "#b4521e",
  "texas orange": "#bf5700",
  "safety orange": "#f05a1a",
  "neon orange": "#ff6b26",
  peach: "#f2b48c",
  apricot: "#eda76a",
  gold: "#d4a017",
  "vegas gold": "#c5b358",
  "old gold": "#c8a02c",
  "athletic gold": "#d4a017",
  yellow: "#f5d76e",
  "safety yellow": "#e6e02a",
  mustard: "#c9a227",
  butter: "#f3e4a0",

  // purples
  purple: "#5b2c6f",
  violet: "#6b4a99",
  lavender: "#b9a8d4",
  lilac: "#c3b1d9",
  plum: "#6b3355",
  eggplant: "#4a2340",
  orchid: "#b06fb0",

  // browns / earth
  brown: "#6b4226",
  chocolate: "#4f3020",
  espresso: "#3d2a1e",
  coffee: "#5a4032",
  camel: "#c19a6b",
  clay: "#a8674a",
  "canyon drift": "#c2a07a",
  driftwood: "#a89880",
  // Added after a scan of every colourway in the catalogue (14 Sep): 1,536
  // styles, 520 names shipped without a vendor hex, 129 of which the lookup
  // could not resolve. The genuine colours among them are below; the rest
  // were shorthand or trim combinations, handled in hexForColorName itself.
  carolina: "#7fa8d4",
  amethyst: "#8e6fb3",
  anthracite: "#3a3d42",
  asphalt: "#4b4f54",
  bay: "#5d7f9a",
  berry: "#8e3a5e",
  blacktop: "#2a2b2d",
  blossom: "#f2c4cf",
  caramel: "#c68e5a",
  caviar: "#232326",
  chambray: "#9fb5cc",
  "antique chambray": "#8ea3b8",
  chrome: "#b9bdc1",
  concrete: "#9ea3a8",
  cypress: "#4a6b57",
  daisy: "#f5d547",
  dove: "#d6d2cf",
  "dove grey": "#d6d2cf",
  emerald: "#1f7a5a",
  granite: "#8b8d90",
  "granite heather": "#8b8d90",
  greystone: "#7d8085",
  heliconia: "#e0457b",
  huckleberry: "#6b4a7a",
  "jasper blue": "#4f7fa3",
  lapis: "#2f5aa8",
  marine: "#1f4e79",
  midnight: "#1c2541",
  military: "#5a5f3a",
  "military frost": "#7a7f60",
  moss: "#6b7a4a",
  onyx: "#2b2b2e",
  "pale blush": "#e8c9c3",
  pepper: "#4a4a4a",
  pewter: "#8e8e8e",
  "quiet shade": "#6f7378",
  rainyday: "#8a9aa8",
  "rainy day": "#8a9aa8",
  rosewood: "#7a3b45",
  saddle: "#8b5a2b",
  sahara: "#d2b48c",
  sandstone: "#c9b79c",
  sangria: "#7a1f3d",
  "smoked pearl": "#b8b4ae",
  spruce: "#2f5f4f",
  "dark spruce": "#24473b",
  stealth: "#3f4247",
  "surf the web": "#2b6cb0",
  terracotta: "#c46a4a",
  thyme: "#6b7a5a",
  tradewinds: "#6fa3b8",
  "wild raspberry": "#b83a6a",
  yam: "#c77a3a",
  camo: "#6b7a4a",
  multicam: "#7a7351",
  "black multicam": "#3a3a34",
  oatmeal: "#d8cfc0",
  "oatmeal heather": "#d8cfc0",
  "extreme orange": "#ff6a13",
  "extreme yellow": "#ffe600",
  "brilliant orange": "#ff7f2a",
  "dark chocolate": "#3e2a1e",
  "coyote brown": "#8a6e4b",
  "vintage white": "#f2ede3",
  "athletic oxford": "#9ea4a9",
  "coal grey": "#4d5156",
  realtree: "#5f5a48",
  tropical: "#2aa7a0",
};

/** Words that qualify a colour rather than naming one. */
const COLOUR_MODIFIERS = new Set([
  "heathered",
  "vintage",
  "classic",
  "solid",
  "pure",
  "rich",
  "soft",
  "bright",
  "deep",
  "true",
  "med",
  "medium",
  "blast",
  "twist",
  "marl",
  "mix",
  "melange",
]);

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


/**
 * Vendor shorthand, as shipped in SanMar's and S&S's colourway names —
 * "Blk", "Hthr", "DpNy" — expanded to the word the table knows. Applied per
 * token, after splitting, so "Team DrkHthr" becomes "team dark heather".
 * Only unambiguous abbreviations are listed; a token not found here passes
 * through unchanged.
 */
const VENDOR_COLOUR_SHORTHAND: Record<string, string> = {
  blk: "black", bk: "black",
  wht: "white", wh: "white",
  gry: "grey", gr: "grey", gy: "grey",
  nav: "navy", nvy: "navy", dnvy: "navy", dpny: "navy", dn: "navy",
  roy: "royal", ryl: "royal",
  hthr: "heather", htr: "heather", hth: "heather",
  drk: "dark", dk: "dark",
  lt: "light",
  crem: "cream", crm: "cream", cre: "cream",
  brwn: "brown", brw: "brown", brow: "brown", br: "brown",
  bl: "blue",
  grn: "green", gre: "green",
  frst: "forest", for: "forest",
  mar: "maroon",
  yel: "yellow", yello: "yellow",
  orang: "orange", oran: "orange", org: "orange",
  pur: "purple",
  car: "carolina",
  cara: "caramel",
  coalg: "coal grey",
  concret: "concrete",
  oxfrd: "oxford",
  ath: "athletic", athgry: "athletic grey",
  chr: "charcoal", char: "charcoal",
  grap: "graphite",
  grt: "granite",
  mili: "military",
  chocolat: "chocolate",
  sil: "silver",
  agy: "athletic grey",
};

/**
 * Collection and brand prefixes that appear inside a colourway name without
 * being colours: "Flag Roy/Wht", "Team DrkHthr", "TNF DrkGryHth".
 */
const COLOUR_NAME_PREFIXES = new Set(["flag", "team", "tnf", "atc"]);

/**
 * The fill to paint when a name resolves to nothing — a neutral, clearly
 * not-a-real-colour grey. This exists so a swatch is always a fill and never
 * a photograph (CodSphere UAT V2 row 44), whatever the vendor sends. A scan of
 * the full catalogue found the remaining unresolvable names were not colours
 * at all ("Sample", "Location", "Backpack"), so nothing real is lost.
 */
export const UNRESOLVED_SWATCH_HEX = "#c9ced3";

/**
 * Best-guess hex for a colourway name the vendor shipped no hex for.
 *
 * Matching runs widest-first so a qualified name beats the bare colour inside
 * it: "Light Grey" resolves to the light-grey entry rather than to "grey", and
 * "Safety Green" to the high-vis shade rather than plain green. Apparel names
 * put the noun last ("Athletic Heather", "Forest Green"), so within each width
 * the scan runs right to left.
 */
export function hexForColorName(name: string): string | null {
  const raw = name.trim();
  if (!raw) return null;

  // A slash separates body colour from trim ("Crem/Nav/Gry" is a cream
  // garment with navy and grey trim), and the swatch should be the body.
  // Scanning the whole string right to left would pick the trim, so the
  // first segment is resolved on its own first.
  if (raw.includes("/")) {
    const body = raw.split("/")[0]!.trim();
    if (body && body !== raw) {
      const hex = hexForColorName(body);
      if (hex) return hex;
    }
  }

  // "NightSkyNavy" -> "night sky navy"; "Black/Black" -> "black black".
  const spaced = raw
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!spaced) return null;
  if (NAMED_GARMENT_HEX[spaced]) return NAMED_GARMENT_HEX[spaced];

  // Drop collection prefixes, then expand vendor shorthand token by token.
  // An expansion may itself be two words ("coalg" -> "coal grey"), so the
  // result is re-split.
  const tokens = spaced
    .split(/\s+/)
    .filter((token, index) => !(index === 0 && COLOUR_NAME_PREFIXES.has(token)))
    .flatMap((token) => (VENDOR_COLOUR_SHORTHAND[token] ?? token).split(" "));
  if (tokens.length === 0) return null;
  const expanded = tokens.join(" ");
  if (expanded !== spaced && NAMED_GARMENT_HEX[expanded]) {
    return NAMED_GARMENT_HEX[expanded];
  }

  // Multi-word entries ("athletic heather", "safety green") before single
  // words, longest phrase first, each scanned right to left.
  for (let width = Math.min(3, tokens.length); width >= 2; width -= 1) {
    for (let start = tokens.length - width; start >= 0; start -= 1) {
      const phrase = tokens.slice(start, start + width).join(" ");
      if (NAMED_GARMENT_HEX[phrase]) return NAMED_GARMENT_HEX[phrase];
    }
  }

  // Single words, ignoring qualifiers that describe a colour without naming
  // one — otherwise "Heather" in "Safety Orange Heather" would win over the
  // orange it is qualifying.
  for (const token of [...tokens].reverse()) {
    if (COLOUR_MODIFIERS.has(token)) continue;
    if (NAMED_GARMENT_HEX[token]) return NAMED_GARMENT_HEX[token];
  }
  return null;
}

export function studioColorwayFill(colorway: StudioColorwayOption): {
  hex: string | null;
  imageUrl: string | null;
} {
  const hex =
    colorway.hex ??
    hexForColorName(colorway.colorName) ??
    // Never a photo. A swatch photo is precisely what row 44 reported —
    // "certain products display the product within a circle instead" — and
    // it used to be the fallback whenever the name could not be resolved.
    // A neutral fill keeps the promise regardless of what the vendor sends.
    UNRESOLVED_SWATCH_HEX;
  return { hex, imageUrl: null };
}

/**
 * PDP swatch paint. Same rule as the catalogue grid and Design Studio: a flat
 * circle of the actual colour, with a vendor photo only as a last resort.
 *
 * This used to prefer the photo, so a product whose vendor shipped a front
 * shot showed a tiny picture of the garment inside the circle instead of the
 * colour — "swatches should be a filled color, certain products display the
 * product within a circle instead" (CodSphere UAT V2 row 44). The hex was
 * already available on every one of those products; it simply lost.
 *
 * Never the shared style shot — that is the same model photo for every colour.
 */
export function pdpColorwaySwatch(colorway: {
  colorName?: unknown;
  colorHex?: unknown;
  color1?: unknown;
  hex?: unknown;
  swatchImageUrl?: unknown;
  frontImageUrl?: unknown;
}): { imageUrl: string | null; hex: string | null } {
  const hex =
    normalizeStudioHex(colorway.colorHex) ??
    normalizeStudioHex(colorway.color1) ??
    normalizeStudioHex(colorway.hex) ??
    hexForColorName(trimText(colorway.colorName)) ??
    // See studioColorwayFill: a fill, never a photograph (row 44).
    UNRESOLVED_SWATCH_HEX;
  return { hex, imageUrl: null };
}

/** Swatches when a hex or photo exists; otherwise a named select. */
export function studioColorwaysUseSwatches(
  colorways: readonly StudioColorwayOption[],
): boolean {
  return colorways.some((colorway) => {
    const fill = studioColorwayFill(colorway);
    // The neutral placeholder is a fill for painting, not a colour for
    // choosing by. A product whose every colourway resolved to it would
    // show a row of identical grey circles; the named dropdown is the
    // better control there.
    return fill.hex !== UNRESOLVED_SWATCH_HEX;
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
