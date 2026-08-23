import { GWG_PHONE_DISPLAY } from "./phone";

const PHONE_TYPO = /604[-.\s]?331[-.\s]?3285/g;
const DOUBLED_BRAND = /Great West Graphics\s+Great West Graphics/gi;
const JUNK_RUNS = /%%+|-{4,}/g;

export function cleanSeoText(value: string): string {
  return value
    .replace(PHONE_TYPO, GWG_PHONE_DISPLAY)
    .replace(DOUBLED_BRAND, "Great West Graphics")
    .replace(JUNK_RUNS, " ")
    .replace(/\s*\|\s*Great West Graphics\s*$/i, "")
    .replace(/\s{2,}/g, " ")
    .replace(/Greate West Graphics/g, "Great West Graphics")
    .replace(/Whiterock/g, "White Rock")
    .trim();
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
