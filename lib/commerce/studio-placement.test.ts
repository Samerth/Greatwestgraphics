import { describe, expect, it } from "vitest";
import {
  STUDIO_CENTER_SNAP_PX,
  STUDIO_FULL_WIDTH_FRACTION,
  STUDIO_MARK_WIDTH_FRACTION,
  STUDIO_MAX_HEIGHT_FRACTION,
  STUDIO_PRINT_AREAS,
  artworkOriginInPrintArea,
  cartPlacementSuffix,
  cartPrintMetaLabel,
  centerSnapResult,
  decoratedDesignSides,
  frontChestGuideRects,
  placeArtworkInZone,
  placementAreaPixels,
  placementIntent,
  printAreaPixels,
  realignArtworkToZone,
  zoneForSizeChoice,
} from "./studio-placement";
import { DESIGN_CANVAS_SIZE, defaultPlacementBySide } from "@gwg/contracts";

const placement = {
  ...defaultPlacementBySide(),
  front: "Left Chest",
  back: "Full Back",
};

describe("decoratedDesignSides", () => {
  it("lists only views that have a layer", () => {
    expect(
      decoratedDesignSides({
        front: [{ id: "a" }],
        back: [],
        left: [{ id: "b" }],
        right: [],
      }),
    ).toEqual(["front", "left"]);
  });

  it("counts text layers as decoration too", () => {
    expect(
      decoratedDesignSides(
        { front: [], back: [], left: [], right: [] },
        { front: [], back: [{ id: "name" }], left: [], right: [] },
      ),
    ).toEqual(["back"]);
  });

  // A names-only design (no separate artwork/text layer) used to report
  // zero decorated sides, which blocked it from leaving the studio at all
  // and, had it somehow left, would have priced as an undecorated blank.
  it("counts a roster mark's side as decorated even with no artwork or text layer", () => {
    const empty = { front: [], back: [], left: [], right: [] };
    expect(decoratedDesignSides(empty, empty, ["back"])).toEqual(["back"]);
  });

  it("does not duplicate a side that already has a real layer and a roster mark", () => {
    expect(
      decoratedDesignSides(
        { front: [{ id: "a" }], back: [], left: [], right: [] },
        undefined,
        ["front"],
      ),
    ).toEqual(["front"]);
  });

  it("combines layer sides and roster sides without dropping either", () => {
    expect(
      decoratedDesignSides(
        { front: [{ id: "a" }], back: [], left: [], right: [] },
        undefined,
        ["back"],
      ),
    ).toEqual(["front", "back"]);
  });

  it("treats an empty roster-sides list the same as omitting it", () => {
    const empty = { front: [], back: [], left: [], right: [] };
    expect(decoratedDesignSides(empty, undefined, [])).toEqual([]);
  });
});

describe("cartPrintMetaLabel", () => {
  it("keeps the existing cart meta shape", () => {
    expect(cartPrintMetaLabel(["front"], placement)).toBe("Left Chest (front)");
    expect(cartPrintMetaLabel(["front", "back"], placement)).toBe(
      "Left Chest (front) + Full Back (back)",
    );
  });

  it("echoes Right Chest additively when that zone is stored", () => {
    expect(
      cartPrintMetaLabel(["front"], { ...placement, front: "Right Chest" }),
    ).toBe("Right Chest (front)");
  });
});

describe("cartPlacementSuffix", () => {
  it("echoes zone names without a lecture", () => {
    expect(cartPlacementSuffix(["front"], placement, "front")).toBe(
      "Left Chest",
    );
    expect(cartPlacementSuffix(["front", "back"], placement, "front")).toBe(
      "Left Chest + Full Back",
    );
  });

  it("uses the active view when nothing is decorated yet", () => {
    expect(cartPlacementSuffix([], placement, "back")).toBe("Full Back");
  });

  it("defaults an empty studio to Center Chest for the press ticket", () => {
    const defaults = defaultPlacementBySide();
    expect(defaults.front).toBe("Center Chest");
    expect(cartPlacementSuffix([], defaults, "front")).toBe("Center Chest");
  });
});

describe("studio print areas", () => {
  it("defines a body plate per side in normalized canvas coords", () => {
    for (const side of ["front", "back", "left", "right"] as const) {
      const area = STUDIO_PRINT_AREAS[side];
      expect(area.x).toBeGreaterThanOrEqual(0);
      expect(area.y).toBeGreaterThanOrEqual(0);
      expect(area.width).toBeGreaterThan(0.1);
      expect(area.height).toBeGreaterThan(0.1);
      expect(area.x + area.width).toBeLessThanOrEqual(1);
      expect(area.y + area.height).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the front plate on the chest, not the full photo", () => {
    const front = STUDIO_PRINT_AREAS.front;
    expect(front.width).toBeGreaterThan(0.2);
    expect(front.height).toBeGreaterThan(0.2);
    expect(front.width).toBeLessThan(0.55);
    expect(front.height).toBeLessThan(0.5);
    expect(front.y).toBeGreaterThan(0.15);
  });

  it("puts sleeve plates on the near sleeve of the 3/4 side view", () => {
    const left = STUDIO_PRINT_AREAS.left;
    const right = STUDIO_PRINT_AREAS.right;
    // Unmirrored plate faces left — near sleeve is on the right of the photo,
    // so the plate's centre sits right of the midline. (Its left edge may
    // start a touch left of 0.5: the sleeve does.)
    expect(left.x + left.width / 2).toBeGreaterThan(0.5);
    // And stays on the sleeve. Measured on a real vendor side photo inside
    // the studio's inset frame, the sleeve's outer edge is at about 0.62; a
    // plate reaching 0.70 hung off the garment (Pavin, 15 Sep).
    expect(left.x + left.width).toBeLessThanOrEqual(0.62);
    expect(left.width).toBeLessThan(0.24);
    expect(left.height).toBeLessThan(0.34);
    expect(left.width).toBeLessThan(STUDIO_PRINT_AREAS.front.width);
    // A sleeve print is square (3.5" × 3.5"), so its plate is too.
    expect(left.width).toBeCloseTo(left.height, 5);
    // Right view is the same plate flipped, so the sleeve flips with it.
    expect(right.x).toBeCloseTo(1 - left.x - left.width, 5);
    expect(right.y).toBe(left.y);
    expect(right.width).toBe(left.width);
    expect(right.height).toBe(left.height);
    expect(right.x + right.width / 2).toBeLessThan(0.5);
  });
});

describe("placementIntent", () => {
  it("treats left/center/right as alignment inside the same plate", () => {
    expect(placementIntent("front", "Left Chest")).toEqual({
      alignX: "left",
      alignY: "upper",
      extent: "mark",
    });
    expect(placementIntent("front", "Center Chest")).toEqual({
      alignX: "center",
      alignY: "upper",
      extent: "mark",
    });
    expect(placementIntent("front", "Right Chest")).toEqual({
      alignX: "right",
      alignY: "upper",
      extent: "mark",
    });
    expect(placementIntent("front", "Full Front").extent).toBe("full");
  });
});

describe("placeArtworkInZone", () => {
  const canvas = DESIGN_CANVAS_SIZE;
  const area = printAreaPixels("front", canvas);

  it("sizes a chest mark to the 5×5 guide box, not the full plate", () => {
    const huge = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 4000,
      imageHeight: 4000,
      canvasSize: canvas,
    });
    const tiny = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 200,
      imageHeight: 200,
      canvasSize: canvas,
    });
    const box = placementAreaPixels("front", "Center Chest", canvas);
    const expected = Math.min(
      box.width * STUDIO_FULL_WIDTH_FRACTION,
      box.height * STUDIO_MAX_HEIGHT_FRACTION,
    );
    expect(4000 * huge.scaleX).toBeCloseTo(expected, 5);
    expect(200 * tiny.scaleX).toBeCloseTo(expected, 5);
    expect(4000 * huge.scaleX).toBeLessThanOrEqual(box.width + 0.01);
    expect(4000 * huge.scaleX).toBeLessThan(area.width * STUDIO_MARK_WIDTH_FRACTION + 0.01);
    expect(huge.scaleX).toBeLessThan(0.05);
    expect(tiny.scaleX).toBeGreaterThan(huge.scaleX);
  });

  it("does not use the old 0.4 / 0.45 natural-pixel scale for a 1024 AI concept", () => {
    const placed = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1024,
      imageHeight: 1024,
      canvasSize: canvas,
    });
    expect(1024 * placed.scaleX).toBeLessThan(canvas * 0.25);
    expect(placed.scaleX).toBeLessThan(0.2);
    expect(placed.scaleX).not.toBe(0.45);
    expect(placed.scaleX).not.toBe(0.4);
  });

  it("lands left / center / right inside the 5×5 chest boxes", () => {
    const left = placeArtworkInZone({
      side: "front",
      zone: "Left Chest",
      imageWidth: 1000,
      imageHeight: 800,
      canvasSize: canvas,
    });
    const center = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1000,
      imageHeight: 800,
      canvasSize: canvas,
    });
    const right = placeArtworkInZone({
      side: "front",
      zone: "Right Chest",
      imageWidth: 1000,
      imageHeight: 800,
      canvasSize: canvas,
    });
    const boxes = frontChestGuideRects();
    for (const [placed, zone] of [
      [left, "Left Chest"],
      [center, "Center Chest"],
      [right, "Right Chest"],
    ] as const) {
      const guide = boxes.find((box) => box.zone === zone)!;
      const box = {
        x: guide.rect.x * canvas,
        y: guide.rect.y * canvas,
        width: guide.rect.width * canvas,
        height: guide.rect.height * canvas,
      };
      const displayW = 1000 * placed.scaleX;
      const displayH = 800 * placed.scaleY;
      expect(placed.x).toBeGreaterThanOrEqual(box.x - 0.01);
      expect(placed.y).toBeGreaterThanOrEqual(box.y - 0.01);
      expect(placed.x + displayW).toBeLessThanOrEqual(box.x + box.width + 0.01);
      expect(placed.y + displayH).toBeLessThanOrEqual(box.y + box.height + 0.01);
      expect(placed.x + displayW / 2).toBeCloseTo(box.x + box.width / 2, 5);
      expect(placed.y + displayH / 2).toBeCloseTo(box.y + box.height / 2, 5);
    }
    expect(left.x).toBeLessThan(center.x);
    expect(center.x).toBeLessThan(right.x);
    expect(left.y).toBeCloseTo(center.y, 5);
  });

  it("makes Full Front larger than a centered chest mark, still in the plate", () => {
    const mark = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    const full = placeArtworkInZone({
      side: "front",
      zone: "Full Front",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    expect(full.scaleX).toBeGreaterThan(mark.scaleX);
    expect(1000 * full.scaleX).toBeLessThanOrEqual(area.width + 0.01);
  });

  it("centers a chest mark in the Center Chest box, not at canvas mid as top-left", () => {
    const placed = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    const box = placementAreaPixels("front", "Center Chest", canvas);
    const display = 1000 * placed.scaleX;
    const mid = placed.x + display / 2;
    expect(mid).toBeCloseTo(box.x + box.width / 2, 5);
    expect(mid).toBeCloseTo(area.x + area.width / 2, 5);
    expect(placed.x).not.toBe(canvas / 2);
    expect(placed.y).not.toBe(canvas / 2);
    expect(placed.y).toBeGreaterThan(area.y + area.height * 0.05);
  });
});

describe("artworkOriginInPrintArea", () => {
  it("uses the top-left of the layer so Konva and CSS stay in sync", () => {
    const origin = artworkOriginInPrintArea({
      area: { x: 10, y: 20, width: 100, height: 80 },
      displayWidth: 40,
      displayHeight: 20,
      alignX: "center",
      alignY: "center",
    });
    expect(origin).toEqual({ x: 40, y: 50 });
  });
});

/**
 * 22 Sep, Pavin's client-meeting note: "Positions and size reverts when
 * position is changed." Clicking Left / Center / Right chest was calling
 * placeArtworkInZone — the "brand new artwork" function above, which always
 * computes a fresh default size — on artwork that already had a size the
 * customer had chosen. These pin the fix: moving artwork between zones keeps
 * its size, only shrinking it if the new zone is too small to hold it, and
 * never growing it back to the zone's default.
 */
describe("realignArtworkToZone", () => {
  const canvas = DESIGN_CANVAS_SIZE;

  it("keeps the customer's size when the new zone can hold it", () => {
    const fresh = placeArtworkInZone({
      side: "front",
      zone: "Left Chest",
      imageWidth: 600,
      imageHeight: 400,
      canvasSize: canvas,
    });
    const smallerScale = fresh.scaleX * 0.5;
    const realigned = realignArtworkToZone({
      side: "front",
      zone: "Right Chest",
      imageWidth: 600,
      imageHeight: 400,
      canvasSize: canvas,
      currentScaleX: smallerScale,
      currentScaleY: smallerScale,
      currentX: 400,
      currentY: 250,
    });
    expect(realigned.scaleX).toBeCloseTo(smallerScale, 10);
    expect(realigned.scaleY).toBeCloseTo(smallerScale, 10);
  });

  it("keeps a moderately large logo at its own size across all three chest positions", () => {
    // A logo bigger than the small chest box a *brand-new* logo defaults
    // to, but nowhere near covering the whole print plate — the exact case
    // that surfaced the looser-cap decision: the client's note was "size
    // reverts when position is changed," with no mention of a box, so a
    // logo like this must not be forced down to chest-box size on every
    // Left/Center/Right click.
    const chestCeiling = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    const moderatelyLarge = chestCeiling.scaleX * 1.2;
    for (const zone of ["Left Chest", "Center Chest", "Right Chest"]) {
      const realigned = realignArtworkToZone({
        side: "front",
        zone,
        imageWidth: 1000,
        imageHeight: 1000,
        canvasSize: canvas,
        currentScaleX: moderatelyLarge,
        currentScaleY: moderatelyLarge,
        currentX: 400,
        currentY: 250,
      });
      expect(realigned.scaleX).toBeCloseTo(moderatelyLarge, 10);
    }
  });

  it("still shrinks something that would spill off the print plate entirely, but not down to chest-box size", () => {
    // Full Front is deliberately bigger than any chest box — already
    // asserted above ("makes Full Front larger than a centered chest mark").
    const full = placeArtworkInZone({
      side: "front",
      zone: "Full Front",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    const chestCeiling = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    const absurd = full.scaleX * 3;
    const realigned = realignArtworkToZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
      currentScaleX: absurd,
      currentScaleY: absurd,
      currentX: 400,
      currentY: 250,
    });
    // Clamped down from the absurd size, but the ceiling is the print
    // plate now, not the small chest box — this is what "a looser cap"
    // means: still bigger than the old, tight box-only ceiling.
    expect(realigned.scaleX).toBeLessThan(absurd);
    expect(realigned.scaleX).toBeGreaterThan(chestCeiling.scaleX);
  });

  it("does not enlarge a small mark back up to the zone's default size", () => {
    const defaultForZone = placeArtworkInZone({
      side: "front",
      zone: "Right Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    const tiny = defaultForZone.scaleX * 0.1;
    const realigned = realignArtworkToZone({
      side: "front",
      zone: "Right Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
      currentScaleX: tiny,
      currentScaleY: tiny,
      currentX: 400,
      currentY: 250,
    });
    expect(realigned.scaleX).toBeCloseTo(tiny, 10);
    expect(realigned.scaleX).toBeLessThan(defaultForZone.scaleX);
  });

  it("keeps a flipped mark flipped, shrinking only the magnitude", () => {
    const full = placeArtworkInZone({
      side: "front",
      zone: "Full Front",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    const realigned = realignArtworkToZone({
      side: "front",
      zone: "Left Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
      currentScaleX: -full.scaleX,
      currentScaleY: full.scaleY,
      currentX: 400,
      currentY: 250,
    });
    expect(realigned.scaleX).toBeLessThan(0);
    expect(realigned.scaleY).toBeGreaterThan(0);
    expect(Math.abs(realigned.scaleX)).toBeCloseTo(Math.abs(realigned.scaleY), 10);
  });

  it("still centers the mark on the chest box even after clamping its size to the plate", () => {
    // The mark is still centered on the *box's* midpoint — Left/Center/Right
    // is still about which third of the chest it sits over — even though the
    // size itself is now allowed to spill past that small box's own edges,
    // clamped only by the full print plate (the "looser cap" decision).
    const box = placementAreaPixels("front", "Center Chest", canvas);
    const plate = printAreaPixels("front", canvas);
    const realigned = realignArtworkToZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
      currentScaleX: 10, // absurdly large — must still clamp down to fit
      currentScaleY: 10,
      currentX: 400,
      currentY: 250,
    });
    const display = 1000 * realigned.scaleX;
    const mid = realigned.x + display / 2;
    expect(mid).toBeCloseTo(box.x + box.width / 2, 5);
    // Nowhere near the old, tight box ceiling — comfortably bigger than the
    // box itself — but still sensibly bounded by the print plate, not
    // literally unbounded.
    expect(display).toBeGreaterThan(box.width);
    expect(display).toBeLessThanOrEqual(plate.width + 0.01);
  });

  it("moves position between chest zones the way a fresh placement would, size untouched", () => {
    const scale = 0.03;
    const left = realignArtworkToZone({
      side: "front",
      zone: "Left Chest",
      imageWidth: 500,
      imageHeight: 500,
      canvasSize: canvas,
      currentScaleX: scale,
      currentScaleY: scale,
      currentX: 400,
      currentY: 250,
    });
    const right = realignArtworkToZone({
      side: "front",
      zone: "Right Chest",
      imageWidth: 500,
      imageHeight: 500,
      canvasSize: canvas,
      currentScaleX: scale,
      currentScaleY: scale,
      currentX: 400,
      currentY: 250,
    });
    expect(left.x).toBeLessThan(right.x);
    expect(left.scaleX).toBe(scale);
    expect(right.scaleX).toBe(scale);
  });

  it("never touches vertical position on a chest move — only which third it sits over", () => {
    // The other half of "Positions and size reverts when position is
    // changed": a logo dragged down toward the middle of the chest must
    // stay at that height when clicking Left/Center/Right, not snap back
    // up to the conventional collar-height chest-mark position.
    const draggedDownY = 480;
    for (const zone of ["Left Chest", "Center Chest", "Right Chest"]) {
      const realigned = realignArtworkToZone({
        side: "front",
        zone,
        imageWidth: 500,
        imageHeight: 500,
        canvasSize: canvas,
        currentScaleX: 0.03,
        currentScaleY: 0.03,
        currentX: 300,
        currentY: draggedDownY,
      });
      expect(realigned.y).toBe(draggedDownY);
    }
  });
});

/**
 * 22 Sep, Pavin's client-meeting note: "Back view doesn't have the position
 * options." The front's Left/Center/Right chest buttons don't map onto the
 * back or the sleeves — detectPlacementZone never distinguishes a
 * left-of-centre back mark from a right-of-centre one, so there is no
 * "Left Back" to click. The back does have a real choice in its place: a
 * small centred mark, or filling the whole plate. `zoneForSizeChoice` names
 * both zones correctly for every side that has them — but, as the second
 * test below pins, a sleeve's two zone names are not actually a usable
 * choice the same way: they place identically. The studio UI only offers a
 * Mark/Full toggle on the back for that reason; the sleeves get a Center
 * button instead (component-level change, not something a pure function
 * test can see).
 */
describe("zoneForSizeChoice", () => {
  it("maps the back to its two real zones", () => {
    expect(zoneForSizeChoice("back", "mark")).toBe("Upper Back");
    expect(zoneForSizeChoice("back", "full")).toBe("Full Back");
  });

  it("maps each sleeve to its own mark and panel zone names", () => {
    expect(zoneForSizeChoice("left", "mark")).toBe("Left Sleeve");
    expect(zoneForSizeChoice("left", "full")).toBe("Left Side Panel");
    expect(zoneForSizeChoice("right", "mark")).toBe("Right Sleeve");
    expect(zoneForSizeChoice("right", "full")).toBe("Right Side Panel");
  });

  it("the back's two zones genuinely differ in how much of the plate they fill", () => {
    expect(placementIntent("back", zoneForSizeChoice("back", "mark")).extent).toBe(
      "mark",
    );
    expect(placementIntent("back", zoneForSizeChoice("back", "full")).extent).toBe(
      "full",
    );
  });

  it("a sleeve's mark and panel zones place identically, unlike the back's", () => {
    // Confirms why the studio does not offer a Sleeve/Panel toggle: the
    // sleeve's own print area already is the small box, so an image placed
    // there is "full" relative to it too. Both zone names get the same
    // area and the same extent - two buttons that would do the same thing.
    const canvas = DESIGN_CANVAS_SIZE;
    const mark = placementAreaPixels("left", zoneForSizeChoice("left", "mark"), canvas);
    const panel = placementAreaPixels("left", zoneForSizeChoice("left", "full"), canvas);
    expect(panel).toEqual(mark);
    expect(placementIntent("left", zoneForSizeChoice("left", "mark")).extent).toBe(
      placementIntent("left", zoneForSizeChoice("left", "full")).extent,
    );
  });
});

/**
 * 22 Sep, Pavin's client-meeting note: "Center line on drag and drop." The
 * only guides drawn while dragging were the front's three chest boxes —
 * nothing centred, and nothing at all on the back or a sleeve. This pins the
 * snap math the new centre-line guide relies on: it operates on the same
 * logical, canvas-pixel positions realignArtworkToZone already works in
 * (item 8), not on raw screen pixels, so it stays correct at any zoom level.
 */
describe("centerSnapResult", () => {
  const canvas = DESIGN_CANVAS_SIZE;

  it("does nothing when the layer is far from the centre", () => {
    const area = printAreaPixels("front", canvas);
    const farX = area.x; // pinned to the area's own left edge, not the middle
    const result = centerSnapResult(farX, 40, "front", canvas);
    expect(result.snapped).toBe(false);
    expect(result.x).toBe(farX);
  });

  it("snaps exactly onto the centre when already within the threshold", () => {
    const area = printAreaPixels("front", canvas);
    const centerX = area.x + area.width / 2;
    const width = 40;
    // Nudged a few pixels off dead-centre - close enough to catch.
    const nearX = centerX - width / 2 + STUDIO_CENTER_SNAP_PX / 2;
    const result = centerSnapResult(nearX, width, "front", canvas);
    expect(result.snapped).toBe(true);
    expect(result.x).toBeCloseTo(centerX - width / 2, 10);
    // The layer's own middle lands exactly on the area's middle.
    expect(result.x + width / 2).toBeCloseTo(centerX, 10);
  });

  it("does not snap just outside the threshold", () => {
    const area = printAreaPixels("front", canvas);
    const centerX = area.x + area.width / 2;
    const width = 40;
    const justOutside = centerX - width / 2 + STUDIO_CENTER_SNAP_PX + 1;
    const result = centerSnapResult(justOutside, width, "front", canvas);
    expect(result.snapped).toBe(false);
    expect(result.x).toBe(justOutside);
  });

  it("works the same way on every side, not only the front", () => {
    for (const side of ["front", "back", "left", "right"] as const) {
      const area = printAreaPixels(side, canvas);
      const centerX = area.x + area.width / 2;
      const width = 30;
      const result = centerSnapResult(centerX - width / 2, width, side, canvas);
      expect(result.snapped, side).toBe(true);
    }
  });
});
