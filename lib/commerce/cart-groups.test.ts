import { describe, expect, it } from "vitest";
import {
  cartGroupSizeBreakdown,
  groupCartItems,
  groupCartItemsByProduct,
} from "@/lib/commerce/cart-groups";
import type { CartItem } from "@/lib/store/cart";

// Pavin's own order: three colourways of one sweatshirt, four size lines.
// Each colourway is its own `ss_products` row/`productId` — `styleId` is
// what the three actually share, and what the product level groups on.
const forestXl: CartItem = {
  id: "forest-product",
  productId: "forest-product",
  styleId: "crewneck-style",
  name: "Gildan Unisex DryBlend Crewneck",
  meta: "Custom design · Size XL · Screen print",
  color: "Forest",
  size: "XL",
  variantId: "forest-xl",
  qty: 5,
  unit: 31.55,
  image: "https://cdn.example.com/forest.jpg",
  artworkProofUrl: "https://cdn.example.com/proof.png",
  designProjectId: "design-1",
};
const ashS: CartItem = {
  ...forestXl,
  id: "ash-product",
  productId: "ash-product",
  color: "Ash",
  size: "S",
  variantId: "ash-s",
  qty: 5,
  image: "https://cdn.example.com/ash.jpg",
};
const ashXl: CartItem = { ...ashS, size: "XL", variantId: "ash-xl", qty: 7 };
const royalS: CartItem = {
  ...forestXl,
  id: "royal-product",
  productId: "royal-product",
  color: "Royal",
  size: "S",
  variantId: "royal-s",
  qty: 10,
  image: "https://cdn.example.com/royal.jpg",
};

describe("groupCartItems", () => {
  it("folds Pavin's four lines into three groups, one per colour", () => {
    const groups = groupCartItems([forestXl, ashS, ashXl, royalS]);
    expect(groups).toHaveLength(3);
    expect(groups.map((g) => g.representative.color)).toEqual([
      "Forest",
      "Ash",
      "Royal",
    ]);
  });

  it("nests both Ash sizes inside one group in size order, S before XL", () => {
    const groups = groupCartItems([ashXl, ashS]); // added out of order
    const ash = groups.find((g) => g.representative.color === "Ash")!;
    expect(ash.items.map((i) => i.size)).toEqual(["S", "XL"]);
    expect(ash.quantity).toBe(12);
  });

  it("keeps every original CartItem untouched inside its group — presentation only", () => {
    const groups = groupCartItems([ashS, ashXl]);
    const ash = groups[0]!;
    expect(ash.items).toContainEqual(ashS);
    expect(ash.items).toContainEqual(ashXl);
  });

  it("sums quantity and total across a group's sizes", () => {
    const groups = groupCartItems([ashS, ashXl]);
    const ash = groups[0]!;
    expect(ash.quantity).toBe(12);
    expect(ash.totalMinor).toBe(
      Math.round(ashS.qty * ashS.unit * 100) + Math.round(ashXl.qty * ashXl.unit * 100),
    );
  });

  it("never merges two different colours, even of the same product", () => {
    const sameProductDifferentColour: CartItem = {
      ...forestXl,
      color: "Ash",
      size: "M",
      variantId: "shared-m",
    };
    const groups = groupCartItems([forestXl, sameProductDifferentColour]);
    expect(groups).toHaveLength(2);
  });

  it("a blank (undecorated) line groups the same way, still editable per size", () => {
    const blankM: CartItem = {
      id: "tee",
      productId: "tee",
      name: "Tee",
      meta: "Size M",
      color: "Navy",
      size: "M",
      variantId: "m",
      qty: 24,
      unit: 12,
      image: "",
    };
    const blankL: CartItem = { ...blankM, size: "L", variantId: "l", qty: 10 };
    const groups = groupCartItems([blankM, blankL]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((i) => i.variantId)).toEqual(["m", "l"]);
  });

  it("never groups two roster (team/named) lines, even of the same product and colour", () => {
    const teamA: CartItem = {
      id: "hoodie",
      productId: "hoodie",
      name: "Hoodie",
      meta: "Custom design · Team order",
      color: "Black",
      qty: 2,
      unit: 30,
      image: "",
      artworkProofUrl: "https://cdn.example.com/a.png",
      roster: [
        { size: "M", name: "Alex" },
        { size: "L", name: "Sam" },
      ],
    };
    const teamB: CartItem = {
      ...teamA,
      artworkProofUrl: "https://cdn.example.com/b.png",
      roster: [{ size: "S", name: "Jo" }],
    };
    const groups = groupCartItems([teamA, teamB]);
    expect(groups).toHaveLength(2);
  });

  it("flags hasUnpriced when any line in the group is priceUnavailable, without inventing a total", () => {
    const priced: CartItem = { ...ashS };
    const unpriced: CartItem = { ...ashXl, unit: 0, priceUnavailable: true };
    const groups = groupCartItems([priced, unpriced]);
    const ash = groups[0]!;
    expect(ash.hasUnpriced).toBe(true);
    // Only the priced line's total is counted; the unpriced line contributes 0.
    expect(ash.totalMinor).toBe(Math.round(priced.qty * priced.unit * 100));
  });

  it("returns an empty list for an empty cart", () => {
    expect(groupCartItems([])).toEqual([]);
  });
});

describe("cartGroupSizeBreakdown", () => {
  it("matches the admin/portal format", () => {
    expect(cartGroupSizeBreakdown([ashS, ashXl])).toBe("S 5 · XL 7");
  });

  it("skips items with no size (e.g. a roster line folded in alone)", () => {
    const noSize: CartItem = { ...ashS, size: undefined };
    expect(cartGroupSizeBreakdown([noSize])).toBe("");
  });
});

describe("groupCartItemsByProduct", () => {
  it("folds Pavin's whole order into one product card — Product > Decoration > Colour > Sizes", () => {
    const products = groupCartItemsByProduct([forestXl, ashS, ashXl, royalS]);
    expect(products).toHaveLength(1);

    const product = products[0]!;
    expect(product.name).toBe("Gildan Unisex DryBlend Crewneck");
    expect(product.quantity).toBe(27); // 5 + 5 + 7 + 10

    expect(product.decorations).toHaveLength(1);
    const decoration = product.decorations[0]!;
    expect(decoration.label).toBe("Custom design · Screen print");

    expect(decoration.colours.map((c) => c.representative.color)).toEqual([
      "Forest",
      "Ash",
      "Royal",
    ]);
    const ash = decoration.colours.find((c) => c.representative.color === "Ash")!;
    expect(ash.items.map((i) => i.size)).toEqual(["S", "XL"]);
  });

  it("sums quantity and total up through every level", () => {
    const products = groupCartItemsByProduct([forestXl, ashS, ashXl, royalS]);
    const product = products[0]!;
    const decoration = product.decorations[0]!;
    const expectedTotal = decoration.colours.reduce((s, c) => s + c.totalMinor, 0);
    expect(product.totalMinor).toBe(expectedTotal);
    expect(decoration.totalMinor).toBe(expectedTotal);
    expect(product.quantity).toBe(decoration.quantity);
  });

  it("groups by styleId, not by productId — the thing colourways of one garment actually share", () => {
    const products = groupCartItemsByProduct([forestXl, ashS]);
    expect(products).toHaveLength(1);
    expect(products[0]!.decorations[0]!.colours).toHaveLength(2);
  });

  it("keeps two different products apart, even with the same decoration wording", () => {
    const otherStyle: CartItem = { ...forestXl, styleId: "other-style", id: "other-product", productId: "other-product" };
    const products = groupCartItemsByProduct([forestXl, otherStyle]);
    expect(products).toHaveLength(2);
  });

  it("keeps two different decorations of the same product apart", () => {
    const embroidered: CartItem = {
      ...ashS,
      meta: "Custom design · Size S · Embroidery",
    };
    const products = groupCartItemsByProduct([forestXl, embroidered]);
    expect(products).toHaveLength(1);
    expect(products[0]!.decorations).toHaveLength(2);
    expect(products[0]!.decorations.map((d) => d.label).sort()).toEqual([
      "Custom design · Embroidery",
      "Custom design · Screen print",
    ]);
  });

  it("falls back to productId, then id, when a line carries no styleId (a custom-quote or roster add)", () => {
    const customQuote: CartItem = {
      id: "custom-quote-tee-screenPrint-123",
      name: "Custom quote tee",
      meta: "Custom design · Screen print",
      color: "As quoted",
      qty: 48,
      unit: 9.5,
      image: "",
    };
    const products = groupCartItemsByProduct([customQuote]);
    expect(products).toHaveLength(1);
    expect(products[0]!.key).toBe(customQuote.id);
  });

  it("never lets one colour's own item stand in for another colour's photo — every colour keeps its own thumbnail source", () => {
    const products = groupCartItemsByProduct([forestXl, ashS, royalS]);
    const decoration = products[0]!.decorations[0]!;
    const images = decoration.colours.map((c) => c.representative.image);
    expect(images).toEqual([forestXl.image, ashS.image, royalS.image]);
    expect(new Set(images).size).toBe(3); // three genuinely different photos
  });

  it("flags hasUnpriced up through every level without inventing a total", () => {
    const unpriced: CartItem = { ...royalS, unit: 0, priceUnavailable: true };
    const products = groupCartItemsByProduct([forestXl, ashS, unpriced]);
    const product = products[0]!;
    expect(product.hasUnpriced).toBe(true);
    expect(product.decorations[0]!.hasUnpriced).toBe(true);
  });

  it("returns an empty list for an empty cart", () => {
    expect(groupCartItemsByProduct([])).toEqual([]);
  });
});
