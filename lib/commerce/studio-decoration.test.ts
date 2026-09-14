import { describe, expect, it } from "vitest";
import { emptyDesignDocument, type SideDecoration } from "@gwg/contracts";
import {
  allowedDesignSides,
  decorationLinesForPricing,
  filterAllowedMethods,
  resolveArtworkDecoration,
  resolveSideDecoration,
  withArtworkDecoration,
  withSideDecoration,
} from "./studio-decoration";

/** A design with `count` logos on one side, ids "a1", "a2", ... */
function withArtworks(side: "front" | "back", count: number) {
  const document = emptyDesignDocument();
  return {
    ...document,
    artworksBySide: {
      ...document.artworksBySide,
      [side]: Array.from({ length: count }, (_, i) => ({
        id: `a${i + 1}`,
        src: `logo-${i + 1}.png`,
        x: 0,
        y: 0,
        scaleX: 1,
        scaleY: 1,
        rotation: 0,
      })),
    },
  };
}

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
    // Lines now carry an id as well, so two prints on one side stay
    // separately attributable in the breakdown (row 60).
    expect(lines).toEqual([
      { id: "front:screenPrint", location: "front", methodKey: "screenPrint", colours: 2, stitchCount: undefined, optionKey: undefined },
      { id: "left:embroidery", location: "left", methodKey: "embroidery", colours: undefined, stitchCount: 5000, optionKey: undefined },
    ]);
  });

  it("falls back to the studio default for a decorated side with no explicit choice", () => {
    const document = emptyDesignDocument();
    const lines = decorationLinesForPricing(document, ["front"], FALLBACK);
    expect(lines).toEqual([
      {
        id: "front:screenPrint",
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


/**
 * CodSphere UAT V2 row 59: "When decoration and decoration details is
 * changed for an artwork, any other logo/artwork is also changed. They
 * should be independent of each other."
 */
describe("row 59 - each logo owns its decoration", () => {
  it("changing one logo leaves the other alone", () => {
    let document = withArtworks("front", 2);
    document = withArtworkDecoration(
      document,
      "front",
      "a1",
      { colours: 4 },
      FALLBACK,
    );
    expect(
      resolveArtworkDecoration(document, "front", "a1", FALLBACK).colours,
    ).toBe(4);
    expect(
      resolveArtworkDecoration(document, "front", "a2", FALLBACK).colours,
    ).toBe(FALLBACK.colours);
  });

  it("changing the method on one logo leaves the other's method alone", () => {
    let document = withArtworks("front", 2);
    document = withArtworkDecoration(
      document,
      "front",
      "a1",
      { methodKey: "embroidery" },
      FALLBACK,
    );
    expect(
      resolveArtworkDecoration(document, "front", "a1", FALLBACK).methodKey,
    ).toBe("embroidery");
    expect(
      resolveArtworkDecoration(document, "front", "a2", FALLBACK).methodKey,
    ).toBe("screenPrint");
  });

  it("merges rather than replacing, so a method survives a colour change", () => {
    let document = withArtworks("front", 1);
    document = withArtworkDecoration(
      document,
      "front",
      "a1",
      { methodKey: "embroidery" },
      FALLBACK,
    );
    document = withArtworkDecoration(
      document,
      "front",
      "a1",
      { colours: 3 },
      FALLBACK,
    );
    const resolved = resolveArtworkDecoration(document, "front", "a1", FALLBACK);
    expect(resolved.methodKey).toBe("embroidery");
    expect(resolved.colours).toBe(3);
  });

  it("does not mutate the document it was given", () => {
    const document = withArtworks("front", 1);
    withArtworkDecoration(document, "front", "a1", { colours: 9 }, FALLBACK);
    expect(document.artworksBySide.front[0]!.decoration).toBeUndefined();
  });

  it("falls back to the side, then the default, for a logo with no choice", () => {
    // This is every design saved before row 59 - no migration required.
    let document = withArtworks("front", 1);
    document = withSideDecoration(document, "front", { colours: 5 }, FALLBACK);
    expect(
      resolveArtworkDecoration(document, "front", "a1", FALLBACK).colours,
    ).toBe(5);
  });
});

/**
 * Row 60: "When multiple artwork/layers are uploaded in 1 location, price
 * should reflect the total number of colours... 2 separate logos each with a
 * 1 colour logo... should have been reflecting a 2 colour logo."
 */
describe("row 60 - colours sum within a location", () => {
  it("prices two one-colour logos on one side as a two-colour print", () => {
    let document = withArtworks("front", 2);
    document = withArtworkDecoration(document, "front", "a1", { colours: 1 }, FALLBACK);
    document = withArtworkDecoration(document, "front", "a2", { colours: 1 }, FALLBACK);
    const lines = decorationLinesForPricing(document, ["front"], FALLBACK);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.colours).toBe(2);
  });

  it("sums unequal colour counts", () => {
    let document = withArtworks("front", 2);
    document = withArtworkDecoration(document, "front", "a1", { colours: 3 }, FALLBACK);
    document = withArtworkDecoration(document, "front", "a2", { colours: 2 }, FALLBACK);
    expect(
      decorationLinesForPricing(document, ["front"], FALLBACK)[0]!.colours,
    ).toBe(5);
  });

  it("splits a location into one line per method", () => {
    // Screen print and embroidery on the same side are two jobs on the floor.
    let document = withArtworks("front", 2);
    document = withArtworkDecoration(document, "front", "a1", { colours: 2 }, FALLBACK);
    document = withArtworkDecoration(
      document,
      "front",
      "a2",
      { methodKey: "embroidery" },
      FALLBACK,
    );
    const lines = decorationLinesForPricing(document, ["front"], FALLBACK);
    expect(lines).toHaveLength(2);
    expect(new Set(lines.map((l) => l.methodKey))).toEqual(
      new Set(["screenPrint", "embroidery"]),
    );
  });

  it("gives each line on a side its own id so costs stay attributable", () => {
    let document = withArtworks("front", 2);
    document = withArtworkDecoration(
      document,
      "front",
      "a2",
      { methodKey: "embroidery" },
      FALLBACK,
    );
    const ids = decorationLinesForPricing(document, ["front"], FALLBACK).map(
      (l) => l.id,
    );
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("still prices a side that carries text but no artwork", () => {
    const document = emptyDesignDocument();
    const lines = decorationLinesForPricing(document, ["front"], FALLBACK);
    expect(lines).toHaveLength(1);
    expect(lines[0]!.methodKey).toBe("screenPrint");
  });

  it("prices each decorated side separately", () => {
    let document = withArtworks("front", 2);
    document = withArtworkDecoration(document, "front", "a1", { colours: 1 }, FALLBACK);
    document = withArtworkDecoration(document, "front", "a2", { colours: 1 }, FALLBACK);
    const lines = decorationLinesForPricing(document, ["front", "back"], FALLBACK);
    expect(lines.map((l) => l.location)).toEqual(["front", "back"]);
    expect(lines[0]!.colours).toBe(2);
    expect(lines[1]!.colours).toBe(FALLBACK.colours);
  });
});
