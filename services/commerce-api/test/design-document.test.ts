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
    };
    expect(normalizeDesignDocument(toStoredDesignDocument(before))).toEqual(
      before,
    );
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
