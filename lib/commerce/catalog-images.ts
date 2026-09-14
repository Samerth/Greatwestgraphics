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
 *
 * `colorOnModelFrontImageUrl` is S&S's own explicitly-labelled on-model
 * shot (colorOnModelFrontImage from their v2 API) — unlike SanMar, whose
 * media bag has to be guessed at via `isCatalogModelShot`'s filename
 * patterns, S&S tells us definitively, so it wins outright when present
 * rather than being run through the guesswork path. SanMar rows never
 * populate this field, so they fall through to the existing logic
 * unchanged.
 */
export function catalogCardImageUrl(input: {
  colorFrontImageUrl?: string | null;
  styleImageUrl?: string | null;
  colorOnModelFrontImageUrl?: string | null;
}): string | null {
  const onModel = trimUrl(input.colorOnModelFrontImageUrl);
  if (onModel) return onModel;
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

/**
 * The vendor CDNs product photos are hotlinked from — the same three hosts
 * `next.config.ts` allows under `images.remotePatterns`. A test reads that
 * file back to keep the two lists identical.
 */
export const VENDOR_IMAGE_HOSTS = [
  "media.sanmarcanada.com",
  "www.ssactivewear.com",
  "cdn.ssactivewear.com",
] as const;

/**
 * Whether a photo is served by a vendor CDN rather than by us.
 *
 * Why it matters (client call, 10 Sep — "garment and model images sometimes
 * fail to appear while scrolling, but do appear once clicked"): every
 * `next/image` request is, by default, routed through our own image
 * optimiser, which downloads the original from the vendor, resizes and
 * re-encodes it with `sharp`, and only then serves it. The web container runs
 * on half a CPU. Scrolling a catalogue page asks for twenty-odd of those at
 * once; they queue, some time out, and the browser is left with a blank
 * tile. Opening the product then requests a single image at a different size
 * with no contention, so it loads — exactly the symptom reported.
 *
 * Vendor CDNs already serve web-sized product photography and are built for
 * this load. Marking their images `unoptimized` sends the browser straight to
 * them, which takes our container out of the path entirely. Local assets
 * under /images keep going through the optimiser as before.
 */
export function isVendorImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return (VENDOR_IMAGE_HOSTS as readonly string[]).includes(host);
  } catch {
    return false;
  }
}
