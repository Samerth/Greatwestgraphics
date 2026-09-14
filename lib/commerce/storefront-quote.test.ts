import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { hasExtendedSizes, isExtendedSize } from "./storefront-quote";
/**
 * The product page warns "2XL+ — additional surcharge, confirmed with your
 * size breakdown". The quantity step is that breakdown, so it says when the
 * surcharge is in the figure; a customer otherwise watches the product-page
 * estimate simply go up with no reason given (15 Sep: $44.72 → $45.59 with
 * all 24 pieces in 2XL).
 */
describe("the larger-size surcharge is named when it applies", () => {
  it("recognises 2XL and up, in the ways vendors spell it", () => {
    for (const size of ["2XL", "3XL", "4XL", "5XL", "6XL", "XXL", "XXXL", "2X", "3x", "2 XL", "2-XL"]) {
      expect(isExtendedSize(size), size).toBe(true);
    }
  });

  it("does not flag the ordinary run", () => {
    for (const size of ["XS", "S", "M", "L", "XL", "OSFA", "One Size", "Youth L"]) {
      expect(isExtendedSize(size), size).toBe(false);
    }
  });

  it("only counts a size that is actually ordered", () => {
    expect(
      hasExtendedSizes([
        { sizeName: "2XL", quantity: 0 },
        { sizeName: "M", quantity: 24 },
      ]),
    ).toBe(false);
    expect(
      hasExtendedSizes([
        { sizeName: "2XL", quantity: 1 },
        { sizeName: "M", quantity: 23 },
      ]),
    ).toBe(true);
  });

  it("is said on the quantity step", () => {
    const quantity = readFileSync(
      resolve(process.cwd(), "components/design/QuantityStep.tsx"),
      "utf8",
    );
    expect(quantity).toContain("hasExtendedSizes(block.sizes)");
    expect(quantity).toContain("larger-size surcharge for 2XL and up");
  });
});
