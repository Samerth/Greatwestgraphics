import { describe, expect, it } from "vitest";
import { designProjectWriteFromBody } from "./design-write";

describe("designProjectWriteFromBody", () => {
  it("forwards the studio document instead of dropping it", () => {
    const design = {
      version: 2,
      artworksBySide: { front: [{ id: "1", src: "/api/uploads/a.png" }] },
    };
    expect(
      designProjectWriteFromBody({
        name: " Staff hoodie ",
        design,
        proofImageUrl: "/api/uploads/proof.png",
      }),
    ).toEqual({
      name: "Staff hoodie",
      design,
      proofImageUrl: "/api/uploads/proof.png",
    });
  });

  it("still accepts a legacy artworksBySide body", () => {
    expect(
      designProjectWriteFromBody({
        name: "Old tab",
        artworksBySide: { front: [] },
      }),
    ).toMatchObject({ name: "Old tab", artworksBySide: { front: [] } });
  });
});
