import type { DesignSide } from "@gwg/contracts";
import { STUDIO_PRINT_AREAS } from "./studio-placement";

/**
 * The front print plate is 13" wide (the same figure the 5×5 chest boxes are
 * derived from in `studio-placement`). Everything here scales from that one
 * number so a "2 inch" name renders at a believable size on the mockup
 * rather than an arbitrary font size.
 */
export const FRONT_PLATE_WIDTH_INCHES = 13;

/** Canvas pixels per real-world inch, for a given canvas size. */
export function pixelsPerInch(canvasSize: number): number {
  return (STUDIO_PRINT_AREAS.front.width * canvasSize) / FRONT_PLATE_WIDTH_INCHES;
}

/**
 * Which garment view a roster decoration location appears on.
 *
 * Returns null for a location we do not have a print plate for, so the
 * caller can skip the preview rather than draw it in the wrong place —
 * a placeholder on the wrong side is worse than no placeholder.
 */
export function rosterPreviewSideFor(location: string): DesignSide | null {
  const key = location.trim().toLowerCase();
  if (key.includes("back")) return "back";
  if (key.includes("left sleeve") || key.includes("left side")) return "left";
  if (key.includes("right sleeve") || key.includes("right side")) return "right";
  if (key.includes("chest") || key.includes("front")) return "front";
  return null;
}

/**
 * Which garment sides actually carry printed content once a roster is
 * involved — i.e. an enabled Names or Numbers mark.
 *
 * Naming people is a real decoration decision, not a placeholder: a design
 * with nothing but names and numbers (no separate logo) is still a fully
 * decorated order, and both "can this design proceed to Input Quantity"
 * and "what does this order cost" need to see that. Before this existed,
 * a names-only design reported zero decorated sides on both counts — it
 * could not leave the studio at all, and if it somehow had, it would have
 * priced as if nothing was being printed.
 */
export function rosterActiveSides(
  rosterDecor: { names: { location: string; enabled: boolean }; numbers: { location: string; enabled: boolean } },
  hasActiveRoster: boolean,
): DesignSide[] {
  if (!hasActiveRoster) return [];
  const sides = new Set<DesignSide>();
  for (const part of [rosterDecor.names, rosterDecor.numbers]) {
    if (!part.enabled) continue;
    const side = rosterPreviewSideFor(part.location);
    if (side) sides.add(side);
  }
  return [...sides];
}

export interface RosterPreviewPlacement {
  side: DesignSide;
  /** Centre point of the placeholder, in canvas pixels. */
  centerX: number;
  centerY: number;
  fontSize: number;
}

/**
 * Where a names/numbers placeholder sits on the mockup.
 *
 * Horizontal position follows the location's own wording — a Left Chest
 * name sits on the wearer's left, not in the middle — and vertical position
 * distinguishes the "upper" placements, which sit near the top of the plate,
 * from the full-panel ones, which centre on it.
 */
/**
 * Where a location's mark sits before any fine-tune offset is applied.
 * Shared by `rosterPreviewPlacement` (offset in) and
 * `rosterPreviewOffsetFromPosition` (offset out) so the forward and inverse
 * math can never drift apart from each other.
 */
function rosterPreviewBaseCenter(
  location: string,
  canvasSize: number,
): { side: DesignSide; centerX: number; centerY: number } | null {
  const side = rosterPreviewSideFor(location);
  if (!side) return null;

  const plate = STUDIO_PRINT_AREAS[side];
  const key = location.trim().toLowerCase();

  let centerX = (plate.x + plate.width / 2) * canvasSize;
  if (key.includes("left chest")) {
    centerX = (plate.x + plate.width * 0.27) * canvasSize;
  } else if (key.includes("right chest")) {
    centerX = (plate.x + plate.width * 0.73) * canvasSize;
  }

  const upper =
    key.includes("chest") || key.includes("upper") || key.includes("sleeve");
  const centerY = upper
    ? (plate.y + plate.height * 0.22) * canvasSize
    : (plate.y + plate.height / 2) * canvasSize;

  return { side, centerX, centerY };
}

/** How far a fine-tune drag is allowed to move a mark from its location's
 *  default center, as a fraction of that plate's own width/height. Generous
 *  enough for real repositioning, bounded so a drag can't lose the mark off
 *  the edge of the garment photo entirely. */
export const ROSTER_PREVIEW_OFFSET_LIMIT = 0.6;

export function clampRosterPreviewOffset(value: number): number {
  return Math.max(
    -ROSTER_PREVIEW_OFFSET_LIMIT,
    Math.min(ROSTER_PREVIEW_OFFSET_LIMIT, value),
  );
}

export function rosterPreviewPlacement(
  location: string,
  heightIn: number,
  canvasSize: number,
  offset: { xNorm: number; yNorm: number } = { xNorm: 0, yNorm: 0 },
): RosterPreviewPlacement | null {
  const base = rosterPreviewBaseCenter(location, canvasSize);
  if (!base) return null;
  const { side, centerX, centerY } = base;
  const plate = STUDIO_PRINT_AREAS[side];

  // The offset is a fraction of the plate's own size, not of the canvas, so
  // it means the same thing on the full studio canvas and on a small Input
  // Quantity preview. Clamped to stay on the garment even if a caller
  // passes an out-of-range value (e.g. old data, or a future bug) rather
  // than trusting every caller to have clamped it already.
  const clampedX = clampRosterPreviewOffset(offset.xNorm);
  const clampedY = clampRosterPreviewOffset(offset.yNorm);

  return {
    side,
    centerX: centerX + clampedX * plate.width * canvasSize,
    centerY: centerY + clampedY * plate.height * canvasSize,
    fontSize: Math.max(6, heightIn * pixelsPerInch(canvasSize)),
  };
}

/**
 * The inverse of `rosterPreviewPlacement`: given where the customer actually
 * dropped the mark (in canvas pixels, on the same side the location started
 * on), what offset reproduces that position next time.
 *
 * Sharing `rosterPreviewBaseCenter` with the forward function is what
 * guarantees this round-trips — drag to a spot, save, reload, and the mark
 * is exactly where it was dropped, not approximately.
 *
 * Returns null if the drop landed on a different side than the location
 * implies (should not happen — the mark is only rendered on its own side —
 * but a stale drag event racing a location change is not impossible).
 */
export function rosterPreviewOffsetFromPosition(
  location: string,
  canvasSize: number,
  droppedX: number,
  droppedY: number,
): { xNorm: number; yNorm: number } | null {
  const base = rosterPreviewBaseCenter(location, canvasSize);
  if (!base) return null;
  const plate = STUDIO_PRINT_AREAS[base.side];
  return {
    xNorm: clampRosterPreviewOffset(
      (droppedX - base.centerX) / (plate.width * canvasSize),
    ),
    yNorm: clampRosterPreviewOffset(
      (droppedY - base.centerY) / (plate.height * canvasSize),
    ),
  };
}

/**
 * A faint halo colour that keeps the placeholder readable whatever the
 * garment is.
 *
 * The fill stays the real ink colour, because that is what gets printed —
 * but black ink previewed on a black hoodie is invisible, which makes the
 * preview worthless exactly when the customer most needs it. A thin
 * contrasting outline keeps it legible without misrepresenting the ink.
 *
 * Accepts any CSS colour; anything it cannot parse is treated as dark,
 * which errs toward a light halo and stays visible on the dark garments
 * where the problem actually bites.
 */
export function placeholderHaloFor(color: string): string {
  const hex = color.trim().replace(/^#/, "");
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  if (!/^[0-9a-f]{6}$/i.test(full)) return "#ffffff";
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  // Rec. 601 luma — good enough to answer "is this light or dark".
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.5 ? "#111111" : "#ffffff";
}

/** What the placeholder reads. Mirrors the Coastal Reign convention the
 *  client benchmarked against, and the panel copy says so explicitly, so a
 *  customer never mistakes it for text that will actually be printed. */
export const ROSTER_NAME_PLACEHOLDER = "EXAMPLE";
export const ROSTER_NUMBER_PLACEHOLDER = "00";
