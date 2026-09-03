import { describe, expect, it } from "vitest";
import { emptyDesignDocument, type SideDecoration } from "@gwg/contracts";
import {
  allowedDesignSides,
  decorationLinesForPricing,
  filterAllowedMethods,
  resolveSideDecoration,
  withSideDecoration,
} from "./studio-decoration";

const FALLBACK: SideDecoration = {
  methodKey: "screenPrint",
  colours: 1,
  stitchPreset: "medium",
  optionKey: "medium",
};

describe("resolveSideDecoration", () => {
  it("falls back to the studio-wide default when the side has no explicit choice", () => {
    const document = emptyDesignDocument();
    expect(resolveSideDecoration(document, "front", FALLBACK)).toEqual(FALLBACK);
  });

  it("returns the side's own explicit choice once one exists", () => {
    const document = {
      ...emptyDesignDocument(),
      decorationsBySide: {
        ...emptyDesignDocument().decorationsBySide,
        front: { methodKey: "embroidery", stitchPreset: "large" },
      },
    };
    expect(resolveSideDecoration(document, "front", FALLBACK)).toEqual({
      methodKey: "embroidery",
      stitchPreset: "large",
    });
    // An untouched side still falls back.
    expect(resolveSideDecoration(document, "back", FALLBACK)).toEqual(FALLBACK);
  });
});

describe("withSideDecoration", () => {
  it("merges a patch over the resolved fallback rather than replacing it outright", () => {
    const document = emptyDesignDocument();
    const next = withSideDecoration(document, "front", { colours: 3 }, FALLBACK);
    expect(next.decorationsBySide.front).toEqual({ ...FALLBACK, colours: 3 });
    // Other sides untouched.
    expect(next.decorationsBySide.back).toBeUndefined();
  });

  it("merges a patch over the side's own prior explicit choice", () => {
    const document = {
      ...emptyDesignDocument(),
      decorationsBySide: {
        ...emptyDesignDocument().decorationsBySide,
        front: { methodKey: "embroidery", stitchPreset: "small" as const },
      },
    };
    const next = withSideDecoration(
      document,
      "front",
      { stitchPreset: "large" },
      FALLBACK,
    );
    expect(next.decorationsBySide.front).toEqual({
      methodKey: "embroidery",
      stitchPreset: "large",
    });
  });

  it("does not mutate the original document", () => {
    const document = emptyDesignDocument();
    withSideDecoration(document, "front", { colours: 2 }, FALLBACK);
    expect(document.decorationsBySide.front).toBeUndefined();
  });
});

describe("decorationLinesForPricing", () => {
  it("builds one priceable line per decorated side, each carrying its own method", () => {
    const document = {
      ...emptyDesignDocument(),
      decorationsBySide: {
        front: { methodKey: "screenPrint", colours: 2 },
        back: undefined,
        left: { methodKey: "embroidery", stitchPreset: "small" as const },
        right: undefined,
      },
    };
    const lines = decorationLinesForPricing(document, ["front", "left"], FALLBACK);
    expect(lines).toEqual([
      { location: "front", methodKey: "screenPrint", colours: 2, stitchCount: undefined, optionKey: undefined },
      { location: "left", methodKey: "embroidery", colours: undefined, stitchCount: 5000, optionKey: undefined },
    ]);
  });

  it("falls back to the studio default for a decorated side with no explicit choice", () => {
    const document = emptyDesignDocument();
    const lines = decorationLinesForPricing(document, ["front"], FALLBACK);
    expect(lines).toEqual([
      {
        location: "front",
        methodKey: "screenPrint",
        colours: 1,
        stitchCount: 10000,
        optionKey: "medium",
      },
    ]);
  });
});

describe("filterAllowedMethods", () => {
  const methods = [
    { key: "screenPrint", label: "Screen Print" },
    { key: "embroidery", label: "Embroidery" },
    { key: "dtf", label: "DTF" },
  ];

  it("keeps every method when unrestricted (null or empty)", () => {
    expect(filterAllowedMethods(methods, null)).toEqual(methods);
    expect(filterAllowedMethods(methods, undefined)).toEqual(methods);
    expect(filterAllowedMethods(methods, [])).toEqual(methods);
  });

  it("narrows down to the admin allow-list — e.g. Hats: no Screen Print", () => {
    expect(filterAllowedMethods(methods, ["embroidery"])).toEqual([
      { key: "embroidery", label: "Embroidery" },
    ]);
  });
});

describe("allowedDesignSides", () => {
  it("allows every side when unrestricted (null or empty)", () => {
    expect(allowedDesignSides(null)).toBeNull();
    expect(allowedDesignSides(undefined)).toBeNull();
    expect(allowedDesignSides([])).toBeNull();
  });

  it("Bags: front/back only, no sleeve sides", () => {
    expect(allowedDesignSides(["front", "back"])).toEqual(["front", "back"]);
  });

  it("opens both sleeve sides from one generic 'sleeve' location", () => {
    expect(allowedDesignSides(["sleeve"])).toEqual(["left", "right"]);
  });

  it("opens the front from 'leftChest' even without 'front' in the list", () => {
    expect(allowedDesignSides(["leftChest"])).toEqual(["front"]);
  });

  it("combines all four sides for the T-Shirt/Hoodie example", () => {
    expect(allowedDesignSides(["front", "back", "leftChest", "sleeve"])).toEqual([
      "front",
      "back",
      "left",
      "right",
    ]);
  });
});
