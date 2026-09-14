import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { STUDIO_PRINT_AREAS } from "./studio-placement";
import { formatPlateInchLabel, STUDIO_ZONE_INCHES } from "./studio-zones";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const studio = read("components/design/DesignStudio.tsx");

/** Strip comments so an assertion never matches prose that merely quotes it. */
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/**
 * CodSphere UAT V2 row 47: "In our design studio, please move the printable
 * box upwards, reference coastal reign for location. Also, please include the
 * box dimensions as seen on Coastal Reigns screenshot."
 */
describe("row 47 — the printable plate sits higher", () => {
  it("starts the body plates just under the collar", () => {
    for (const side of ["front", "back"] as const) {
      // The top edge, not the centre: a plate starting below the midpoint is
      // a box around the belly, which is what was being reported.
      expect(STUDIO_PRINT_AREAS[side].y).toBeLessThanOrEqual(0.2);
    }
  });

  it("puts the sleeve plates on the upper arm, clear of the hem", () => {
    // On a vendor side photo inside the studio's inset frame the sleeve hem
    // sits at about y 0.43. The old plate reached 0.44 — it covered the whole
    // sleeve from shoulder seam to hem rather than marking a spot on it.
    for (const side of ["left", "right"] as const) {
      const plate = STUDIO_PRINT_AREAS[side];
      expect(plate.y).toBeGreaterThanOrEqual(0.18);
      expect(plate.y + plate.height).toBeLessThanOrEqual(0.4);
    }
  });

  it("keeps the front plate clear of the collar", () => {
    // Moving it up is the fix; moving it onto the neck would be a new bug.
    expect(STUDIO_PRINT_AREAS.front.y).toBeGreaterThan(0.15);
  });

  it("moves the plate without resizing it", () => {
    // Row 47 asks for position and a label. The plate's own dimensions are
    // press-ticket values (13" x 16" front) and must not drift as a side
    // effect of repositioning.
    expect(STUDIO_PRINT_AREAS.front.width).toBeCloseTo(0.4, 5);
    expect(STUDIO_PRINT_AREAS.front.height).toBeCloseTo(0.36, 5);
    expect(STUDIO_PRINT_AREAS.back.width).toBeCloseTo(0.4, 5);
    expect(STUDIO_PRINT_AREAS.back.height).toBeCloseTo(0.4, 5);
  });

  it("keeps both plates on the canvas after the move", () => {
    for (const side of ["front", "back", "left", "right"] as const) {
      const area = STUDIO_PRINT_AREAS[side];
      expect(area.y).toBeGreaterThanOrEqual(0);
      expect(area.y + area.height).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the two sleeve plates level with each other", () => {
    // The right view is the left plate flipped, so a change to one that
    // misses the other would tilt the pair.
    expect(STUDIO_PRINT_AREAS.right.y).toBe(STUDIO_PRINT_AREAS.left.y);
  });
});

describe("row 47 — the plate is labelled with its own dimensions", () => {
  it("reports the full-plate size for each view", () => {
    expect(formatPlateInchLabel("front")).toBe('13" × 16"');
    expect(formatPlateInchLabel("back")).toBe('13" × 16"');
    expect(formatPlateInchLabel("left")).toBe('3.5" × 3.5"');
    expect(formatPlateInchLabel("right")).toBe('3.5" × 3.5"');
  });

  it("stays in step with the press-ticket zone table", () => {
    // The label must not become its own second source of truth.
    const front = STUDIO_ZONE_INCHES["Full Front"]!;
    expect(formatPlateInchLabel("front")).toContain(String(front.widthIn));
    expect(formatPlateInchLabel("front")).toContain(String(front.heightIn));
  });

  it("draws that label on the plate itself", () => {
    const body = stripComments(studio);
    expect(body).toContain('data-studio="plate-dimensions"');
    expect(body).toContain("formatPlateInchLabel(activeSide)");
  });

  it("keeps the label out of the shopper's drop target", () => {
    // Sitting inside the box would put a chip over the exact area artwork
    // gets dropped into; it is pinned just above the top edge instead.
    const body = stripComments(studio);
    expect(body).toMatch(/plate-dimensions"[\s\S]{0,200}?-top-\[1\.35rem\]/);
  });

  it("still shows the live placement zone under the mockup", () => {
    // The two labels answer different questions and both must survive: this
    // one changes as artwork is dragged, the plate label does not.
    const body = stripComments(studio);
    expect(body).toContain('data-studio="print-location"');
    expect(body).toContain("formatZoneInchLabel(");
  });
});

/**
 * Client call, 10 September: "the canvas currently presents as a garment on a
 * white background, placed on a beige background, placed again on white. The
 * stacked layers read as cluttered." A single clean surface was requested,
 * with Coastal Reign given as the reference.
 */
describe("the studio canvas is one surface, not three", () => {
  it("paints no tinted card between the panel and the garment photo", () => {
    const body = stripComments(studio);
    // The wrapper holding the canvas and the side rail must not carry a fill
    // of its own — that fill was the middle layer being reported.
    expect(body).not.toMatch(
      /className="min-w-0 w-full max-w-full bg-fill-subtle-15/,
    );
  });

  it("keeps the layout that wrapper provides", () => {
    // The element stays; only its surface was removed. Dropping the flex row
    // would stack the side thumbnails under the canvas on desktop.
    const body = stripComments(studio);
    expect(body).toMatch(
      /className="min-w-0 w-full max-w-full flex flex-col-reverse sm:flex-row items-stretch justify-center gap-3"/,
    );
  });

  it("still tiles the side thumbnails, which are separate objects", () => {
    // The same token is legitimate on the thumbnails: each is its own tile
    // and needs an edge. Only the full-width card behind the mockup was wrong.
    expect(studio).toContain("block aspect-square relative bg-fill-subtle-15");
  });
});
