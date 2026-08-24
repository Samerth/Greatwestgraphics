/** Spec §3: one page had 604-331-3285; every other page uses this number. */
export const GWG_PHONE_DISPLAY = "604-321-3285";
export const GWG_PHONE_TEL = "+16043213285";
export const GWG_EMAIL = "info@greatwestgraphics.com";
export const GWG_ADDRESS =
  "#105 – 342 East Kent Avenue South, Vancouver, BC V5X 4N6";

const PHONE_TYPO = /604[-.\s]?331[-.\s]?3285/g;
const PHONE_CANONICAL = /604[-.\s]?321[-.\s]?3285/g;

/** Rewrite the Maple Ridge typo and spaced/dotted variants to 604-321-3285. */
export function normalizePhoneDisplay(value: string): string {
  return value
    .replace(PHONE_TYPO, GWG_PHONE_DISPLAY)
    .replace(PHONE_CANONICAL, GWG_PHONE_DISPLAY);
}

export function toTelHref(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (
    digits === "6043213285" ||
    digits === "16043213285" ||
    digits === "6043313285"
  ) {
    return GWG_PHONE_TEL;
  }
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return GWG_PHONE_TEL;
}
