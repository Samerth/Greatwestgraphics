import { describe, expect, it } from "vitest";
import { decorationSummary } from "@/lib/commerce/decoration-summary";

const METHODS = [
  { key: "screenPrint", label: "Screen Print" },
  { key: "embroidery", label: "Embroidery" },
  { key: "dtf", label: "DTF" },
];

describe("decorationSummary", () => {
  it("names the colour count and location for a screen print", () => {
    expect(
      decorationSummary(
        [{ methodKey: "screenPrint", location: "front", colours: 1 }],
        METHODS,
      ),
    ).toBe("Includes a 1-colour screen print on the front.");
  });

  it("tracks a colour count the customer changed", () => {
    expect(
      decorationSummary(
        [{ methodKey: "screenPrint", location: "back", colours: 3 }],
        METHODS,
      ),
    ).toBe("Includes a 3-colour screen print on the back.");
  });

  it("names the embroidery tier rather than a colour count", () => {
    expect(
      decorationSummary(
        [{ methodKey: "embroidery", location: "leftChest", stitchPreset: "small" }],
        METHODS,
      ),
    ).toBe("Includes small logo embroidery on the left chest.");
  });

  it("keeps an acronym's capitals but folds a title-cased label", () => {
    expect(decorationSummary([{ methodKey: "dtf", location: "front" }], METHODS)).toBe(
      "Includes a DTF print on the front.",
    );
  });

  it("joins two decorations", () => {
    expect(
      decorationSummary(
        [
          { methodKey: "screenPrint", location: "front", colours: 2 },
          { methodKey: "embroidery", location: "sleeve", stitchPreset: "medium" },
        ],
        METHODS,
      ),
    ).toBe(
      "Includes a 2-colour screen print on the front and medium logo embroidery on the sleeve.",
    );
  });

  it("counts rather than lists once there are three or more", () => {
    expect(
      decorationSummary(
        [
          { methodKey: "screenPrint", location: "front", colours: 1 },
          { methodKey: "screenPrint", location: "back", colours: 1 },
          { methodKey: "embroidery", location: "sleeve", stitchPreset: "small" },
        ],
        METHODS,
      ),
    ).toBe("Includes 3 decorations.");
  });

  it("says nothing when there is nothing to say", () => {
    expect(decorationSummary([], METHODS)).toBeNull();
    // A method that isn't in the published config can't be described, and a
    // half-written sentence is worse than none.
    expect(
      decorationSummary([{ methodKey: "sublimation", location: "front" }], METHODS),
    ).toBeNull();
  });

  it("drops an unknown location rather than inventing one", () => {
    expect(
      decorationSummary(
        [{ methodKey: "screenPrint", location: "kneecap", colours: 1 }],
        METHODS,
      ),
    ).toBe("Includes a 1-colour screen print.");
  });
});
