import { normalizePhoneDisplay } from "./phone";

const DOUBLED_BRAND = /Great West Graphics\s+Great West Graphics/gi;
const JUNK_RUNS = /%%+|-{4,}/g;
const CMS_BOOKMARK_TAG = /<[^>]*data-mce-type\s*=\s*["']bookmark["'][^>]*>/gi;
const WIDGET_COPY =
  /woocommerce|add to cart|select options|best sellers?|featured products?|related products?|product widget|top sellers?/i;

export function cleanSeoText(value: string): string {
  return normalizePhoneDisplay(value)
    .replace(CMS_BOOKMARK_TAG, "")
    .replace(DOUBLED_BRAND, "Great West Graphics")
    .replace(JUNK_RUNS, " ")
    .replace(/\s*\|\s*Great West Graphics\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/Greate West Graphics/g, "Great West Graphics")
    .replace(/Whiterock/g, "White Rock")
    .trim();
}

/** WooCommerce product-widget leftovers — render as a shop teaser, not body copy. */
export function isProductWidgetCopy(value: string): boolean {
  return WIDGET_COPY.test(value);
}

/** Title shown in <title> — brand is added by the root metadata template. */
export function seoDocumentTitle(title: string): string {
  return cleanSeoText(title)
    .replace(/\s*[-|–—]\s*Great West Graphics\s*$/i, "")
    .replace(/\s+Great West Graphics\s*$/i, "")
    .trim();
}

export function containsBannedPhone(value: string): boolean {
  return /604[-.\s]?331[-.\s]?3285/.test(value);
}
