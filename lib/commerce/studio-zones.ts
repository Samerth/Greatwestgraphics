import { DESIGN_CANVAS_SIZE, type DesignSide } from "@gwg/contracts";
import { printAreaPixels } from "./studio-placement";

/**
 * Typical adult unisex tee / fleece print plates, in inches.
 *
 * These are press-ticket labels for the studio guide — not measured per SKU.
 * Vendor colorway photos have no calibrated ruler, so the studio uses the
 * same shared defaults as `STUDIO_PRINT_AREAS` (one plate per view, zones
 * are alignment inside that plate).
 *
 * | Zone              | W × H     | Why                                      |
 * |-------------------|-----------|------------------------------------------|
 * | Full Front / Back | 13" × 16" | Adult body plate (user-requested Front)  |
 * | Left/Center/Right Chest | 5" × 5" | Chest mark (user-requested Left Chest) |
 * | Upper Back        | 12" × 5"  | Name / yoke plate                        |
 * | Left/Right Sleeve | 3.5" × 3.5" | Standard sleeve mark                   |
 * | Side Panel        | 4" × 12"  | Vertical side / full-sleeve panel        |
 */
export const STUDIO_ZONE_INCHES: Record<
  string,
  { widthIn: number; heightIn: number }
> = {
  "Left Chest": { widthIn: 5, heightIn: 5 },
  "Center Chest": { widthIn: 5, heightIn: 5 },
  "Right Chest": { widthIn: 5, heightIn: 5 },
  "Full Front": { widthIn: 13, heightIn: 16 },
  "Upper Back": { widthIn: 12, heightIn: 5 },
  "Full Back": { widthIn: 13, heightIn: 16 },
  "Left Sleeve": { widthIn: 3.5, heightIn: 3.5 },
  "Right Sleeve": { widthIn: 3.5, heightIn: 3.5 },
  "Left Side Panel": { widthIn: 4, heightIn: 12 },
  "Right Side Panel": { widthIn: 4, heightIn: 12 },
};

/** Layer is "full" when it covers at least this share of the print-area width. */
export const STUDIO_ZONE_FULL_WIDTH_RATIO = 0.65;
/** Or this share of the print-area height. */
export const STUDIO_ZONE_FULL_HEIGHT_RATIO = 0.7;

function formatInch(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** e.g. `Left Chest · 5"W × 5"H` */
export function formatZoneInchLabel(zone: string): string {
  const inches = STUDIO_ZONE_INCHES[zone];
  if (!inches) return zone;
  return `${zone} · ${formatInch(inches.widthIn)}"W × ${formatInch(inches.heightIn)}"H`;
}

export function detectPlacementZone(input: {
  side: DesignSide;
  /** Layer top-left in studio canvas pixels (`DESIGN_CANVAS_SIZE` space). */
  x: number;
  y: number;
  /** Display size in the same canvas pixels (natural × scale, or text box). */
  width: number;
  height: number;
  canvasSize?: number;
}): string {
  const canvasSize = input.canvasSize ?? DESIGN_CANVAS_SIZE;
  const area = printAreaPixels(input.side, canvasSize);
  const centerX = input.x + Math.max(0, input.width) / 2;
  const centerY = input.y + Math.max(0, input.height) / 2;
  const nx = area.width <= 0 ? 0.5 : (centerX - area.x) / area.width;
  const ny = area.height <= 0 ? 0.5 : (centerY - area.y) / area.height;
  const widthRatio = area.width <= 0 ? 0 : input.width / area.width;
  const heightRatio = area.height <= 0 ? 0 : input.height / area.height;
  const isFull =
    widthRatio >= STUDIO_ZONE_FULL_WIDTH_RATIO ||
    heightRatio >= STUDIO_ZONE_FULL_HEIGHT_RATIO;

  if (input.side === "front") {
    if (isFull) return "Full Front";
    if (nx < 1 / 3) return "Left Chest";
    if (nx > 2 / 3) return "Right Chest";
    return "Center Chest";
  }
  if (input.side === "back") {
    if (isFull) return "Full Back";
    // Upper vs a lower mark still reads as Upper Back on this plate.
    void ny;
    return "Upper Back";
  }
  if (input.side === "left") {
    return isFull ? "Left Side Panel" : "Left Sleeve";
  }
  return isFull ? "Right Side Panel" : "Right Sleeve";
}
