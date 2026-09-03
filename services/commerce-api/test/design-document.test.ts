import { describe, expect, it } from "vitest";
import {
  assertDesignDocumentDurable,
  DESIGN_PLACEMENT_ZONES,
  DesignSides,
  DesignProjectWriteSchema,
  designDocumentHasArtwork,
  emptyDesignDocument,
  EphemeralArtworkError,
  ephemeralArtworkSides,
  isDurableArtworkSrc,
  normalizeDesignDocument,
  toStoredDesignDocument,
  type DesignDocument,
  type PlacedArtwork,
} from "@gwg/contracts";
import { designProjectPatch } from "../src/application/design-project-service.js";

const layer = (overrides: Partial<PlacedArtwork> = {}): PlacedArtwork => ({
  id: "layer-1",
  src: "https://cdn.example.com/designs/logo.png",
  x: 170,
  y: 170,
  scaleX: 0.4,
  scaleY: 0.4,
  rotation: 0,
  ...overrides,
});

describe("normalizeDesignDocument", () => {
  it("gives an unsaved design every side with a default placement", () => {
    const document = normalizeDesignDocument(null);
    expect(Object.keys(document.artworksBySide).sort()).toEqual(
      [...DesignSides].sort(),
    );
    expect(document.placementBySide.front).toBe("Center Chest");
    expect(DESIGN_PLACEMENT_ZONES.front).toContain("Right Chest");
    expect(document.placementBySide.right).toBe(
      DESIGN_PLACEMENT_ZONES.right[0],
    );
    expect(designDocumentHasArtwork(document)).toBe(false);
  });

  it("reads a legacy bare artwork map and lands its lone side on the left sleeve", () => {
    const document = normalizeDesignDocument({
      front: [layer({ id: "f" })],
      back: [],
      side: [layer({ id: "s" })],
    });
    expect(document.artworksBySide.front.map((a) => a.id)).toEqual(["f"]);
    expect(document.artworksBySide.left.map((a) => a.id)).toEqual(["s"]);
    expect(document.artworksBySide.right).toEqual([]);
  });

  it("keeps both buckets when a row was written mid-migration", () => {
    const document = normalizeDesignDocument({
      artworksBySide: {
        left: [layer({ id: "new" })],
        side: [layer({ id: "old" })],
      },
    });
    expect(document.artworksBySide.left.map((a) => a.id)).toEqual([
      "new",
      "old",
    ]);
  });

  it("round-trips a document through the columns it is stored in", () => {
    const before: DesignDocument = {
      ...emptyDesignDocument(),
      artworksBySide: {
        front: [layer({ id: "chest" })],
        back: [],
        left: [layer({ id: "sleeve", x: 12, rotation: 45 })],
        right: [],
      },
      placementBySide: {
        front: "Full Front",
        back: "Upper Back",
        left: "Left Sleeve",
        right: "Right Side Panel",
      },
      textsBySide: {
        front: [
          {
            id: "word",
            text: "Hawks",
            x: 80,
            y: 90,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            fontFamily: "arial",
            fontSize: 28,
            fill: "#111111",
            align: "center",
            printMethod: "print",
          },
        ],
        back: [],
        left: [],
        right: [],
      },
      notes: "Keep the white ink bright.",
    };
    expect(normalizeDesignDocument(toStoredDesignDocument(before))).toEqual(
      before,
    );
  });

  it("round-trips a per-side decoration selection (method + pricing input independent per location)", () => {
    const before: DesignDocument = {
      ...emptyDesignDocument(),
      artworksBySide: {
        front: [layer({ id: "chest" })],
        back: [],
        left: [layer({ id: "sleeve" })],
        right: [],
      },
      decorationsBySide: {
        front: { methodKey: "screenPrint", colours: 3 },
        back: undefined,
        left: { methodKey: "embroidery", stitchPreset: "small" },
        right: undefined,
      },
    };
    expect(normalizeDesignDocument(toStoredDesignDocument(before))).toEqual(
      before,
    );
  });

  it("leaves every side's decoration undefined for an unsaved design, and for a legacy row with no decorationsBySide at all", () => {
    expect(normalizeDesignDocument(null).decorationsBySide).toEqual({
      front: undefined,
      back: undefined,
      left: undefined,
      right: undefined,
    });
    expect(
      normalizeDesignDocument({ front: [layer({ id: "legacy" })] })
        .decorationsBySide,
    ).toEqual({ front: undefined, back: undefined, left: undefined, right: undefined });
  });

  it("drops a malformed side decoration instead of failing the whole document", () => {
    const document = normalizeDesignDocument({
      artworksBySide: { front: [], back: [], left: [], right: [] },
      decorationsBySide: {
        front: { methodKey: "" }, // fails min(1) — dropped
        back: { methodKey: "dtf", colours: "not-a-number" },
        left: { methodKey: "embroidery", stitchPreset: "small" }, // valid
      },
    });
    expect(document.decorationsBySide.front).toBeUndefined();
    expect(document.decorationsBySide.back).toBeUndefined();
    expect(document.decorationsBySide.left).toEqual({
      methodKey: "embroidery",
      stitchPreset: "small",
    });
  });

  it("fills missing text / notes / roster fields so older rows still load", () => {
    const document = normalizeDesignDocument({
      front: [layer({ id: "legacy" })],
    });
    expect(document.textsBySide).toEqual({
      front: [],
      back: [],
      left: [],
      right: [],
    });
    expect(document.notes).toBe("");
    // Both default to the same location now — matching Coastal Reign's own
    // default ("Back" / "Back") and closing real UAT confusion where
    // independently-configurable defaults split Names and Numbers across
    // two different sides with nothing on screen explaining why.
    expect(document.rosterDecor.names.location).toBe("Full Back");
    expect(document.rosterDecor.numbers.location).toBe("Full Back");
    expect(designDocumentHasArtwork(document)).toBe(true);
  });

  it("treats a text-only design as having artwork for save / cart gates", () => {
    const document = normalizeDesignDocument({
      textsBySide: {
        front: [
          {
            id: "t",
            text: "A",
            x: 1,
            y: 1,
            scaleX: 1,
            scaleY: 1,
            rotation: 0,
            fontFamily: "arial",
            fontSize: 20,
            fill: "#000",
            align: "left",
            printMethod: "embroidery",
          },
        ],
      },
    });
    expect(designDocumentHasArtwork(document)).toBe(true);
    expect(document.textsBySide.front[0]?.printMethod).toBe("embroidery");
  });

  it("falls back to the first zone when a placement is not one this side offers", () => {
    const document = normalizeDesignDocument({
      artworksBySide: {},
      placementBySide: { front: "Upper Back", back: "Full Back" },
    });
    expect(document.placementBySide.front).toBe("Left Chest");
    expect(document.placementBySide.back).toBe("Full Back");
  });

  it("drops a malformed layer rather than losing the rest of the design", () => {
    const document = normalizeDesignDocument({
      front: [layer({ id: "good" }), { id: "bad", src: "x" }, "nonsense"],
    });
    expect(document.artworksBySide.front.map((a) => a.id)).toEqual(["good"]);
  });

  it("degrades unrecognised json to an empty design instead of throwing", () => {
    expect(designDocumentHasArtwork(normalizeDesignDocument("wat"))).toBe(false);
    expect(designDocumentHasArtwork(normalizeDesignDocument(42))).toBe(false);
  });
});

describe("artwork durability", () => {
  it("treats hosted urls as durable and tab-scoped ones as not", () => {
    expect(isDurableArtworkSrc("https://cdn.example.com/a.png")).toBe(true);
    expect(isDurableArtworkSrc("/uploads/designs/a.png")).toBe(true);
    expect(isDurableArtworkSrc("blob:http://localhost/abc")).toBe(false);
    expect(isDurableArtworkSrc("BLOB:http://localhost/abc")).toBe(false);
    expect(isDurableArtworkSrc("data:image/png;base64,iVBOR")).toBe(false);
    expect(isDurableArtworkSrc("   ")).toBe(false);
  });

  it("names every side holding artwork that would not survive a reload", () => {
    const document: DesignDocument = {
      ...emptyDesignDocument(),
      artworksBySide: {
        front: [layer()],
        back: [layer({ src: "blob:http://localhost/1" })],
        left: [],
        right: [layer({ src: "data:image/png;base64,AAA" })],
      },
    };
    expect(ephemeralArtworkSides(document)).toEqual(["back", "right"]);
  });

  it("refuses a save that would reload blank", () => {
    const document: DesignDocument = {
      ...emptyDesignDocument(),
      artworksBySide: {
        front: [layer({ src: "blob:http://localhost/1" })],
        back: [],
        left: [],
        right: [],
      },
    };
    expect(() => assertDesignDocumentDurable(document)).toThrowError(
      EphemeralArtworkError,
    );
    expect(() => assertDesignDocumentDurable(emptyDesignDocument())).not.toThrow();
  });
});

describe("DesignProjectWriteSchema", () => {
  it("rejects a proof image that is really an inlined data url", () => {
    expect(
      DesignProjectWriteSchema.safeParse({
        proofImageUrl: "data:image/png;base64,AAAA",
      }).success,
    ).toBe(false);
    expect(
      DesignProjectWriteSchema.safeParse({
        proofImageUrl: "https://cdn.example.com/proof.png",
      }).success,
    ).toBe(true);
    expect(
      DesignProjectWriteSchema.safeParse({ proofImageUrl: null }).success,
    ).toBe(true);
  });
});

describe("designProjectPatch", () => {
  it("leaves untouched fields out so a rename cannot blank the artwork", () => {
    expect(designProjectPatch({ name: "Staff hoodie" })).toEqual({
      name: "Staff hoodie",
    });
  });

  it("distinguishes clearing the garment from not mentioning it", () => {
    expect(designProjectPatch({ garmentProductId: null })).toEqual({
      garmentProductId: null,
    });
    expect(designProjectPatch({})).toEqual({});
  });

  it("accepts a legacy client that still sends a bare artwork map", () => {
    const patch = designProjectPatch({
      artworksBySide: { front: [layer({ id: "legacy" })] },
    });
    expect(patch.design?.artworksBySide.front.map((a) => a.id)).toEqual([
      "legacy",
    ]);
  });

  it("prefers the current document when a client sends both shapes", () => {
    const patch = designProjectPatch({
      design: {
        artworksBySide: { front: [layer({ id: "current" })] },
      },
      artworksBySide: { front: [layer({ id: "legacy" })] },
    });
    expect(patch.design?.artworksBySide.front.map((a) => a.id)).toEqual([
      "current",
    ]);
  });
});

describe("designDocumentHasArtwork counts a real roster", () => {
  // A customer who named their whole team and added no separate logo has
  // absolutely built a design. Before this, every "is there an active
  // design" check in the app — restoring a returning visitor's draft,
  // persisting it, carrying it from the studio into Input Quantity, the
  // step bar — went through this one function and all silently disagreed:
  // a names-only design could never leave the studio, and if it somehow
  // had, would have lost its own roster on the very next page.
  it("is true once a roster row has a real name, with no artwork at all", () => {
    const document = normalizeDesignDocument({
      artworksBySide: { front: [], back: [], left: [], right: [] },
      roster: [{ size: "", name: "kartik", number: "7" }],
    });
    expect(designDocumentHasArtwork(document)).toBe(true);
  });

  it("is true from a number alone, with no name entered yet", () => {
    const document = normalizeDesignDocument({
      artworksBySide: { front: [], back: [], left: [], right: [] },
      roster: [{ size: "", name: "", number: "7" }],
    });
    expect(designDocumentHasArtwork(document)).toBe(true);
  });

  it("stays false for the blank starter row every fresh roster begins with", () => {
    const document = normalizeDesignDocument({
      artworksBySide: { front: [], back: [], left: [], right: [] },
      roster: [{ size: "", name: "", number: "" }],
    });
    expect(designDocumentHasArtwork(document)).toBe(false);
  });

  it("stays false with no roster field at all — matches the pre-roster shape", () => {
    const document = normalizeDesignDocument({
      artworksBySide: { front: [], back: [], left: [], right: [] },
    });
    expect(designDocumentHasArtwork(document)).toBe(false);
  });
});
