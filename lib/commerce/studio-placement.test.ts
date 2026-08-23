import { describe, expect, it } from "vitest";
import {
  cartPlacementSuffix,
  cartPrintMetaLabel,
  decoratedDesignSides,
} from "./studio-placement";
import { defaultPlacementBySide } from "@gwg/contracts";

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
