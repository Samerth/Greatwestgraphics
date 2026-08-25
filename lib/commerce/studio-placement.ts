import {
  DESIGN_SIDE_LABELS,
  DesignSides,
  type DesignSide,
} from "@gwg/contracts";

export function decoratedDesignSides(
  artworksBySide: Record<DesignSide, readonly unknown[]>,
  textsBySide?: Record<DesignSide, readonly unknown[]>,
): DesignSide[] {
  return DesignSides.filter(
    (side) =>
      artworksBySide[side].length > 0 ||
      (textsBySide?.[side]?.length ?? 0) > 0,
  );
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
 * Add-to-cart suffix. Echoes stored zone names for the press ticket —
 * no extra sentence. Falls back to the view the shopper is on when
 * nothing is decorated yet.
 */
export function cartPlacementSuffix(
  sides: readonly DesignSide[],
  placementBySide: Record<DesignSide, string>,
  fallbackSide: DesignSide,
): string {
  const shown = sides.length > 0 ? sides : [fallbackSide];
  return shown.map((side) => placementBySide[side]).join(" + ");
}

/** Fractional rectangle on the square studio canvas, origin top-left. */
export type NormalizedRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * Legal body / sleeve print plate per garment view.
 *
 * These are shared defaults for typical square vendor colorway photos — not
 * per-SKU plates. Artwork can still be dragged freely; this is the region
 * left/center/right align inside, and where new uploads start.
 */
export const STUDIO_PRINT_AREAS: Record<DesignSide, NormalizedRect> = {
  front: { x: 0.3, y: 0.26, width: 0.4, height: 0.36 },
  back: { x: 0.3, y: 0.24, width: 0.4, height: 0.4 },
  // 3/4 plates face left. The near sleeve is on the right of the photo
  // (~3.5" face, not a front plate). Right view mirrors that plate.
  left: { x: 0.54, y: 0.22, width: 0.16, height: 0.26 },
  right: { x: 0.3, y: 0.22, width: 0.16, height: 0.26 },
};

/** Chest / sleeve mark — ~32% of the print-area width, not of the canvas. */
export const STUDIO_MARK_WIDTH_FRACTION = 0.32;
/** Full-front / full-back fill of the same plate. */
export const STUDIO_FULL_WIDTH_FRACTION = 0.76;
/** Never taller than this share of the print-area height. */
export const STUDIO_MAX_HEIGHT_FRACTION = 0.82;
/** Upper-chest / upper-back sit slightly below the top of the plate. */
export const STUDIO_UPPER_INSET_FRACTION = 0.1;

/** Front chest stamps drawn while the shopper drags a logo. */
export const FRONT_CHEST_ZONES = [
  "Left Chest",
  "Center Chest",
  "Right Chest",
] as const;

export type FrontChestZone = (typeof FRONT_CHEST_ZONES)[number];

export type PlacementAlignX = "left" | "center" | "right";
export type PlacementAlignY = "upper" | "center";
export type PlacementExtent = "mark" | "full";

export type PlacementIntent = {
  alignX: PlacementAlignX;
  alignY: PlacementAlignY;
  extent: PlacementExtent;
};

/**
 * Maps the press-operator zone name onto alignment.
 * Front Left / Center / Right Chest are the 5×5 boxes from
 * `frontChestGuideRects()` — not left/center/right of the full plate.
 */
export function placementIntent(
  _side: DesignSide,
  zone: string,
): PlacementIntent {
  switch (zone) {
    case "Left Chest":
      return { alignX: "left", alignY: "upper", extent: "mark" };
    case "Right Chest":
      return { alignX: "right", alignY: "upper", extent: "mark" };
    case "Center Chest":
      return { alignX: "center", alignY: "upper", extent: "mark" };
    case "Upper Back":
      return { alignX: "center", alignY: "upper", extent: "mark" };
    case "Left Sleeve":
    case "Right Sleeve":
      return { alignX: "center", alignY: "upper", extent: "mark" };
    case "Full Front":
    case "Full Back":
    case "Left Side Panel":
    case "Right Side Panel":
      return { alignX: "center", alignY: "center", extent: "full" };
    default:
      return { alignX: "center", alignY: "upper", extent: "mark" };
  }
}

export function pixelsFromNormalizedRect(
  rect: NormalizedRect,
  canvasSize: number,
): { x: number; y: number; width: number; height: number } {
  return {
    x: rect.x * canvasSize,
    y: rect.y * canvasSize,
    width: rect.width * canvasSize,
    height: rect.height * canvasSize,
  };
}

export function printAreaPixels(
  side: DesignSide,
  canvasSize: number,
): { x: number; y: number; width: number; height: number } {
  return pixelsFromNormalizedRect(STUDIO_PRINT_AREAS[side], canvasSize);
}

/**
 * 5×5 chest marks inside the 13×16 front plate. Left / center / right are
 * real boxes on the shirt — not just a label on one shared rectangle.
 */
export function frontChestGuideRects(): {
  zone: FrontChestZone;
  rect: NormalizedRect;
}[] {
  const plate = STUDIO_PRINT_AREAS.front;
  const width = plate.width * (5 / 13);
  const height = plate.height * (5 / 16);
  const y = plate.y + plate.height * STUDIO_UPPER_INSET_FRACTION;
  const left = plate.x;
  const center = plate.x + (plate.width - width) / 2;
  const right = plate.x + plate.width - width;
  return [
    { zone: "Left Chest", rect: { x: left, y, width, height } },
    { zone: "Center Chest", rect: { x: center, y, width, height } },
    { zone: "Right Chest", rect: { x: right, y, width, height } },
  ];
}

export function isFrontChestZone(zone: string): zone is FrontChestZone {
  return (FRONT_CHEST_ZONES as readonly string[]).includes(zone);
}

export function frontChestZoneForAlign(alignX: PlacementAlignX): FrontChestZone {
  if (alignX === "left") return "Left Chest";
  if (alignX === "right") return "Right Chest";
  return "Center Chest";
}

/** Pixel plate, or the matching 5×5 chest box on the front. */
export function placementAreaPixels(
  side: DesignSide,
  zone: string,
  canvasSize: number,
): { x: number; y: number; width: number; height: number } {
  if (side === "front" && isFrontChestZone(zone)) {
    const guide = frontChestGuideRects().find((box) => box.zone === zone);
    if (guide) return pixelsFromNormalizedRect(guide.rect, canvasSize);
  }
  return printAreaPixels(side, canvasSize);
}

/**
 * Konva draws artwork at natural pixels × scale. A phone photo at scale 0.4
 * therefore covers the shirt; this scale is derived from the print area so
 * a 200px logo and a 4000px photo land at the same chest size.
 */
export function scaleForPrintArea(
  imageWidth: number,
  imageHeight: number,
  areaWidth: number,
  areaHeight: number,
  extent: PlacementExtent,
): number {
  const safeW = Math.max(1, imageWidth);
  const safeH = Math.max(1, imageHeight);
  const widthFraction =
    extent === "full" ? STUDIO_FULL_WIDTH_FRACTION : STUDIO_MARK_WIDTH_FRACTION;
  const byWidth = (areaWidth * widthFraction) / safeW;
  const byHeight = (areaHeight * STUDIO_MAX_HEIGHT_FRACTION) / safeH;
  return Math.min(byWidth, byHeight);
}

export function artworkOriginInPrintArea({
  area,
  displayWidth,
  displayHeight,
  alignX,
  alignY,
}: {
  area: { x: number; y: number; width: number; height: number };
  displayWidth: number;
  displayHeight: number;
  alignX: PlacementAlignX;
  alignY: PlacementAlignY;
}): { x: number; y: number } {
  let x = area.x;
  if (alignX === "center") x = area.x + (area.width - displayWidth) / 2;
  if (alignX === "right") x = area.x + area.width - displayWidth;

  const y =
    alignY === "upper"
      ? area.y + area.height * STUDIO_UPPER_INSET_FRACTION
      : area.y + (area.height - displayHeight) / 2;

  return { x, y };
}

/** Default transform for a new layer inside the print-area plate. */
export function placeArtworkInZone({
  side,
  zone,
  imageWidth,
  imageHeight,
  canvasSize,
}: {
  side: DesignSide;
  zone: string;
  imageWidth: number;
  imageHeight: number;
  canvasSize: number;
}): { x: number; y: number; scaleX: number; scaleY: number } {
  const intent = placementIntent(side, zone);
  const plate = printAreaPixels(side, canvasSize);
  const area = placementAreaPixels(side, zone, canvasSize);
  const inChestBox = side === "front" && isFrontChestZone(zone);
  const plateScale = scaleForPrintArea(
    imageWidth,
    imageHeight,
    plate.width,
    plate.height,
    intent.extent,
  );
  const boxScale = inChestBox
    ? scaleForPrintArea(
        imageWidth,
        imageHeight,
        area.width,
        area.height,
        "full",
      )
    : plateScale;
  const scale = inChestBox ? Math.min(plateScale, boxScale) : plateScale;
  const origin = artworkOriginInPrintArea({
    area,
    displayWidth: imageWidth * scale,
    displayHeight: imageHeight * scale,
    alignX: inChestBox ? "center" : intent.alignX,
    alignY: inChestBox ? "center" : intent.alignY,
  });
  return { x: origin.x, y: origin.y, scaleX: scale, scaleY: scale };
}
