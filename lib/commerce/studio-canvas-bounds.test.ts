import { describe, expect, it } from "vitest";
import {
  clampAxis,
  keepDraggedNodeOnCanvas,
  overflowPx,
  resizeWouldPushOffCanvas,
  type CanvasBounds,
  type MeasurableNode,
} from "./studio-canvas-bounds";

const canvas: CanvasBounds = { min: 0, max: 400 };

/** A node whose visible box starts `offset` from its origin. */
function node(
  origin: { x: number; y: number },
  box: { dx?: number; dy?: number; width: number; height: number },
): MeasurableNode {
  return {
    getAbsolutePosition: () => origin,
    getClientRect: () => ({
      x: origin.x + (box.dx ?? 0),
      y: origin.y + (box.dy ?? 0),
      width: box.width,
      height: box.height,
    }),
  };
}

describe("clampAxis", () => {
  it("leaves a position that is already inside", () => {
    expect(clampAxis(100, 0, 80, canvas)).toBe(100);
  });

  it("stops a small logo at the left edge, not 24 px short of vanishing", () => {
    // The old guard allowed an origin as far left as -(canvas) + 24, which put
    // an 80 px logo completely off the canvas.
    expect(clampAxis(-300, 0, 80, canvas)).toBe(0);
  });

  it("stops a logo at the right edge using its own width", () => {
    expect(clampAxis(390, 0, 80, canvas)).toBe(320);
  });

  it("allows for artwork whose visible edge is offset from its origin", () => {
    // Rotated artwork: the visible box begins 30 px left of the origin.
    expect(clampAxis(-50, -30, 100, canvas)).toBe(30);
    expect(clampAxis(500, -30, 100, canvas)).toBe(330);
  });

  it("holds artwork larger than the canvas so that it covers the canvas", () => {
    // 500 px wide on a 400 px canvas: anywhere from fully flush right to flush left.
    expect(clampAxis(50, 0, 500, canvas)).toBe(0);
    expect(clampAxis(-900, 0, 500, canvas)).toBe(-100);
  });

  it("uses the canvas span, not 0 to the stage size, once zoomed", () => {
    const zoomed: CanvasBounds = { min: -100, max: 500 };
    expect(clampAxis(-400, 0, 80, zoomed)).toBe(-100);
    expect(clampAxis(900, 0, 80, zoomed)).toBe(420);
  });
});

describe("keepDraggedNodeOnCanvas", () => {
  it("clamps both axes using the node's real size", () => {
    const logo = node({ x: 100, y: 100 }, { width: 80, height: 60 });
    expect(keepDraggedNodeOnCanvas(logo, { x: -500, y: 900 }, canvas)).toEqual({
      x: 0,
      y: 340,
    });
  });

  it("passes a position that is already fine through unchanged", () => {
    const logo = node({ x: 100, y: 100 }, { width: 80, height: 60 });
    expect(keepDraggedNodeOnCanvas(logo, { x: 120, y: 90 }, canvas)).toEqual({
      x: 120,
      y: 90,
    });
  });
});

describe("overflowPx / resizeWouldPushOffCanvas", () => {
  it("counts nothing for a box inside the canvas", () => {
    expect(overflowPx({ x: 10, y: 10, width: 100, height: 100 }, canvas)).toBe(0);
  });

  it("adds up what hangs over each side", () => {
    expect(overflowPx({ x: -10, y: 380, width: 50, height: 50 }, canvas)).toBe(
      10 + 30,
    );
  });

  it("refuses a resize that grows past the edge", () => {
    const old = { x: 300, y: 100, width: 80, height: 80 };
    const bigger = { x: 300, y: 100, width: 140, height: 140 };
    expect(resizeWouldPushOffCanvas(old, bigger, canvas)).toBe(true);
  });

  it("allows a resize that stays inside", () => {
    const old = { x: 100, y: 100, width: 80, height: 80 };
    expect(
      resizeWouldPushOffCanvas(old, { x: 90, y: 90, width: 120, height: 120 }, canvas),
    ).toBe(false);
  });

  it("lets artwork that already overhangs be shrunk, so it is never frozen", () => {
    const overhanging = { x: 350, y: 100, width: 120, height: 120 };
    const smaller = { x: 350, y: 100, width: 90, height: 90 };
    expect(resizeWouldPushOffCanvas(overhanging, smaller, canvas)).toBe(false);
  });
});
