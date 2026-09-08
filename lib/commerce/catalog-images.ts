/**
 * Choose the catalogue tile photo from the vendor URLs we already store.
 * Prefer an on-model / style hero when the feed sent one; keep the
 * colour-specific garment shot for swatches.
 */

export function vendorImagePath(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

export function isCatalogModelShot(url: string): boolean {
  const file = (vendorImagePath(url).split("/").pop() ?? url).toLowerCase();
  return /_om[fsb]\b|\bmodl\b|\bmodel\b|on[-_]?model|\blifestyle\b|studio[-_](front|back|side)/.test(
    file,
  );
}

export function isCatalogFlatShot(url: string): boolean {
  const file = (vendorImagePath(url).split("/").pop() ?? url).toLowerCase();
  return /_flat_|\bflat\b|\bghost\b/.test(file);
}

/** S&S style-level hero (often on-body). Colour folder is the garment shot. */
export function isSsStyleHero(url: string): boolean {
  return /\/images\/style\//i.test(vendorImagePath(url));
}

function trimUrl(url: string | null | undefined): string | null {
  const trimmed = typeof url === "string" ? url.trim() : "";
  return trimmed ? trimmed : null;
}

/**
 * Default PLP / Best Sellers tile. Colour swatches keep their own
 * colorFront URL so hovering a colour still shows that colourway.
 */
export function catalogCardImageUrl(input: {
  colorFrontImageUrl?: string | null;
  styleImageUrl?: string | null;
}): string | null {
  const colorFront = trimUrl(input.colorFrontImageUrl);
  const styleImage = trimUrl(input.styleImageUrl);
  const candidates = [styleImage, colorFront].filter(
    (url): url is string => Boolean(url),
  );
  const model = candidates.find(isCatalogModelShot);
  if (model) return model;
  const styleHero = candidates.find(isSsStyleHero);
  if (styleHero) return styleHero;
  if (styleImage && colorFront && isCatalogFlatShot(colorFront)) {
    return styleImage;
  }
  return styleImage || colorFront;
}
