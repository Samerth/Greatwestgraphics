import { describe, expect, it } from "vitest";
import {
  STUDIO_FULL_WIDTH_FRACTION,
  STUDIO_MARK_WIDTH_FRACTION,
  STUDIO_MAX_HEIGHT_FRACTION,
  STUDIO_PRINT_AREAS,
  artworkOriginInPrintArea,
  cartPlacementSuffix,
  cartPrintMetaLabel,
  decoratedDesignSides,
  frontChestGuideRects,
  placeArtworkInZone,
  placementAreaPixels,
  placementIntent,
  printAreaPixels,
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
    // Unmirrored plate faces left — near sleeve is on the right of the photo.
    expect(left.x).toBeGreaterThan(0.5);
    expect(left.x + left.width).toBeLessThan(0.75);
    expect(left.width).toBeLessThan(0.24);
    expect(left.height).toBeLessThan(0.34);
    expect(left.width).toBeLessThan(STUDIO_PRINT_AREAS.front.width);
    // Right view is the same plate flipped, so the sleeve flips with it.
    expect(right.x).toBeCloseTo(1 - left.x - left.width, 5);
    expect(right.y).toBe(left.y);
    expect(right.width).toBe(left.width);
    expect(right.height).toBe(left.height);
    expect(right.x + right.width).toBeLessThan(0.5);
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
