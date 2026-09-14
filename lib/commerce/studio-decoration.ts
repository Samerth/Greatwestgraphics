import type { DesignDocument, DesignSide, SideDecoration } from "@gwg/contracts";
import type { ShopperDecorationInput } from "@gwg/pricing";
import { stitchCountForPreset, type StitchPresetId } from "../utils/shop-quote";

/**
 * Decoration method + pricing input, chosen per *logo*.
 *
 * It used to be chosen per side, which meant two logos on the front shared
 * one record: changing the method or colour count on one silently changed
 * the other (CodSphere UAT V2 row 59). Each artwork now carries its own
 * choice, and the per-side map is kept only as the fallback for designs
 * saved before that change — so nothing stored needs migrating.
 *
 * Resolution order for any one logo: its own decoration, then the side's,
 * then the studio-wide default (itself seeded from the PDP hand-off).
 */
export function resolveSideDecoration(
  document: DesignDocument,
  side: DesignSide,
  fallback: SideDecoration,
): SideDecoration {
  return document.decorationsBySide[side] ?? fallback;
}

/** One logo's decoration, falling back to its side's and then the default. */
export function resolveArtworkDecoration(
  document: DesignDocument,
  side: DesignSide,
  artworkId: string,
  fallback: SideDecoration,
): SideDecoration {
  const artwork = (document.artworksBySide[side] ?? []).find(
    (entry) => entry.id === artworkId,
  );
  return artwork?.decoration ?? resolveSideDecoration(document, side, fallback);
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
 * Sets one logo's decoration, merged over whatever that logo already
 * resolved to. Only the named artwork is touched — that independence is the
 * whole point of row 59.
 *
 * Changing any field also counts as confirming it (row 46): a shopper who
 * picks a method or a colour count has self-evidently seen the panel, so
 * asking them to press Confirm afterwards would be nagging rather than
 * checking.
 */
export function withArtworkDecoration(
  document: DesignDocument,
  side: DesignSide,
  artworkId: string,
  patch: Partial<SideDecoration>,
  fallback: SideDecoration,
): DesignDocument {
  const current = resolveArtworkDecoration(document, side, artworkId, fallback);
  return {
    ...document,
    artworksBySide: {
      ...document.artworksBySide,
      [side]: (document.artworksBySide[side] ?? []).map((artwork) =>
        artwork.id === artworkId
          ? {
              ...artwork,
              decoration: { ...current, ...patch },
              decorationConfirmed: true,
            }
          : artwork,
      ),
    },
  };
}

/**
 * Marks one logo's decoration as seen and agreed to, and freezes what was
 * agreed (CodSphere UAT V2 row 46).
 *
 * The resolved decoration is written onto the artwork even when the shopper
 * changed nothing. That matters: if it were left to fall back, a later change
 * to the side's decoration would silently re-price a logo the shopper had
 * already signed off. Confirming is a decision, so it gets recorded as one.
 */
export function confirmArtworkDecoration(
  document: DesignDocument,
  side: DesignSide,
  artworkId: string,
  fallback: SideDecoration,
): DesignDocument {
  const current = resolveArtworkDecoration(document, side, artworkId, fallback);
  return {
    ...document,
    artworksBySide: {
      ...document.artworksBySide,
      [side]: (document.artworksBySide[side] ?? []).map((artwork) =>
        artwork.id === artworkId
          ? { ...artwork, decoration: current, decorationConfirmed: true }
          : artwork,
      ),
    },
  };
}

/** Has this logo's decoration been seen and agreed to? */
export function isArtworkDecorationConfirmed(artwork: {
  decorationConfirmed?: boolean;
}): boolean {
  return artwork.decorationConfirmed === true;
}

/**
 * Every logo still waiting on a decoration decision, in the order a shopper
 * would work through them. Row 46 blocks the exit to the Quantity step on
 * this being empty, so it also carries the side and position needed to send
 * them straight to the one that needs attention.
 */
export function artworksNeedingDecoration(
  document: DesignDocument,
  sides: readonly DesignSide[],
): { side: DesignSide; artworkId: string; index: number }[] {
  const pending: { side: DesignSide; artworkId: string; index: number }[] = [];
  for (const side of sides) {
    (document.artworksBySide[side] ?? []).forEach((artwork, index) => {
      if (!isArtworkDecorationConfirmed(artwork)) {
        pending.push({ side, artworkId: artwork.id, index });
      }
    });
  }
  return pending;
}

/**
 * One pricing input per decorated location, built from the logos on it.
 *
 * Colours are summed across the logos sharing a location and method, rather
 * than one logo's count being used for the whole side. Two one-colour logos
 * on the front are a two-colour print: on a screen press each ink colour is
 * its own screen, and both logos run in the same pass (CodSphere UAT V2 row
 * 60 — "I had uploaded 2 separate logos each with a 1 colour logo however
 * the subtotal calculated based on 1 logo with 1 colour").
 *
 * Stitch counts sum for the same reason — two embroidered logos in one
 * location is more stitching, not the larger of the two. Size-tier methods
 * take the largest tier chosen, since a tier is a bracket rather than an
 * amount and adding brackets together would be meaningless.
 *
 * A location whose logos use different methods produces one line per method,
 * because those are genuinely separate jobs on the floor.
 */
export function decorationLinesForPricing(
  document: DesignDocument,
  decoratedSides: readonly DesignSide[],
  fallback: SideDecoration,
): ShopperDecorationInput[] {
  const lines: ShopperDecorationInput[] = [];

  for (const side of decoratedSides) {
    const artworks = document.artworksBySide[side] ?? [];
    // A side can be "decorated" by text or a roster with no artwork on it at
    // all, so an empty list still has to price — as the side's own choice.
    const decorations = artworks.length
      ? artworks.map((artwork) =>
          resolveArtworkDecoration(document, side, artwork.id, fallback),
        )
      : [resolveSideDecoration(document, side, fallback)];

    const byMethod = new Map<string, SideDecoration[]>();
    for (const decoration of decorations) {
      const bucket = byMethod.get(decoration.methodKey) ?? [];
      bucket.push(decoration);
      byMethod.set(decoration.methodKey, bucket);
    }

    for (const [methodKey, group] of byMethod) {
      const colours = group.reduce(
        (sum, entry) => sum + (entry.colours ?? 0),
        0,
      );
      const stitchCount = group.reduce(
        (sum, entry) =>
          sum +
          (entry.stitchPreset
            ? stitchCountForPreset(entry.stitchPreset as StitchPresetId)
            : 0),
        0,
      );
      // Largest tier wins rather than summing - see the note above.
      const optionKey = group
        .map((entry) => entry.optionKey)
        .filter((key): key is string => Boolean(key))
        .pop();

      lines.push({
        // One id per location+method so two prints on the same side stay
        // separately attributable in the breakdown.
        id: `${side}:${methodKey}`,
        location: side,
        methodKey,
        colours: colours > 0 ? colours : undefined,
        stitchCount: stitchCount > 0 ? stitchCount : undefined,
        optionKey,
      });
    }
  }

  return lines;
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
