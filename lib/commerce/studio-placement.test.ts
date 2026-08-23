import { describe, expect, it } from "vitest";
import {
  STUDIO_MARK_WIDTH_FRACTION,
  STUDIO_PRINT_AREAS,
  artworkOriginInPrintArea,
  cartPlacementSuffix,
  cartPrintMetaLabel,
  decoratedDesignSides,
  placeArtworkInZone,
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
});

describe("studio print areas", () => {
  it("defines a body plate per side in normalized canvas coords", () => {
    for (const side of ["front", "back", "left", "right"] as const) {
      const area = STUDIO_PRINT_AREAS[side];
      expect(area.x).toBeGreaterThanOrEqual(0);
      expect(area.y).toBeGreaterThanOrEqual(0);
      expect(area.width).toBeGreaterThan(0.2);
      expect(area.height).toBeGreaterThan(0.2);
      expect(area.x + area.width).toBeLessThanOrEqual(1);
      expect(area.y + area.height).toBeLessThanOrEqual(1);
    }
  });

  it("keeps the front plate on the chest, not the full photo", () => {
    const front = STUDIO_PRINT_AREAS.front;
    expect(front.width).toBeLessThan(0.55);
    expect(front.height).toBeLessThan(0.5);
    expect(front.y).toBeGreaterThan(0.15);
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

  it("sizes a chest mark to ~32% of the print-area width, not the canvas", () => {
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
    const expected = area.width * STUDIO_MARK_WIDTH_FRACTION;
    expect(4000 * huge.scaleX).toBeCloseTo(expected, 5);
    expect(200 * tiny.scaleX).toBeCloseTo(expected, 5);
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

  it("aligns left / center / right inside the body print area", () => {
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
    const displayW = 1000 * left.scaleX;
    expect(left.x).toBeCloseTo(area.x, 5);
    expect(center.x).toBeCloseTo(area.x + (area.width - displayW) / 2, 5);
    expect(center.x).toBeLessThan(right.x);
    expect(left.x).toBeLessThan(center.x);
    expect(right.x).toBeCloseTo(area.x + area.width - displayW, 5);
    expect(left.y).toBeCloseTo(center.y, 5);
    expect(left.y).toBeGreaterThanOrEqual(area.y);
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

  it("centers the mark horizontally in the print area, not at canvas mid as top-left", () => {
    const placed = placeArtworkInZone({
      side: "front",
      zone: "Center Chest",
      imageWidth: 1000,
      imageHeight: 1000,
      canvasSize: canvas,
    });
    const display = 1000 * placed.scaleX;
    const mid = placed.x + display / 2;
    expect(mid).toBeCloseTo(area.x + area.width / 2, 5);
    expect(placed.x).not.toBe(canvas / 2);
    expect(placed.y).not.toBe(canvas / 2);
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
