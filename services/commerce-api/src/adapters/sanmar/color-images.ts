/**
 * Map SanMar media / Bulk URLs onto colourways.
 *
 * getMediaContent is a bag of addresses (colour often lives in the filename,
 * e.g. 108085_black_2011.jpg). Bulk sends one <image> per part plus swatchColor.
 * Do not treat urls[0] as every colourway's photo.
 */

import type { ImageViews } from "../catalog/image-views.js";
import { classifyVendorImageRole } from "../catalog/image-views.js";
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
};

export type ColorwayMediaPatch = {
  styleKey: string;
  colorName: string;
  imageFront?: string;
  imageSide?: string;
  imageBack?: string;
  colorHex?: string;
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
  if (role === "side") pushUnique(bucket.sides, url);
  else if (role === "back") pushUnique(bucket.backs, url);
  else pushUnique(bucket.fronts, url);
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
    const imageFront = bucket.fronts[0];
    const imageSide = bucket.sides[0];
    const imageBack = bucket.backs[0];
    const colorHex = hexByColor.get(key);
    if (!imageFront && !imageSide && !imageBack && !colorHex) continue;
    assigned.set(key, {
      colorName,
      imageFront,
      imageSide,
      imageBack,
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
  const namedFront = unique.find(
    (url) => classifyVendorImageRole(url) === "front",
  );
  if (namedFront) return namedFront;
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
      !views.colorHex
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

/** One Bulk <image> + swatchColor per part → one colourway front (not urls[0]). */
export function bulkProductsToColorwayPatches(
  rows: SanmarBulkProduct[],
): ColorwayMediaPatch[] {
  const byKey = new Map<string, ColorwayMediaPatch>();
  for (const row of rows) {
    const colorName = row.colorName?.trim();
    if (!colorName) continue;
    const key = `${row.styleId}::${colorName.toLowerCase()}`;
    const existing = byKey.get(key);
    const imageFront = httpImageUrl(row.imageUrl);
    const colorHex = row.colorHex;
    if (!existing) {
      if (!imageFront && !colorHex) continue;
      byKey.set(key, {
        styleKey: row.styleId,
        colorName,
        imageFront,
        colorHex,
      });
      continue;
    }
    if (!existing.imageFront && imageFront) existing.imageFront = imageFront;
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
