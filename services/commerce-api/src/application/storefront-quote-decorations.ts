import type {
  QuoteDecorationLine,
  StorefrontPricing,
  StorefrontQuoteDecoration,
} from "@gwg/contracts";

/**
 * Decoration lines for a storefront quote (`POST /pricing/quote`), as a chat
 * or a form collects them rather than as the pricing engine wants them.
 *
 * The engine is strict on purpose: a screen print needs a colour count, an
 * embroidery needs a stitch count, a DTF print needs a size, and the method
 * key must be one of the published ones. A customer typing "100 shirts,
 * screen printed" into a chat has said none of that, and the connector on
 * the other end (CodChat, 17 Sep) was turning each of those gaps into an
 * HTTP 500 "unexpected error". This module fills what a chat cannot ask for
 * from the published config's own storefront defaults - the same ones the
 * product page's estimate uses - and turns "I can't price that" into a 400
 * that says what can be priced.
 */

export type StorefrontMethodKey = "screenPrint" | "embroidery" | "dtf";

export type NormalizedStorefrontDecoration = Omit<
  StorefrontQuoteDecoration,
  "method"
> & { method: StorefrontMethodKey };

/** The single garment a storefront quote prices; every decoration is on it. */
export const STOREFRONT_GARMENT_ID = "g1";

export class UnsupportedDecorationMethodError extends Error {
  readonly code = "UNSUPPORTED_DECORATION_METHOD";
  constructor(readonly requested: string) {
    super(
      `We can't price "${requested}" decoration. Great West Graphics quotes screen print, embroidery or DTF - please choose one of those.`,
    );
  }
}

/**
 * Method aliases, keyed by the requested method with everything but letters
 * removed - so "screen_print", "Screen Print", "screen-print" and
 * "screenPrint" all read as "screenprint".
 *
 * The whole full-colour family maps to DTF. Great West Graphics does not
 * offer DTG; a customer who asks for "DTG", a "digital print", a "heat
 * transfer" or "vinyl" wants a full-colour print with no colour count, which
 * is exactly the job the shop does with DTF transfers, so it is priced as
 * that rather than refused. Sublimation is a different process the shop does
 * offer but has no pricing entry for, so it is refused with a clear message
 * instead of being silently priced as something else.
 */
const METHOD_ALIASES: Record<string, StorefrontMethodKey> = {
  screenprint: "screenPrint",
  dtf: "dtf",
  dtg: "dtf",
  digitalprint: "dtf",
  heattransfer: "dtf",
  vinyl: "dtf",
  directtofilm: "dtf",
  directtogarment: "dtf",
};

function aliasKey(method: string): string {
  return method.trim().toLowerCase().replace(/[^a-z]/g, "");
}

/** The published method key for a requested method, or null when the shop cannot price it. */
export function resolveDecorationMethodKey(
  method: string,
): StorefrontMethodKey | null {
  const key = aliasKey(method);
  if (!key) return null;
  const aliased = METHOD_ALIASES[key];
  if (aliased) return aliased;
  if (key.startsWith("embroider")) return "embroidery";
  return null;
}

/**
 * Every line with its method resolved to a published key. Throws on the
 * first method the shop cannot price - before any database work, since the
 * answer would be the same afterwards.
 */
export function normalizeStorefrontDecorations(
  decorations: readonly StorefrontQuoteDecoration[],
): NormalizedStorefrontDecoration[] {
  return decorations.map((decoration) => {
    const method = resolveDecorationMethodKey(decoration.method);
    if (!method) throw new UnsupportedDecorationMethodError(decoration.method);
    return { ...decoration, method };
  });
}

/**
 * Engine lines, with the field each method needs defaulted from the
 * storefront config when the caller left it out. A value the caller did
 * state is never overridden: ten colours on a screen print still reaches
 * the engine and comes back as its own validation error, which is the right
 * answer to that request.
 */
export function buildStorefrontDecorations(
  decorations: readonly NormalizedStorefrontDecoration[],
  storefront: Pick<
    StorefrontPricing,
    "defaultColours" | "defaultStitchCount" | "defaultOptionKey"
  >,
): QuoteDecorationLine[] {
  return decorations.map((decoration, index) => ({
    id: `d${index}`,
    garmentId: STOREFRONT_GARMENT_ID,
    methodKey: decoration.method,
    location: decoration.location,
    logoGroup: "",
    colours:
      decoration.method === "screenPrint"
        ? (decoration.colours ?? storefront.defaultColours)
        : decoration.colours,
    variableValue:
      decoration.method === "embroidery"
        ? (decoration.stitch_count ?? storefront.defaultStitchCount)
        : decoration.stitch_count,
    optionKey:
      decoration.method === "dtf"
        ? (decoration.option_key ?? storefront.defaultOptionKey)
            .trim()
            .toLowerCase()
        : decoration.option_key,
    isOversized: decoration.is_oversized,
    artwork: { isRepeat: false, verifiedByStaff: false },
  }));
}
