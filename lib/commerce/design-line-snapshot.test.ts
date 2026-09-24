import { describe, expect, it } from "vitest";
import { emptyDesignDocument, type DesignDocument, type PlacedArtwork } from "@gwg/contracts";
import {
  designSnapshotFromConfiguration,
  designSnapshotHeroSide,
  designSnapshotIsUsable,
} from "./design-line-snapshot";

const artwork = (overrides: Partial<PlacedArtwork> = {}): PlacedArtwork => ({
  id: "art-1",
  src: "https://cdn.example.com/logo.png",
  x: 10,
  y: 10,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  ...overrides,
});

function withFrontArtwork(src: string): DesignDocument {
  const doc = emptyDesignDocument();
  return {
    ...doc,
    artworksBySide: { ...doc.artworksBySide, front: [artwork({ src })] },
  };
}

describe("designSnapshotIsUsable", () => {
  it("is usable once a hosted artwork file sits on a decorated side", () => {
    expect(designSnapshotIsUsable(withFrontArtwork("https://cdn.example.com/logo.png"))).toBe(
      true,
    );
  });

  it("is not usable while any artwork is still a blob URL — a per-tab handle a reload cannot resolve", () => {
    expect(designSnapshotIsUsable(withFrontArtwork("blob:http://localhost/abc"))).toBe(false);
  });

  it("is usable with a data URL — how a signed-out visitor's draft artwork is held until sign-in, and it draws fine in a thumbnail as-is (Pavin: cart showed the wrong colours for exactly this case)", () => {
    expect(
      designSnapshotIsUsable(withFrontArtwork("data:image/png;base64,iVBOR")),
    ).toBe(true);
  });

  it("is not usable when the src is blank", () => {
    expect(designSnapshotIsUsable(withFrontArtwork("   "))).toBe(false);
  });

  it("is not usable for a blank or roster-only design — nothing for DesignSidePreview to draw", () => {
    const blank = emptyDesignDocument();
    expect(designSnapshotIsUsable(blank)).toBe(false);
    const rosterOnly: DesignDocument = {
      ...blank,
      roster: [{ size: "M", name: "Alex", number: "7" }],
    };
    expect(designSnapshotIsUsable(rosterOnly)).toBe(false);
  });
});

describe("designSnapshotHeroSide", () => {
  it("picks front first when the front is decorated", () => {
    expect(designSnapshotHeroSide(withFrontArtwork("https://cdn.example.com/logo.png"))).toBe(
      "front",
    );
  });

  it("falls back to whichever side actually carries something, front first in DesignSides order", () => {
    const doc = emptyDesignDocument();
    const backOnly: DesignDocument = {
      ...doc,
      artworksBySide: { ...doc.artworksBySide, back: [artwork()] },
    };
    expect(designSnapshotHeroSide(backOnly)).toBe("back");
  });

  it("is null for a design with nothing to draw", () => {
    expect(designSnapshotHeroSide(emptyDesignDocument())).toBeNull();
  });
});

describe("designSnapshotFromConfiguration", () => {
  const GOOD_PHOTOS = {
    colorFrontImageUrl: "https://cdn.example.com/black-front.jpg",
    colorBackImageUrl: "https://cdn.example.com/black-back.jpg",
    styleName: "Ultra Cotton Tee",
  };

  it("reads a real snapshot and photo set back off stored configuration", () => {
    const design = withFrontArtwork("https://cdn.example.com/logo.png");
    const result = designSnapshotFromConfiguration({
      designSnapshot: design,
      garmentPhotos: GOOD_PHOTOS,
    });
    expect(result).not.toBeNull();
    expect(result!.heroSide).toBe("front");
    expect(result!.garmentPhotos.colorFrontImageUrl).toBe(GOOD_PHOTOS.colorFrontImageUrl);
    expect(result!.garmentPhotos.styleName).toBe(GOOD_PHOTOS.styleName);
  });

  it("is null when configuration is missing entirely", () => {
    expect(designSnapshotFromConfiguration(undefined)).toBeNull();
    expect(designSnapshotFromConfiguration(null)).toBeNull();
  });

  it("is null when the design snapshot has nothing decorated (an order placed before this existed)", () => {
    expect(
      designSnapshotFromConfiguration({
        designSnapshot: undefined,
        garmentPhotos: GOOD_PHOTOS,
      }),
    ).toBeNull();
  });

  it("is null when the photo set is missing or malformed, even with a real design", () => {
    const design = withFrontArtwork("https://cdn.example.com/logo.png");
    expect(designSnapshotFromConfiguration({ designSnapshot: design })).toBeNull();
    expect(
      designSnapshotFromConfiguration({ designSnapshot: design, garmentPhotos: "nope" }),
    ).toBeNull();
  });

  it("never throws on garbage input — untrusted storage, not a typed value", () => {
    expect(() =>
      designSnapshotFromConfiguration({
        designSnapshot: "not a document",
        garmentPhotos: 42,
      }),
    ).not.toThrow();
    expect(
      designSnapshotFromConfiguration({
        designSnapshot: "not a document",
        garmentPhotos: 42,
      }),
    ).toBeNull();
  });
});
