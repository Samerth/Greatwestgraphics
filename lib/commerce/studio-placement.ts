import {
  DESIGN_SIDE_LABELS,
  DesignSides,
  type DesignSide,
} from "@gwg/contracts";

export function decoratedDesignSides(
  artworksBySide: Record<DesignSide, readonly unknown[]>,
): DesignSide[] {
  return DesignSides.filter((side) => artworksBySide[side].length > 0);
}

/** Cart / job meta, e.g. `Left Chest (front) + Full Back (back)`. */
export function cartPrintMetaLabel(
  sides: readonly DesignSide[],
  placementBySide: Record<DesignSide, string>,
): string {
  return sides
    .map(
      (side) =>
        `${placementBySide[side]} (${DESIGN_SIDE_LABELS[side].toLowerCase()})`,
    )
    .join(" + ");
}

/**
 * Add-to-cart suffix. Same zone names as the dropdown — no extra sentence.
 * Falls back to the view the shopper is on when nothing is decorated yet.
 */
export function cartPlacementSuffix(
  sides: readonly DesignSide[],
  placementBySide: Record<DesignSide, string>,
  fallbackSide: DesignSide,
): string {
  const shown = sides.length > 0 ? sides : [fallbackSide];
  return shown.map((side) => placementBySide[side]).join(" + ");
}
