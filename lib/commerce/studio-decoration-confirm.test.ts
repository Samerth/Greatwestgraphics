import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { DesignDocument, SideDecoration } from "@gwg/contracts";

import {
  artworksNeedingDecoration,
  confirmArtworkDecoration,
  decorationLinesForPricing,
  isArtworkDecorationConfirmed,
  resolveArtworkDecoration,
  withArtworkDecoration,
} from "./studio-decoration";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const studio = read("components/design/DesignStudio.tsx");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const FALLBACK: SideDecoration = { methodKey: "screen", colours: 1 };

function artwork(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    src: `https://example.test/${id}.png`,
    x: 0,
    y: 0,
    scaleX: 1,
    scaleY: 1,
    rotation: 0,
    ...extra,
  };
}

function doc(overrides: Partial<DesignDocument> = {}): DesignDocument {
  return {
    artworksBySide: { front: [], back: [], left: [], right: [] },
    textsBySide: { front: [], back: [], left: [], right: [] },
    decorationsBySide: {},
    placementBySide: {
      front: "Center Chest",
      back: "Full Back",
      left: "Left Sleeve",
      right: "Right Sleeve",
    },
    ...overrides,
  } as DesignDocument;
}

/**
 * CodSphere UAT V2 row 46: "When a design is uploaded, can we have some sort
 * of way to force customers to actually see the decoration type and select
 * the correct decoration features. Currently, it seems a bit hidden and can
 * be missed and uploading art resulting in inaccurate pricing."
 */
describe("row 46 — a freshly uploaded logo needs a decoration decision", () => {
  it("treats a new logo as unconfirmed", () => {
    const document = doc({
      artworksBySide: {
        front: [artwork("a1")],
        back: [],
        left: [],
        right: [],
      },
    } as Partial<DesignDocument>);
    expect(artworksNeedingDecoration(document, ["front"])).toEqual([
      { side: "front", artworkId: "a1", index: 0 },
    ]);
  });

  it("reports nothing to do once every logo is confirmed", () => {
    const document = confirmArtworkDecoration(
      doc({
        artworksBySide: { front: [artwork("a1")], back: [], left: [], right: [] },
      } as Partial<DesignDocument>),
      "front",
      "a1",
      FALLBACK,
    );
    expect(artworksNeedingDecoration(document, ["front"])).toEqual([]);
  });

  it("finds unconfirmed logos on a side the customer is not looking at", () => {
    // The whole point of blocking the exit: the missed logo is usually the
    // one off-screen.
    const document = doc({
      artworksBySide: {
        front: [artwork("a1", { decorationConfirmed: true })],
        back: [artwork("b1")],
        left: [],
        right: [],
      },
    } as Partial<DesignDocument>);
    const pending = artworksNeedingDecoration(document, [
      "front",
      "back",
      "left",
      "right",
    ]);
    expect(pending).toEqual([{ side: "back", artworkId: "b1", index: 0 }]);
  });

  it("reports each unconfirmed logo with its position on its side", () => {
    const document = doc({
      artworksBySide: {
        front: [artwork("a1", { decorationConfirmed: true }), artwork("a2")],
        back: [],
        left: [],
        right: [],
      },
    } as Partial<DesignDocument>);
    expect(artworksNeedingDecoration(document, ["front"])).toEqual([
      { side: "front", artworkId: "a2", index: 1 },
    ]);
  });

  it("ignores a side that carries only text", () => {
    // Text is not artwork and has its own print method; row 46 is about
    // uploaded logos being priced on an unseen default.
    const document = doc();
    expect(artworksNeedingDecoration(document, ["front", "back"])).toEqual([]);
  });
});

describe("confirming agrees with the default rather than changing it", () => {
  const base = doc({
    artworksBySide: { front: [artwork("a1")], back: [], left: [], right: [] },
  } as Partial<DesignDocument>);

  it("marks the logo confirmed", () => {
    const next = confirmArtworkDecoration(base, "front", "a1", FALLBACK);
    expect(isArtworkDecorationConfirmed(next.artworksBySide.front[0]!)).toBe(
      true,
    );
  });

  it("freezes what was agreed instead of leaving it to fall back", () => {
    // Otherwise a later change to the side's decoration would silently
    // re-price a logo the customer had already signed off.
    const next = confirmArtworkDecoration(base, "front", "a1", FALLBACK);
    expect(next.artworksBySide.front[0]!.decoration).toEqual(FALLBACK);

    const sideChanged: DesignDocument = {
      ...next,
      decorationsBySide: {
        ...next.decorationsBySide,
        front: { methodKey: "embroidery", colours: 6 },
      },
    };
    expect(
      resolveArtworkDecoration(sideChanged, "front", "a1", FALLBACK),
    ).toEqual(FALLBACK);
  });

  it("does not touch the other logos on the side", () => {
    const two = doc({
      artworksBySide: {
        front: [artwork("a1"), artwork("a2")],
        back: [],
        left: [],
        right: [],
      },
    } as Partial<DesignDocument>);
    const next = confirmArtworkDecoration(two, "front", "a1", FALLBACK);
    expect(isArtworkDecorationConfirmed(next.artworksBySide.front[1]!)).toBe(
      false,
    );
  });

  it("leaves the original document untouched", () => {
    confirmArtworkDecoration(base, "front", "a1", FALLBACK);
    expect(base.artworksBySide.front[0]!.decorationConfirmed).toBeUndefined();
  });
});

describe("changing a setting counts as having seen it", () => {
  it("confirms the logo as a side effect of an actual choice", () => {
    // A customer who picks a method has self-evidently seen the panel;
    // making them then press Confirm would be nagging, not checking.
    const document = withArtworkDecoration(
      doc({
        artworksBySide: { front: [artwork("a1")], back: [], left: [], right: [] },
      } as Partial<DesignDocument>),
      "front",
      "a1",
      { colours: 3 },
      FALLBACK,
    );
    expect(isArtworkDecorationConfirmed(document.artworksBySide.front[0]!)).toBe(
      true,
    );
    expect(artworksNeedingDecoration(document, ["front"])).toEqual([]);
  });

  it("still only confirms the logo that was changed", () => {
    const document = withArtworkDecoration(
      doc({
        artworksBySide: {
          front: [artwork("a1"), artwork("a2")],
          back: [],
          left: [],
          right: [],
        },
      } as Partial<DesignDocument>),
      "front",
      "a1",
      { colours: 3 },
      FALLBACK,
    );
    expect(artworksNeedingDecoration(document, ["front"])).toEqual([
      { side: "front", artworkId: "a2", index: 1 },
    ]);
  });
});

describe("confirmation does not disturb pricing", () => {
  it("prices a confirmed logo exactly as it previewed", () => {
    // Confirming writes the resolved decoration down; it must not change
    // the number the customer was already being shown.
    const before = doc({
      artworksBySide: { front: [artwork("a1")], back: [], left: [], right: [] },
    } as Partial<DesignDocument>);
    const after = confirmArtworkDecoration(before, "front", "a1", FALLBACK);
    expect(decorationLinesForPricing(after, ["front"], FALLBACK)).toEqual(
      decorationLinesForPricing(before, ["front"], FALLBACK),
    );
  });

  it("keeps summing colours across logos in a location", () => {
    // Row 60 must survive row 46.
    const document = confirmArtworkDecoration(
      confirmArtworkDecoration(
        doc({
          artworksBySide: {
            front: [artwork("a1"), artwork("a2")],
            back: [],
            left: [],
            right: [],
          },
        } as Partial<DesignDocument>),
        "front",
        "a1",
        FALLBACK,
      ),
      "front",
      "a2",
      FALLBACK,
    );
    const [line] = decorationLinesForPricing(document, ["front"], FALLBACK);
    expect(line?.colours).toBe(2);
  });
});

describe("the studio actually enforces it", () => {
  const body = stripComments(studio);

  it("blocks the exit to the Quantity step", () => {
    expect(body).toContain("pendingDecorations.length > 0");
    expect(body).toContain("Confirm decoration to continue");
  });

  it("marks the panel unconfirmed so it cannot be skimmed past", () => {
    expect(body).toContain('data-studio="decoration-panel"');
    expect(body).toContain("Choose how this logo is printed");
  });

  it("offers a way to agree with the suggested decoration", () => {
    expect(body).toContain('data-studio="confirm-decoration"');
    expect(body).toContain("confirmActiveDecoration");
  });

  it("names the logo that still needs a decision", () => {
    // "Something is unconfirmed" without saying which is worse than not
    // stopping the customer at all.
    expect(body).toContain('data-studio="pending-decorations"');
    expect(body).toContain("goToPendingDecoration");
  });

  it("checks every side, not just the one on screen", () => {
    expect(body).toContain("artworksNeedingDecoration(design, DesignSides)");
  });
});
