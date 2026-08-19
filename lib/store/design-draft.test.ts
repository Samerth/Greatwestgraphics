import { describe, expect, it } from "vitest";
import { emptyDesignDocument } from "@gwg/contracts";
import {
  artworkSrcForDraft,
  dataUrlToBlob,
  draftHasEphemeralArtwork,
  filenameForArtworkBlob,
} from "./design-draft";

const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("design draft helpers", () => {
  it("round-trips a data URL so a logo can leave the page and come back", async () => {
    const blob = await dataUrlToBlob(TINY_PNG);
    const restored = await artworkSrcForDraft(blob);
    expect(restored.startsWith("data:image/png")).toBe(true);
    expect(filenameForArtworkBlob(blob)).toBe("draft.png");
  });

  it("treats a data-URL layer as something that still needs uploading", () => {
    const design = emptyDesignDocument();
    design.artworksBySide.front.push({
      id: "logo",
      src: TINY_PNG,
      x: 0,
      y: 0,
      scaleX: 1,
      scaleY: 1,
      rotation: 0,
    });
    expect(draftHasEphemeralArtwork(design)).toBe(true);
  });
});
