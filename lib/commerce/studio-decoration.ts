import type { DesignDocument, DesignSide, SideDecoration } from "@gwg/contracts";
import type { ShopperDecorationInput } from "@gwg/pricing";
import { stitchCountForPreset, type StitchPresetId } from "../utils/shop-quote";

/**
 * Decoration method + pricing input, independently chosen per side
 * (CodSphere UAT V2, "Decoration Method, Location & Pricing Inputs" — "a
 * customer could select Screen Print → Front → 3 Colours for one logo and
 * Embroidery → Left Chest → Small for another logo").
 *
 * `design.decorationsBySide[side]` is `undefined` until the customer
 * actually picks something for that side — every function here resolves
 * that against a fallback (the studio-wide default, itself seeded from the
 * PDP handoff or the storefront default) so nothing downstream has to
 * special-case "no decoration chosen yet".
 */
export function resolveSideDecoration(
  document: DesignDocument,
  side: DesignSide,
  fallback: SideDecoration,
): SideDecoration {
  return document.decorationsBySide[side] ?? fallback;
}

/** Sets one side's decoration explicitly, merging over whatever it already
 * resolved to (its own prior choice, or the fallback) rather than replacing
 * it outright — so changing just the colour count on a side that already
 * has a method picked does not lose that method. */
export function withSideDecoration(
  document: DesignDocument,
  side: DesignSide,
  patch: Partial<SideDecoration>,
  fallback: SideDecoration,
): DesignDocument {
  const current = resolveSideDecoration(document, side, fallback);
  return {
    ...document,
    decorationsBySide: {
      ...document.decorationsBySide,
      [side]: { ...current, ...patch },
    },
  };
}

/**
 * One pricing input per decorated side, each carrying its own method — the
 * shape `priceShopperQuoteMulti` needs to price a design where different
 * sides run different decoration methods, instead of the single
 * method-for-every-location a plain `priceShopperQuote` call would produce.
 */
export function decorationLinesForPricing(
  document: DesignDocument,
  decoratedSides: readonly DesignSide[],
  fallback: SideDecoration,
): ShopperDecorationInput[] {
  return decoratedSides.map((side) => {
    const decoration = resolveSideDecoration(document, side, fallback);
    return {
      location: side,
      methodKey: decoration.methodKey,
      colours: decoration.colours,
      stitchCount: decoration.stitchPreset
        ? stitchCountForPreset(decoration.stitchPreset as StitchPresetId)
        : undefined,
      optionKey: decoration.optionKey,
    };
  });
}

/**
 * Narrows a decoration method list down to an admin allow-list (CodSphere
 * UAT — "Product-Specific Decoration Methods & Print Locations", e.g. Hats
 * should not offer Screen Print). `null`/empty means unrestricted — every
 * method stays available, today's behaviour.
 */
export function filterAllowedMethods<T extends { key: string }>(
  methods: T[],
  allowedKeys: string[] | null | undefined,
): T[] {
  if (!allowedKeys || allowedKeys.length === 0) return methods;
  const allowed = new Set(allowedKeys);
  return methods.filter((m) => allowed.has(m.key));
}

/**
 * Which Design Studio canvas sides are usable, derived from an admin
 * location allow-list in the PDP's location vocabulary (front / back /
 * leftChest / sleeve — see `LOCATIONS` in lib/utils/shop-quote.ts). `null`
 * means every side stays available (CodSphere UAT — e.g. Bags should not
 * offer sleeve/chest placements, only Front/Back).
 *
 * That vocabulary is coarser than the studio's four sides in one direction
 * (no left/right distinction for "sleeve") and finer in another ("leftChest"
 * has no separate studio side of its own — the chest sits on the front
 * panel) — a generic "sleeve" entry opens both sleeve sides, and
 * "leftChest" opens the front.
 */
export function allowedDesignSides(
  allowedLocations: string[] | null | undefined,
): DesignSide[] | null {
  if (!allowedLocations || allowedLocations.length === 0) return null;
  const set = new Set(allowedLocations);
  const sides: DesignSide[] = [];
  if (set.has("front") || set.has("leftChest")) sides.push("front");
  if (set.has("back")) sides.push("back");
  if (set.has("sleeve")) sides.push("left", "right");
  return sides;
}
