/**
 * Map SanMar media / Bulk URLs onto colourways.
 *
 * getMediaContent is a bag of addresses (colour often lives in the filename,
 * e.g. 108085_black_2011.jpg). Bulk sends one <image> per part plus swatchColor.
 * Do not treat urls[0] as every colourway's photo.
 */

import type { ImageViews } from "../catalog/image-views.js";
import {
  classifyVendorImageRole,
  isFlatProductShot,
  isModelShot,
} from "../catalog/image-views.js";
import type { CatalogSkuRow } from "../catalog/types.js";
import type { SanmarBulkProduct } from "./client.js";

export type ColorImageHint = {
  colorName: string;
  url?: string | null;
  hex?: string | null;
};

export type AssignedColorImages = ImageViews & {
  colorName: string;
  colorHex?: string;
  /**
   * On-model/lifestyle shots, kept separate from the flat garment shots
   * above rather than overwriting them — mirrors how S&S's own explicitly
   * labelled `colorOnModelFrontImage` etc. already work
   * (`ss-activewear/sync-service.ts`). Before this existed, SanMar's flat
   * shot was discarded the moment a model shot existed for the same
   * colourway/side (`imageFront` etc. is now flat-first instead), which is
   * exactly why the Design Studio — which draws `imageFront` as the garment
   * backdrop — could show a model wearing the product instead of the plain
   * garment (Pavin: "images in the studio should just be the product").
   */
  imageFrontOnModel?: string;
  imageSideOnModel?: string;
  imageBackOnModel?: string;
};

export type ColorwayMediaPatch = {
  styleKey: string;
  colorName: string;
  imageFront?: string;
  imageSide?: string;
  imageBack?: string;
  colorHex?: string;
  imageFrontOnModel?: string;
  imageSideOnModel?: string;
  imageBackOnModel?: string;
};

export function httpImageUrl(
  url: string | null | undefined,
): string | undefined {
  const trimmed = typeof url === "string" ? url.trim() : "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : undefined;
}

export function colorNameSlugs(colorName: string): string[] {
  const words = colorName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  if (!words) return [];
  const underscored = words.replace(/\s+/g, "_");
  const dashed = words.replace(/\s+/g, "-");
  const compact = words.replace(/\s+/g, "");
  return [...new Set([underscored, dashed, compact])].sort(
    (a, b) => b.length - a.length,
  );
}

function filenameForMatch(url: string): string {
  try {
    return decodeURIComponent(new URL(url).pathname).toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}

function slugInFilename(file: string, slug: string): boolean {
  const escaped = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[_\\-./])${escaped}(?:[_\\-./]|$)`).test(file);
}

/** True when a media filename carries this colour name (e.g. `_black_`). */
export function urlMatchesColor(url: string, colorName: string): boolean {
  const file = filenameForMatch(url);
  return colorNameSlugs(colorName).some((slug) => slugInFilename(file, slug));
}

/**
 * Longest colour-name slug wins so `_tnf_black_` maps to "TNF Black"
 * rather than "Black".
 */
export function bestColorForUrl(
  url: string,
  colorNames: string[],
): string | null {
  const file = filenameForMatch(url);
  let best: { name: string; score: number } | null = null;
  const seen = new Set<string>();
  for (const raw of colorNames) {
    const display = raw.trim();
    const key = display.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    for (const slug of colorNameSlugs(display)) {
      if (!slugInFilename(file, slug)) continue;
      if (!best || slug.length > best.score) {
        best = { name: display, score: slug.length };
      }
      break;
    }
  }
  return best?.name ?? null;
}

function emptyViews(): {
  fronts: string[];
  sides: string[];
  backs: string[];
} {
  return { fronts: [], sides: [], backs: [] };
}

function pushUnique(list: string[], url: string) {
  if (!list.includes(url)) list.push(url);
}

function placeUrl(
  bucket: { fronts: string[]; sides: string[]; backs: string[] },
  url: string,
) {
  const role = classifyVendorImageRole(url);
  const list =
    role === "side" ? bucket.sides : role === "back" ? bucket.backs : bucket.fronts;
  if (list.includes(url)) return;
  list.push(url);
}

/**
 * Splits one role's candidate URLs into the flat/ghost shot (for
 * `imageFront` etc. — the Design Studio backdrop and, via
 * `catalogCardImageUrl`'s fallback, the flat garment shot on the PDP
 * gallery) and the on-model shot (for `imageFrontOnModel` etc. — the
 * catalogue tile, per CodSphere UAT: "Use model/on-body product imagery as
 * the primary catalogue image wherever available"). Order within `list` no
 * longer decides which wins; both are kept when both exist.
 */
function splitFlatAndModel(list: string[]): {
  flat: string | undefined;
  model: string | undefined;
} {
  const model = list.find((url) => isModelShot(url));
  const flat = list.find((url) => !isModelShot(url)) ?? list[0];
  return { flat, model };
}

/**
 * Split a style-level media bag (and optional Bulk / ProductPart hints)
 * across colourways. A URL that names one colour is never copied onto the
 * others. Unlabeled addresses are style-level fallback only — not every
 * colourway's hero.
 */
export function assignSanmarColorImages(input: {
  colorNames: string[];
  mediaUrls?: Array<string | null | undefined>;
  hints?: ColorImageHint[];
}): Map<string, AssignedColorImages> {
  const colors: Array<{ key: string; colorName: string }> = [];
  const seen = new Set<string>();
  for (const raw of input.colorNames) {
    const colorName = raw.trim();
    const key = colorName.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    colors.push({ key, colorName });
  }

  const hexByColor = new Map<string, string>();
  const hintUrlByColor = new Map<string, string[]>();
  const hintOwners = new Map<string, Set<string>>();
  for (const hint of input.hints ?? []) {
    const key = hint.colorName.trim().toLowerCase();
    if (!key) continue;
    const hex = typeof hint.hex === "string" ? hint.hex.trim() : "";
    if (hex && !hexByColor.has(key)) hexByColor.set(key, hex);
    const url = httpImageUrl(hint.url);
    if (!url) continue;
    const list = hintUrlByColor.get(key) ?? [];
    pushUnique(list, url);
    hintUrlByColor.set(key, list);
    const owners = hintOwners.get(url) ?? new Set<string>();
    owners.add(key);
    hintOwners.set(url, owners);
  }

  const buckets = new Map<string, ReturnType<typeof emptyViews>>();
  for (const { key } of colors) buckets.set(key, emptyViews());

  const used = new Set<string>();
  for (const { key } of colors) {
    for (const url of hintUrlByColor.get(key) ?? []) {
      // Same address hinted for two colour names is a style shot, not a
      // per-colour photo — skip it so we do not paint gold onto every row.
      if ((hintOwners.get(url)?.size ?? 0) !== 1) continue;
      placeUrl(buckets.get(key)!, url);
      used.add(url);
    }
  }

  const media = [
    ...new Set(
      (input.mediaUrls ?? [])
        .map((url) => httpImageUrl(url))
        .filter((url): url is string => Boolean(url)),
    ),
  ];
  const colorNames = colors.map((row) => row.colorName);
  for (const url of media) {
    if (used.has(url)) continue;
    const match = bestColorForUrl(url, colorNames);
    if (!match) continue;
    const key = match.toLowerCase();
    const bucket = buckets.get(key);
    if (!bucket) continue;
    placeUrl(bucket, url);
    used.add(url);
  }

  const assigned = new Map<string, AssignedColorImages>();
  for (const { key, colorName } of colors) {
    const bucket = buckets.get(key)!;
    const front = splitFlatAndModel(bucket.fronts);
    const side = splitFlatAndModel(bucket.sides);
    const back = splitFlatAndModel(bucket.backs);
    const colorHex = hexByColor.get(key);
    if (
      !front.flat &&
      !front.model &&
      !side.flat &&
      !side.model &&
      !back.flat &&
      !back.model &&
      !colorHex
    ) {
      continue;
    }
    assigned.set(key, {
      colorName,
      imageFront: front.flat,
      imageSide: side.flat,
      imageBack: back.flat,
      imageFrontOnModel: front.model,
      imageSideOnModel: side.model,
      imageBackOnModel: back.model,
      colorHex,
    });
  }
  return assigned;
}

/** First/best front for ss_styles.style_image_url — never the only colour photo. */
export function pickStyleFallbackImage(
  mediaUrls: Array<string | null | undefined>,
  assigned: Map<string, AssignedColorImages>,
): string | undefined {
  const unique = [
    ...new Set(
      mediaUrls
        .map((url) => httpImageUrl(url))
        .filter((url): url is string => Boolean(url)),
    ),
  ];
  const model = unique.find((url) => isModelShot(url));
  if (model) return model;
  const namedFront = unique.find(
    (url) =>
      classifyVendorImageRole(url) === "front" && !isFlatProductShot(url),
  );
  if (namedFront) return namedFront;
  const anyFront = unique.find(
    (url) => classifyVendorImageRole(url) === "front",
  );
  if (anyFront) return anyFront;
  for (const views of assigned.values()) {
    if (views.imageFront) return views.imageFront;
  }
  return unique[0];
}

export function assignedToMediaPatches(
  styleKey: string,
  assigned: Map<string, AssignedColorImages>,
): ColorwayMediaPatch[] {
  const patches: ColorwayMediaPatch[] = [];
  for (const views of assigned.values()) {
    if (
      !views.imageFront &&
      !views.imageSide &&
      !views.imageBack &&
      !views.colorHex &&
      !views.imageFrontOnModel &&
      !views.imageSideOnModel &&
      !views.imageBackOnModel
    ) {
      continue;
    }
    patches.push({
      styleKey,
      colorName: views.colorName,
      imageFront: views.imageFront,
      imageSide: views.imageSide,
      imageBack: views.imageBack,
      colorHex: views.colorHex,
      imageFrontOnModel: views.imageFrontOnModel,
      imageSideOnModel: views.imageSideOnModel,
      imageBackOnModel: views.imageBackOnModel,
    });
  }
  return patches;
}

export function buildColorwayMediaPatches(input: {
  styleKey: string;
  colorNames: string[];
  mediaUrls?: Array<string | null | undefined>;
  hints?: ColorImageHint[];
}): ColorwayMediaPatch[] {
  return assignedToMediaPatches(
    input.styleKey,
    assignSanmarColorImages({
      colorNames: input.colorNames,
      mediaUrls: input.mediaUrls,
      hints: input.hints,
    }),
  );
}

/**
 * Short forms SanMar's catalogue feed uses for colour words, as they appear
 * once a name is split into words. Taken from the real feeds rather than
 * guessed: every entry below turned a mismatch between the catalogue ("Dk Hthr
 * Grey") and the Bulk reply ("Dark Heather Grey") into a correct match when
 * checked against the 1 Oct 2026 data, and none produced an ambiguous one.
 */
const COLOUR_WORD_FORMS: Record<string, string> = {
  hthr: "heather",
  htr: "heather",
  dk: "dark",
  drk: "dark",
  lt: "light",
  frst: "frost",
  gry: "grey",
  gy: "grey",
  grn: "green",
  blk: "black",
  wht: "white",
  wh: "white",
  char: "charcoal",
};

/**
 * A comparison key for a SanMar colour name: equal for the same colour however
 * it is spelled. Ignores case, spacing, punctuation, the `*` and `®` marks
 * Bulk adds, and the short forms above; splits run-together names
 * ("LapisBlueFrst"). The two SanMar feeds disagree on all of these, so
 * comparing names exactly left 438 staging colourways with no photo even though
 * Bulk had one for them.
 */
export function sanmarColourKey(name: string | null | undefined): string {
  let text = (name ?? "").trim();
  if (!/\s/.test(text)) text = text.replace(/([a-z])([A-Z])/g, "$1 $2");
  return text
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/hthr/g, "hthr ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((word) => COLOUR_WORD_FORMS[word] ?? word)
    .join("");
}

/**
 * Points each Bulk colour patch at the style code and colour name the
 * catalogue actually holds, so `patchColorwayMedia`'s exact match finds the row.
 *
 * Conservative on purpose: a patch is renamed only when exactly one catalogue
 * colour in that style has the same key, no other patch already names that
 * colour exactly, and no other patch would be renamed onto it. Anything less
 * certain is left alone, which means the colourway keeps the photo it has
 * rather than being given a guess.
 */
export function alignPatchesToCatalogueColours<
  T extends { styleKey: string; colorName: string },
>(
  patchesIn: T[],
  catalogue: Map<string, string[]>,
): { patches: T[]; renamed: number } {
  const lower = (value: string) => value.trim().toLowerCase();

  // The two SanMar feeds also disagree on the capitals of a style code
  // (`WERK250` in the catalogue, `WeRK250` in Bulk), and the write that follows
  // matches the style code exactly, so 319 parts in staging would have been
  // skipped. Point each patch at the catalogue's own spelling of its style,
  // when exactly one catalogue style matches ignoring case.
  const stylesByLower = new Map<string, string[]>();
  for (const key of catalogue.keys()) {
    const list = stylesByLower.get(lower(key)) ?? [];
    list.push(key);
    stylesByLower.set(lower(key), list);
  }
  const patches = patchesIn.map((patch) => {
    if (catalogue.has(patch.styleKey)) return patch;
    const candidates = stylesByLower.get(lower(patch.styleKey));
    if (!candidates || candidates.length !== 1) return patch;
    return { ...patch, styleKey: candidates[0]! };
  });

  const exactByStyle = new Map<string, Set<string>>();
  for (const patch of patches) {
    const set = exactByStyle.get(patch.styleKey) ?? new Set<string>();
    set.add(lower(patch.colorName));
    exactByStyle.set(patch.styleKey, set);
  }

  const targetFor = new Map<T, string>();
  const claims = new Map<string, number>();
  for (const patch of patches) {
    const names = catalogue.get(patch.styleKey);
    if (!names) continue;
    const exactNames = exactByStyle.get(patch.styleKey)!;
    if (names.some((name) => lower(name) === lower(patch.colorName))) continue;
    const key = sanmarColourKey(patch.colorName);
    if (!key) continue;
    const candidates = [
      ...new Set(
        names.filter((name) => sanmarColourKey(name) === key).map(lower),
      ),
    ];
    if (candidates.length !== 1) continue;
    const target = candidates[0]!;
    if (exactNames.has(target)) continue;
    const original = names.find((name) => lower(name) === target)!;
    targetFor.set(patch, original);
    const claim = `${patch.styleKey}::${target}`;
    claims.set(claim, (claims.get(claim) ?? 0) + 1);
  }

  const aligned = patches.map((patch) => {
    const target = targetFor.get(patch);
    if (!target) return patch;
    if ((claims.get(`${patch.styleKey}::${lower(target)}`) ?? 0) !== 1) {
      return patch;
    }
    return { ...patch, colorName: target };
  });
  // Patches whose style code or colour name was pointed at the catalogue's own.
  const renamed = aligned.filter((patch, index) => patch !== patchesIn[index])
    .length;
  return { patches: aligned, renamed };
}

/**
 * One Bulk <image> + swatchColor per part → one colourway front (not urls[0]).
 *
 * A model shot goes to `imageFrontOnModel`, never `imageFront`: `imageFront` is
 * the flat garment the Design Studio draws artwork on, and `patchColorwayMedia`
 * overwrites it, so a model photo landing there would put a person back into
 * the studio. The 1 Oct 2026 Bulk reply had no model shots (all 4,128 distinct
 * images were flat), so today this only guards a future change on SanMar's side.
 */
export function bulkProductsToColorwayPatches(
  rows: SanmarBulkProduct[],
): ColorwayMediaPatch[] {
  const byKey = new Map<string, ColorwayMediaPatch>();
  for (const row of rows) {
    const colorName = row.colorName?.trim();
    if (!colorName) continue;
    const key = `${row.styleId}::${colorName.toLowerCase()}`;
    const existing = byKey.get(key);
    const url = httpImageUrl(row.imageUrl);
    const onModel = url !== undefined && isModelShot(url);
    const imageFront = onModel ? undefined : url;
    const imageFrontOnModel = onModel ? url : undefined;
    const colorHex = row.colorHex;
    if (!existing) {
      if (!url && !colorHex) continue;
      byKey.set(key, {
        styleKey: row.styleId,
        colorName,
        imageFront,
        imageFrontOnModel,
        colorHex,
      });
      continue;
    }
    if (!existing.imageFront && imageFront) existing.imageFront = imageFront;
    if (!existing.imageFrontOnModel && imageFrontOnModel) {
      existing.imageFrontOnModel = imageFrontOnModel;
    }
    if (!existing.colorHex && colorHex) existing.colorHex = colorHex;
  }
  return [...byKey.values()];
}

export function applySanmarImagesToCatalogRows(
  rows: CatalogSkuRow[],
  mediaUrls?: Array<string | null | undefined>,
  extraHints?: ColorImageHint[],
): CatalogSkuRow[] {
  if (rows.length === 0) return rows;
  const assigned = assignSanmarColorImages({
    colorNames: rows.map((row) => row.colorName),
    mediaUrls,
    hints: [
      ...rows.map((row) => ({
        colorName: row.colorName,
        url: row.imageFront,
        hex: row.colorHex,
      })),
      ...(extraHints ?? []),
    ],
  });
  return rows.map((row) => {
    const views = assigned.get(row.colorName.trim().toLowerCase());
    if (!views) {
      return {
        ...row,
        imageFront: undefined,
        imageSide: undefined,
        imageBack: undefined,
      };
    }
    return {
      ...row,
      imageFront: views.imageFront,
      imageSide: views.imageSide,
      imageBack: views.imageBack,
      colorHex: views.colorHex ?? row.colorHex,
    };
  });
}
