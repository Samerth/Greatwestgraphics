/**
 * The name a shopper should see on a product.
 *
 * The catalogue stores two different things and they are easy to confuse:
 *
 * - `styleName` is the **vendor's style code** — "1373881", "K500", "G500".
 *   It is an identifier, not a name, and it is what the storefront was
 *   showing: "Under Armour 1373881".
 * - `title` is the manufacturer's descriptive name — "Men's Ultimate365
 *   Elevated Hoodie". That is what a customer is actually shopping for.
 *
 * So `title` wins, and the style code is the fallback for the styles whose
 * vendor feed carried no title (a real gap — a catalogue audit found 47 of
 * them). Showing a bare code is poor; showing nothing at all would be worse.
 */

/** A style code rather than a name: mostly digits, or short and digit-heavy. */
export function looksLikeStyleCode(value: string): boolean {
  const text = value.trim();
  if (!text) return false;
  if (text.includes(" ")) return false;
  const digits = (text.match(/\d/g) ?? []).length;
  if (digits === 0) return false;
  // "1373881" — all digits. "K500", "PC61LS" — a short alphanumeric part
  // number. A real one-word name ("Softstyle") has no digits and is caught
  // by the check above.
  return digits >= text.length / 2 || text.length <= 8;
}

/**
 * `brandName` is prepended only when the title does not already carry it —
 * several vendors ship "Under Armour Storm Fleece Hoodie" as the title, and
 * "Under Armour Under Armour Storm Fleece Hoodie" is worse than either.
 */
export function storefrontProductName(input: {
  brandName?: string | null;
  title?: string | null;
  styleName?: string | null;
}): string {
  const brand = (input.brandName ?? "").trim();
  const title = (input.title ?? "").trim();
  const style = (input.styleName ?? "").trim();

  const descriptive = title || (looksLikeStyleCode(style) ? "" : style);

  if (descriptive) {
    const alreadyBranded =
      brand && descriptive.toLowerCase().startsWith(brand.toLowerCase());
    return alreadyBranded ? descriptive : `${brand} ${descriptive}`.trim();
  }

  // No usable name anywhere. The style code at least identifies the garment,
  // and a shopper can quote it to us.
  return `${brand} ${style}`.trim() || style || brand;
}

/**
 * The style code, shown as supporting detail rather than as the name — a
 * customer reordering last year's shirt does search by it.
 */
export function storefrontStyleCode(input: {
  title?: string | null;
  styleName?: string | null;
}): string | null {
  const title = (input.title ?? "").trim();
  const style = (input.styleName ?? "").trim();
  // Only worth showing when it is not already doing duty as the name.
  if (!style || !title) return null;
  return style;
}
