import { describe, expect, it } from "vitest";
import {
  blankGarmentMergeTarget,
  cartItemBelongsToStore,
  cartItemEditHref,
  visibleCartItems,
  type CartItem,
} from "./cart";

const retail = { slug: "great-west-graphics", isPublic: true };
const acme = { slug: "acme", isPublic: false };

describe("cartItemBelongsToStore", () => {
  it("keeps untagged lines on the public shop only", () => {
    expect(cartItemBelongsToStore({}, retail)).toBe(true);
    expect(cartItemBelongsToStore({}, acme)).toBe(false);
  });

  it("does not mix a branded line into the retail cart", () => {
    expect(cartItemBelongsToStore({ storeSlug: "acme" }, retail)).toBe(false);
    expect(cartItemBelongsToStore({ storeSlug: "acme" }, acme)).toBe(true);
  });
});

describe("blankGarmentMergeTarget", () => {
  const store = { slug: "great-west-graphics", isPublic: true };
  const blank: CartItem = {
    id: "tee",
    name: "Tee",
    meta: "Size M",
    color: "navy",
    qty: 24,
    unit: 10,
    image: "",
    variantId: "m",
  };
  const designed: CartItem = {
    ...blank,
    meta: "Custom design · Size M",
    artworkProofUrl: "https://cdn.example/proof.png",
    designProjectId: "design-1",
  };

  it("stacks two blank lines of the same SKU", () => {
    expect(blankGarmentMergeTarget([blank], { ...blank, qty: 12 }, store)).toBe(
      blank,
    );
  });

  it("does not fold a designed line into a blank garment", () => {
    expect(blankGarmentMergeTarget([blank], designed, store)).toBeUndefined();
  });

  it("does not stack two designed lines even for the same SKU", () => {
    expect(
      blankGarmentMergeTarget([designed], { ...designed, qty: 48 }, store),
    ).toBeUndefined();
  });
});

describe("cartItemEditHref", () => {
  it("reopens Design Studio for a saved custom design", () => {
    expect(
      cartItemEditHref({
        id: "tee-uuid",
        productId: "tee-uuid",
        productSlug: "gildan-5000-navy",
        designProjectId: "design-1",
        artworkProofUrl: "https://cdn.example/proof.png",
      }),
    ).toBe("/design?loadDesignId=design-1&garmentId=tee-uuid");
  });

  it("does not treat the product UUID as a catalog slug", () => {
    expect(
      cartItemEditHref({
        id: "tee-uuid",
        productId: "tee-uuid",
        productSlug: "gildan-5000-navy",
      }),
    ).toBe("/product/gildan-5000-navy?id=tee-uuid");
  });
});

describe("visibleCartItems", () => {
  const items = [
    { id: "tee", name: "Tee", meta: "", color: "navy", qty: 2, unit: 10, image: "" },
    {
      id: "hoodie",
      name: "Hoodie",
      meta: "",
      color: "black",
      qty: 12,
      unit: 30,
      image: "",
      storeSlug: "acme",
    },
  ];

  it("shows only the current storefront's lines", () => {
    expect(visibleCartItems(items, retail).map((item) => item.id)).toEqual(["tee"]);
    expect(visibleCartItems(items, acme).map((item) => item.id)).toEqual(["hoodie"]);
  });
});
