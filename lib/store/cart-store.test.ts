import { describe, expect, it } from "vitest";
import { cartItemBelongsToStore, visibleCartItems } from "./cart";

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
