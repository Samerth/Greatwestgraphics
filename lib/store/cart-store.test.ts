import { describe, expect, it } from "vitest";
import {
  blankGarmentMergeTarget,
  cartItemBelongsToStore,
  cartItemEditHref,
  cartLineIsCustomized,
  computeCartTotals,
  decoratedLineMergeTarget,
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

  it("keeps a team roster line as its own line with qty === roster.length", () => {
    const team: CartItem = {
      ...blank,
      meta: "Custom design · Team order · 2 pieces, mixed sizes",
      qty: 2,
      roster: [
        { size: "M", name: "Alex", number: "12" },
        { size: "XL", name: "Sam" },
      ],
    };
    expect(team.qty).toBe(team.roster!.length);
    expect(cartLineIsCustomized(team)).toBe(true);
    expect(blankGarmentMergeTarget([blank], team, store)).toBeUndefined();
    expect(blankGarmentMergeTarget([team], { ...team }, store)).toBeUndefined();
  });
});

describe("decoratedLineMergeTarget", () => {
  const store = { slug: "great-west-graphics", isPublic: true };
  const designed: CartItem = {
    id: "tee",
    name: "Tee",
    meta: "Custom design · Size M",
    color: "navy",
    qty: 24,
    unit: 10,
    image: "",
    variantId: "m",
    artworkProofUrl: "https://cdn.example/proof.png",
    designProjectId: "design-1",
  };

  it("merges a re-add of the exact same design — Back to Input Quantity, Continue again", () => {
    expect(
      decoratedLineMergeTarget([designed], { ...designed, qty: 6 }, store),
    ).toBe(designed);
  });

  it("does not merge a different design on the same product, colour and size", () => {
    const otherDesign: CartItem = {
      ...designed,
      artworkProofUrl: "https://cdn.example/other-proof.png",
      designProjectId: "design-2",
    };
    expect(decoratedLineMergeTarget([designed], otherDesign, store)).toBeUndefined();
  });

  it("does not merge the same design in a different colour or size", () => {
    expect(
      decoratedLineMergeTarget([designed], { ...designed, color: "black" }, store),
    ).toBeUndefined();
    expect(
      decoratedLineMergeTarget([designed], { ...designed, variantId: "l" }, store),
    ).toBeUndefined();
  });

  it("never merges a blank (non-customized) line", () => {
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
    expect(decoratedLineMergeTarget([blank], { ...blank }, store)).toBeUndefined();
  });

  it("never merges roster lines, even identical ones — qty === roster.length must stay true", () => {
    const team: CartItem = {
      id: "tee",
      name: "Tee",
      meta: "Custom design · Team order",
      color: "navy",
      qty: 2,
      unit: 10,
      image: "",
      artworkProofUrl: "https://cdn.example/proof.png",
      roster: [{ size: "M", name: "Alex" }, { size: "L", name: "Sam" }],
    };
    expect(decoratedLineMergeTarget([team], { ...team }, store)).toBeUndefined();
  });

  it("respects the store boundary, same as blankGarmentMergeTarget", () => {
    const acme = { slug: "acme", isPublic: false };
    expect(decoratedLineMergeTarget([designed], { ...designed }, acme)).toBeUndefined();
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

describe("computeCartTotals", () => {
  const priced: CartItem = {
    id: "tee",
    name: "Tee",
    meta: "Size M",
    color: "navy",
    qty: 24,
    unit: 10,
    image: "",
  };

  /**
   * 22 Sep: the Input Quantity step used to dead-end on a configuration it
   * could not price automatically — a disabled "Continue" under copy that
   * promised the team would confirm a quote it could never reach. It is
   * unlocked now, and the line it adds carries `priceUnavailable: true`
   * with `unit: 0` rather than any invented price. These pin that a cart
   * holding one of those lines still totals correctly for the lines that
   * *are* priced, and surfaces which is missing rather than hiding it.
   */
  const unpriced: CartItem = {
    id: "hoodie",
    name: "Hoodie",
    meta: "Custom design · Size L",
    color: "black",
    qty: 6,
    unit: 0,
    image: "",
    priceUnavailable: true,
  };

  it("flags no unpriced items when every line has a real price", () => {
    const totals = computeCartTotals([priced]);
    expect(totals.hasUnpricedItems).toBe(false);
  });

  it("flags the cart when any line is priceUnavailable", () => {
    const totals = computeCartTotals([priced, unpriced]);
    expect(totals.hasUnpricedItems).toBe(true);
  });

  it("never lets an unpriced line's 0 contribute a fake amount to the subtotal", () => {
    const pricedOnly = computeCartTotals([priced]);
    const withUnpriced = computeCartTotals([priced, unpriced]);
    // Adding the unpriced hoodie must not change the priced total by a cent
    // — its qty * 0 is the honest "we don't know" contribution, not a
    // discount and not a charge.
    expect(withUnpriced.subtotal).toBe(pricedOnly.subtotal);
    expect(withUnpriced.pieces).toBe(pricedOnly.pieces + unpriced.qty);
  });

  it("still totals correctly when every line in the cart is unpriced", () => {
    const totals = computeCartTotals([unpriced]);
    expect(totals.subtotal).toBe(0);
    expect(totals.total).toBe(0);
    expect(totals.hasUnpricedItems).toBe(true);
  });
});
