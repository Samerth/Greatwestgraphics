import {
  DESIGN_SIDE_LABELS,
  DesignSides,
  type DesignSide,
} from "@gwg/contracts";

export function decoratedDesignSides(
  artworksBySide: Record<DesignSide, readonly unknown[]>,
  textsBySide?: Record<DesignSide, readonly unknown[]>,
  /** Sides carrying an enabled roster (names/numbers) mark — see
   *  `rosterActiveSides`. A names-only design (no separate artwork) is
   *  still a real, fully decorated order, and needs to count here too. */
  rosterSides?: readonly DesignSide[],
): DesignSide[] {
  return DesignSides.filter(
    (side) =>
      artworksBySide[side].length > 0 ||
      (textsBySide?.[side]?.length ?? 0) > 0 ||
      (rosterSides?.includes(side) ?? false),
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
  // `y` sits the plate just under the collar rather than mid-chest. It was
  // 0.26 / 0.24 / 0.22, which read as a box floating around the belly on a
  // typical square colorway photo (Pavin, UAT row 47: "please move the
  // printable box upwards, reference coastal reign for location"). Widths and
  // heights are unchanged — this is where the plate sits, not how big it is.
  front: { x: 0.3, y: 0.2, width: 0.4, height: 0.36 },
  back: { x: 0.3, y: 0.18, width: 0.4, height: 0.4 },
  // 3/4 plates face left. The near sleeve is on the right of the photo
  // (~3.5" face, not a front plate). Right view mirrors that plate.
  //
  // Square, because the sleeve print it stands for is square (3.5" × 3.5",
  // see STUDIO_ZONE_INCHES) — it was a 0.16 × 0.26 upright rectangle, which
  // reached from the shoulder seam to the hem. And narrower: on a vendor side
  // photo framed by the studio's 8% inset, the sleeve itself spans roughly
  // x 0.48–0.62, so a box out to 0.70 hung off the garment into blank canvas
  // (Pavin, 15 Sep: "the box is not exactly at sleeve — see Coastal Reign").
  // Placed by drawing it onto the real ATC Y3550 side photo, not by eye.
  left: { x: 0.49, y: 0.23, width: 0.12, height: 0.12 },
  right: { x: 0.39, y: 0.23, width: 0.12, height: 0.12 },
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
      // "full", not "mark": the sleeve plate *is* the 3.5" mark (see
      // STUDIO_ZONE_INCHES), so a logo should fill it. The chest rule — a
      // mark is ~32% of its plate — sized sleeve uploads at 13px on a 340px
      // canvas, which is how the plate could look empty with art on it.
      return { alignX: "center", alignY: "center", extent: "full" };
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

/**
 * The back and the sleeves have no left/right split the way the front chest
 * does — `detectPlacementZone` never distinguishes a left-of-centre back
 * mark from a right-of-centre one, and `placementIntent` centers both of
 * them (`Upper Back`, `{side} Sleeve`) unconditionally. What they *do* have
 * is a real choice of size: a small centred mark, or filling the whole
 * plate (`Full Back`, `{side} Side Panel`). This is the equivalent of
 * `frontChestZoneForAlign` for those three sides, named after the choice
 * that actually exists there instead of a left/right one that doesn't
 * (Pavin, client meeting: "Back view doesn't have the position options" —
 * the zone names below are what "position" means once you're off the
 * front).
 */
export function zoneForSizeChoice(
  side: "back" | "left" | "right",
  extent: PlacementExtent,
): string {
  if (side === "back") return extent === "full" ? "Full Back" : "Upper Back";
  const label = side === "left" ? "Left" : "Right";
  return extent === "full" ? `${label} Side Panel` : `${label} Sleeve`;
}

/** How close, in canvas pixels, a dragged layer's own centre has to land to
 *  the print area's centre line before it snaps onto it exactly (Pavin,
 *  client meeting: "Center line on drag and drop"). */
export const STUDIO_CENTER_SNAP_PX = 8;

/**
 * Whether a layer sitting at `x` (canvas pixels, logical space — the same
 * space `x`/`y` are stored in) is close enough to the print area's own
 * horizontal centre to snap onto it, and the x it should actually land at.
 *
 * Deliberately computed in this logical space, the same one
 * `realignArtworkToZone` already works in, rather than the screen's raw
 * pixels — those move with zoom and the current viewport size, so a "snap
 * within 8px" measured there would mean a different real distance at every
 * zoom level. This runs once, on release, against the position already
 * reported through the ordinary drag-move handler — not inside Konva's own
 * drag loop — so it needs no new coordinate math beyond what item 8 and 9
 * already use.
 */
export function centerSnapResult(
  x: number,
  displayWidth: number,
  side: DesignSide,
  canvasSize: number,
): { x: number; snapped: boolean } {
  const area = printAreaPixels(side, canvasSize);
  const centerX = area.x + area.width / 2;
  const midX = x + displayWidth / 2;
  const snapped = Math.abs(midX - centerX) <= STUDIO_CENTER_SNAP_PX;
  return { x: snapped ? centerX - displayWidth / 2 : x, snapped };
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

/**
 * The largest scale an image of this size can sit at inside this zone
 * without overflowing it. This is what a brand-new piece of artwork is sized
 * to by default (`placeArtworkInZone` below) — and also the ceiling a piece
 * of artwork that already has a size must never be grown past when it only
 * *moves* to a different zone (`realignArtworkToZone` below): the chest
 * boxes are smaller than the full plate, so a mark placed at Full Front size
 * and then re-aligned to Left Chest has to shrink to fit, never the reverse.
 */
function maxScaleForZone(
  side: DesignSide,
  zone: string,
  imageWidth: number,
  imageHeight: number,
  canvasSize: number,
  options: { constrainToBox?: boolean } = {},
): number {
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
  if (!inChestBox) return plateScale;
  // `constrainToBox: false` is the loose cap `realignArtworkToZone` asks
  // for below. This must NOT reuse `plateScale` above — a chest zone's own
  // `intent.extent` is "mark" (~32% of whatever area it's given, the
  // sensible starting size to invent for a *brand-new* chest logo), not
  // the true edge-to-edge fit. An already-sized logo that a customer is
  // just moving needs to be judged against how big the print plate can
  // physically hold it, full stop — the same "full" ceiling a Full Front
  // logo gets — or a moderately large logo would still get quietly capped
  // down to "mark" size on every click, which is the same complaint this
  // whole fix exists to solve, just with a bigger box.
  if (options.constrainToBox === false) {
    return scaleForPrintArea(imageWidth, imageHeight, plate.width, plate.height, "full");
  }
  const boxScale = scaleForPrintArea(
    imageWidth,
    imageHeight,
    area.width,
    area.height,
    "full",
  );
  return Math.min(plateScale, boxScale);
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
  const area = placementAreaPixels(side, zone, canvasSize);
  const inChestBox = side === "front" && isFrontChestZone(zone);
  const scale = maxScaleForZone(side, zone, imageWidth, imageHeight, canvasSize);
  const origin = artworkOriginInPrintArea({
    area,
    displayWidth: imageWidth * scale,
    displayHeight: imageHeight * scale,
    alignX: inChestBox ? "center" : intent.alignX,
    alignY: inChestBox ? "center" : intent.alignY,
  });
  return { x: origin.x, y: origin.y, scaleX: scale, scaleY: scale };
}

/**
 * Moves a piece of artwork that is already on the canvas into a different
 * zone on the same side — the Left / Center / Right chest buttons — keeping
 * the size the customer set. A move is not a resize: `placeArtworkInZone`
 * above answers "how big should brand-new artwork be in this zone?", which
 * is the wrong question here, since the artwork already has an answer to
 * that.
 *
 * The ceiling this clamps against is deliberately the whole print plate,
 * not the small chest box `placeArtworkInZone` sizes a *new* chest logo
 * into. The client's note was "size reverts when position is changed," with
 * no mention of a box — clamping a moved logo down to chest-box size on
 * every Left/Center/Right click would reproduce that exact complaint for
 * anyone whose logo is bigger than a conventional chest mark. So a
 * moderately large logo keeps its size across all three chest positions;
 * only something that would spill off the print plate entirely still gets
 * shrunk, and never grows back once it has been.
 *
 * A negative scale (the customer flipped the artwork) keeps its sign; only
 * the magnitude changes.
 */
export function realignArtworkToZone({
  side,
  zone,
  imageWidth,
  imageHeight,
  canvasSize,
  currentScaleX,
  currentScaleY,
  currentX,
  currentY,
}: {
  side: DesignSide;
  zone: string;
  imageWidth: number;
  imageHeight: number;
  canvasSize: number;
  currentScaleX: number;
  currentScaleY: number;
  currentX: number;
  currentY: number;
}): { x: number; y: number; scaleX: number; scaleY: number } {
  const intent = placementIntent(side, zone);
  const area = placementAreaPixels(side, zone, canvasSize);
  const inChestBox = side === "front" && isFrontChestZone(zone);
  const fitScale = maxScaleForZone(side, zone, imageWidth, imageHeight, canvasSize, {
    constrainToBox: false,
  });
  const signX = currentScaleX < 0 ? -1 : 1;
  const signY = currentScaleY < 0 ? -1 : 1;
  const magnitude = Math.min(
    Math.abs(currentScaleX),
    Math.abs(currentScaleY),
    fitScale,
  );
  const scaleX = magnitude * signX;
  const scaleY = magnitude * signY;

  if (inChestBox) {
    // Left/Center/Right changes which third of the chest the logo sits
    // over — nothing else. How high or low it sits is exactly as
    // deliberate a choice as its size, and a position click must not
    // silently discard that any more than it discards size (Pavin, client
    // meeting: "Positions and size reverts when position is changed" — the
    // vertical half of the same complaint size-preservation alone didn't
    // cover). Horizontal still centers the mark within this zone's own
    // box, exactly as before; vertical is simply left alone.
    const displayWidth = imageWidth * magnitude;
    const x = area.x + (area.width - displayWidth) / 2;
    return { x, y: currentY, scaleX, scaleY };
  }

  const origin = artworkOriginInPrintArea({
    area,
    displayWidth: imageWidth * magnitude,
    displayHeight: imageHeight * magnitude,
    alignX: intent.alignX,
    alignY: intent.alignY,
  });
  return { x: origin.x, y: origin.y, scaleX, scaleY };
}
