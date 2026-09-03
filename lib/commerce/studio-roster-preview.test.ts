import { describe, expect, it } from "vitest";
import {
  clampRosterPreviewOffset,
  placeholderHaloFor,
  pixelsPerInch,
  rosterActiveSides,
  rosterPreviewOffsetFromPosition,
  rosterPreviewPlacement,
  rosterPreviewSideFor,
  FRONT_PLATE_WIDTH_INCHES,
  ROSTER_PREVIEW_OFFSET_LIMIT,
} from "./studio-roster-preview";
import { STUDIO_PRINT_AREAS } from "./studio-placement";

const CANVAS = 1000;

describe("rosterPreviewSideFor", () => {
  it("routes every real roster location to a garment view", () => {
    expect(rosterPreviewSideFor("Left Chest")).toBe("front");
    expect(rosterPreviewSideFor("Center Chest")).toBe("front");
    expect(rosterPreviewSideFor("Right Chest")).toBe("front");
    expect(rosterPreviewSideFor("Full Front")).toBe("front");
    expect(rosterPreviewSideFor("Upper Back")).toBe("back");
    expect(rosterPreviewSideFor("Full Back")).toBe("back");
    expect(rosterPreviewSideFor("Left Sleeve")).toBe("left");
    expect(rosterPreviewSideFor("Left Side Panel")).toBe("left");
    expect(rosterPreviewSideFor("Right Sleeve")).toBe("right");
    expect(rosterPreviewSideFor("Right Side Panel")).toBe("right");
  });

  it("puts 'Upper Back' on the back, not the front, despite naming a height", () => {
    expect(rosterPreviewSideFor("Upper Back")).toBe("back");
  });

  it("returns null for a location with no plate, rather than guessing", () => {
    expect(rosterPreviewSideFor("Inside Neck Label")).toBeNull();
    expect(rosterPreviewSideFor("")).toBeNull();
  });

  it("ignores case and stray whitespace", () => {
    expect(rosterPreviewSideFor("  full back  ")).toBe("back");
  });
});

describe("pixelsPerInch", () => {
  it("derives the scale from the 13-inch front plate", () => {
    const expected = (STUDIO_PRINT_AREAS.front.width * CANVAS) / 13;
    expect(pixelsPerInch(CANVAS)).toBeCloseTo(expected, 6);
    expect(FRONT_PLATE_WIDTH_INCHES).toBe(13);
  });

  it("scales linearly with the canvas", () => {
    expect(pixelsPerInch(2000)).toBeCloseTo(pixelsPerInch(1000) * 2, 6);
  });
});

describe("rosterPreviewPlacement", () => {
  it("sizes the text from the requested height in inches", () => {
    const two = rosterPreviewPlacement("Full Back", 2, CANVAS)!;
    const eight = rosterPreviewPlacement("Full Back", 8, CANVAS)!;
    expect(eight.fontSize).toBeCloseTo(two.fontSize * 4, 6);
    expect(two.fontSize).toBeCloseTo(2 * pixelsPerInch(CANVAS), 6);
  });

  it("never returns a font size that would vanish", () => {
    const tiny = rosterPreviewPlacement("Full Back", 0.001, CANVAS)!;
    expect(tiny.fontSize).toBeGreaterThanOrEqual(6);
  });

  it("offsets a left chest to the wearer's left and a right chest to the right", () => {
    const left = rosterPreviewPlacement("Left Chest", 2, CANVAS)!;
    const centre = rosterPreviewPlacement("Center Chest", 2, CANVAS)!;
    const right = rosterPreviewPlacement("Right Chest", 2, CANVAS)!;
    expect(left.centerX).toBeLessThan(centre.centerX);
    expect(right.centerX).toBeGreaterThan(centre.centerX);
  });

  it("sits an upper placement higher than a full-panel one on the same side", () => {
    const upper = rosterPreviewPlacement("Upper Back", 2, CANVAS)!;
    const full = rosterPreviewPlacement("Full Back", 2, CANVAS)!;
    expect(upper.centerY).toBeLessThan(full.centerY);
    expect(upper.side).toBe("back");
    expect(full.side).toBe("back");
  });

  it("keeps the placeholder inside the canvas", () => {
    for (const location of [
      "Left Chest",
      "Right Chest",
      "Full Front",
      "Full Back",
      "Left Sleeve",
      "Right Sleeve",
    ]) {
      const p = rosterPreviewPlacement(location, 3, CANVAS)!;
      expect(p.centerX).toBeGreaterThan(0);
      expect(p.centerX).toBeLessThan(CANVAS);
      expect(p.centerY).toBeGreaterThan(0);
      expect(p.centerY).toBeLessThan(CANVAS);
    }
  });

  it("returns null when the location has no plate", () => {
    expect(rosterPreviewPlacement("Inside Neck Label", 2, CANVAS)).toBeNull();
  });
});

describe("placeholderHaloFor", () => {
  it("puts a light halo behind dark ink and a dark halo behind light ink", () => {
    expect(placeholderHaloFor("#000000")).toBe("#ffffff");
    expect(placeholderHaloFor("#ffffff")).toBe("#111111");
  });

  it("handles shorthand hex and a leading hash either way", () => {
    expect(placeholderHaloFor("#000")).toBe("#ffffff");
    expect(placeholderHaloFor("fff")).toBe("#111111");
  });

  it("judges by luma, not by raw channel size", () => {
    // Pure green is bright to the eye; pure blue is not, despite both being
    // a single full channel.
    expect(placeholderHaloFor("#00ff00")).toBe("#111111");
    expect(placeholderHaloFor("#0000ff")).toBe("#ffffff");
  });

  it("falls back to a light halo for anything unparseable", () => {
    expect(placeholderHaloFor("rebeccapurple")).toBe("#ffffff");
    expect(placeholderHaloFor("")).toBe("#ffffff");
  });
});

describe("offset (drag fine-tune)", () => {
  it("does nothing when the offset is zero", () => {
    const base = rosterPreviewPlacement("Full Back", 2, CANVAS)!;
    const withZero = rosterPreviewPlacement("Full Back", 2, CANVAS, {
      xNorm: 0,
      yNorm: 0,
    })!;
    expect(withZero.centerX).toBeCloseTo(base.centerX, 6);
    expect(withZero.centerY).toBeCloseTo(base.centerY, 6);
  });

  it("moves the mark right and down for a positive offset", () => {
    const base = rosterPreviewPlacement("Full Back", 2, CANVAS)!;
    const moved = rosterPreviewPlacement("Full Back", 2, CANVAS, {
      xNorm: 0.2,
      yNorm: 0.2,
    })!;
    expect(moved.centerX).toBeGreaterThan(base.centerX);
    expect(moved.centerY).toBeGreaterThan(base.centerY);
  });

  it("clamps an out-of-range offset instead of placing the mark off the plate", () => {
    const extreme = rosterPreviewPlacement("Full Back", 2, CANVAS, {
      xNorm: 50,
      yNorm: -50,
    })!;
    const maxed = rosterPreviewPlacement("Full Back", 2, CANVAS, {
      xNorm: ROSTER_PREVIEW_OFFSET_LIMIT,
      yNorm: -ROSTER_PREVIEW_OFFSET_LIMIT,
    })!;
    expect(extreme.centerX).toBeCloseTo(maxed.centerX, 6);
    expect(extreme.centerY).toBeCloseTo(maxed.centerY, 6);
  });

  it("clampRosterPreviewOffset caps both directions", () => {
    expect(clampRosterPreviewOffset(5)).toBe(ROSTER_PREVIEW_OFFSET_LIMIT);
    expect(clampRosterPreviewOffset(-5)).toBe(-ROSTER_PREVIEW_OFFSET_LIMIT);
    expect(clampRosterPreviewOffset(0.1)).toBeCloseTo(0.1, 6);
  });
});

describe("rosterPreviewOffsetFromPosition", () => {
  it("round-trips with rosterPreviewPlacement: drop, then place, lands back at the drop", () => {
    for (const [x, y] of [
      [0.1, -0.15],
      [-0.3, 0.05],
      [0, 0],
    ]) {
      const placed = rosterPreviewPlacement("Full Back", 2, CANVAS, {
        xNorm: x!,
        yNorm: y!,
      })!;
      const offset = rosterPreviewOffsetFromPosition(
        "Full Back",
        CANVAS,
        placed.centerX,
        placed.centerY,
      )!;
      expect(offset.xNorm).toBeCloseTo(x!, 5);
      expect(offset.yNorm).toBeCloseTo(y!, 5);
    }
  });

  it("recovers a zero offset when dropped back on the default center", () => {
    const base = rosterPreviewPlacement("Left Chest", 2, CANVAS)!;
    const offset = rosterPreviewOffsetFromPosition(
      "Left Chest",
      CANVAS,
      base.centerX,
      base.centerY,
    )!;
    expect(offset.xNorm).toBeCloseTo(0, 6);
    expect(offset.yNorm).toBeCloseTo(0, 6);
  });

  it("clamps a drop far outside the plate rather than returning an unbounded offset", () => {
    const offset = rosterPreviewOffsetFromPosition(
      "Full Back",
      CANVAS,
      CANVAS * 50,
      -CANVAS * 50,
    )!;
    expect(offset.xNorm).toBe(ROSTER_PREVIEW_OFFSET_LIMIT);
    expect(offset.yNorm).toBe(-ROSTER_PREVIEW_OFFSET_LIMIT);
  });

  it("returns null for a location with no plate", () => {
    expect(
      rosterPreviewOffsetFromPosition("Inside Neck Label", CANVAS, 100, 100),
    ).toBeNull();
  });
});

describe("rosterActiveSides", () => {
  const decor = {
    names: { location: "Full Back", enabled: true },
    numbers: { location: "Full Back", enabled: true },
  };

  it("returns nothing when there is no active roster, regardless of settings", () => {
    expect(rosterActiveSides(decor, false)).toEqual([]);
  });

  it("returns the shared side once when names and numbers are on the same location", () => {
    expect(rosterActiveSides(decor, true)).toEqual(["back"]);
  });

  it("returns both sides when names and numbers are on different locations", () => {
    const split = {
      names: { location: "Left Chest", enabled: true },
      numbers: { location: "Full Back", enabled: true },
    };
    expect(rosterActiveSides(split, true).sort()).toEqual(["back", "front"]);
  });

  it("excludes a disabled mark's side — this is the '+ Names' / '+ Numbers' checkbox", () => {
    const namesOff = {
      names: { location: "Left Chest", enabled: false },
      numbers: { location: "Full Back", enabled: true },
    };
    expect(rosterActiveSides(namesOff, true)).toEqual(["back"]);
  });

  it("returns nothing when both marks are disabled", () => {
    const bothOff = {
      names: { location: "Left Chest", enabled: false },
      numbers: { location: "Full Back", enabled: false },
    };
    expect(rosterActiveSides(bothOff, true)).toEqual([]);
  });
});
