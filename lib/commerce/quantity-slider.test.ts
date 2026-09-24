import { describe, expect, it } from "vitest";
import {
  qtyFromSliderPosition,
  sliderMaxPosition,
  sliderPositionFromQty,
} from "@/lib/commerce/quantity-slider";

// The actual tick row the client saw: 1 · 6 · 12 · 24 · 48 · 72 · "500+",
// where the last entry stands in for the open-ended bucket beyond it.
const ANCHORS = [1, 6, 12, 24, 48, 72, 1000];

describe("sliderPositionFromQty", () => {
  it("puts every anchor at its own even fraction of the track — the same fraction flex justify-between renders its label at", () => {
    const max = sliderMaxPosition(ANCHORS);
    ANCHORS.forEach((qty, i) => {
      const expected = Math.round((i / (ANCHORS.length - 1)) * max);
      expect(sliderPositionFromQty(qty, ANCHORS)).toBe(expected);
    });
  });

  it("no longer drops the handle under the '6' label for 71 or 81 pieces", () => {
    const max = sliderMaxPosition(ANCHORS);
    const sixPosition = sliderPositionFromQty(6, ANCHORS);
    const pos71 = sliderPositionFromQty(71, ANCHORS);
    const pos81 = sliderPositionFromQty(81, ANCHORS);
    // 71 and 81 sit between the 48 and 72 anchors, nowhere near 6.
    expect(pos71).toBeGreaterThan(sliderPositionFromQty(48, ANCHORS));
    expect(pos71).toBeLessThan(sliderPositionFromQty(72, ANCHORS));
    expect(pos81).toBeGreaterThan(pos71);
    expect(pos71 - sixPosition).toBeGreaterThan(max * 0.1);
  });

  it("interpolates between two anchors", () => {
    // Midway between 48 and 72 is 60.
    const posLo = sliderPositionFromQty(48, ANCHORS);
    const posHi = sliderPositionFromQty(72, ANCHORS);
    const posMid = sliderPositionFromQty(60, ANCHORS);
    expect(posMid).toBeCloseTo((posLo + posHi) / 2, -1);
  });

  it("clamps below the first anchor and at/above the last", () => {
    expect(sliderPositionFromQty(0, ANCHORS)).toBe(0);
    expect(sliderPositionFromQty(1, ANCHORS)).toBe(0);
    expect(sliderPositionFromQty(1000, ANCHORS)).toBe(sliderMaxPosition(ANCHORS));
    expect(sliderPositionFromQty(50_000, ANCHORS)).toBe(sliderMaxPosition(ANCHORS));
  });

  it("never divides by zero with a single anchor or an empty list", () => {
    expect(sliderPositionFromQty(48, [24])).toBe(0);
    expect(sliderPositionFromQty(48, [])).toBe(0);
    expect(sliderMaxPosition([24])).toBeGreaterThan(0);
    expect(sliderMaxPosition([])).toBeGreaterThan(0);
  });
});

describe("qtyFromSliderPosition", () => {
  it("round-trips every anchor exactly", () => {
    ANCHORS.forEach((qty) => {
      const position = sliderPositionFromQty(qty, ANCHORS);
      expect(qtyFromSliderPosition(position, ANCHORS)).toBe(qty);
    });
  });

  it("round-trips arbitrary values within a segment (rounding aside)", () => {
    for (const qty of [2, 9, 20, 40, 60, 71, 81, 90]) {
      const position = sliderPositionFromQty(qty, ANCHORS);
      const back = qtyFromSliderPosition(position, ANCHORS);
      expect(Math.abs(back - qty)).toBeLessThanOrEqual(1);
    }
  });

  it("clamps position outside the track", () => {
    expect(qtyFromSliderPosition(-500, ANCHORS)).toBe(ANCHORS[0]);
    expect(qtyFromSliderPosition(sliderMaxPosition(ANCHORS) + 999, ANCHORS)).toBe(
      ANCHORS[ANCHORS.length - 1],
    );
  });

  it("never divides by zero with a single anchor or an empty list", () => {
    expect(qtyFromSliderPosition(500, [24])).toBe(24);
    expect(qtyFromSliderPosition(500, [])).toBe(1);
  });
});
