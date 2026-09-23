import { describe, expect, it } from "vitest";
import { PRICING_MASTER_V2 } from "@gwg/pricing";
import type { PricingConfigV2 } from "@gwg/contracts";
import { cheapestCatalogMatch, type CheapestMatchCandidate } from "./cheapest-match";

const config = PRICING_MASTER_V2 as unknown as PricingConfigV2;

const candidate = (
  overrides: Partial<CheapestMatchCandidate> = {},
): CheapestMatchCandidate => ({
  id: "prod-1",
  slug: "adidas-a556",
  label: "Adidas A556 · Black",
  colorName: "Black",
  unitCostMinor: 450,
  isDark: false,
  available: true,
  categorySlugs: ["t-shirts"],
  ...overrides,
});

const REQUEST = {
  categorySlug: "t-shirts",
  quantity: 48,
  methodKey: "screenPrint",
  colours: 1,
};

describe("cheapestCatalogMatch", () => {
  it("picks the candidate with the lower all-in price, not just the lower blank cost", () => {
    const cheap = candidate({ id: "cheap", unitCostMinor: 400 });
    const pricey = candidate({ id: "pricey", unitCostMinor: 900 });
    const result = cheapestCatalogMatch(config, [pricey, cheap], REQUEST);
    expect(result?.product.id).toBe("cheap");
  });

  it("only considers candidates in the requested category", () => {
    const wrongCategory = candidate({
      id: "hoodie",
      unitCostMinor: 100,
      categorySlugs: ["hoodies"],
    });
    const rightCategory = candidate({ id: "tee", unitCostMinor: 900 });
    const result = cheapestCatalogMatch(config, [wrongCategory, rightCategory], REQUEST);
    expect(result?.product.id).toBe("tee");
  });

  it("only considers candidates that are actually in stock", () => {
    const outOfStock = candidate({ id: "oos", unitCostMinor: 100, available: false });
    const inStock = candidate({ id: "in-stock", unitCostMinor: 900 });
    const result = cheapestCatalogMatch(config, [outOfStock, inStock], REQUEST);
    expect(result?.product.id).toBe("in-stock");
  });

  it("is null when nothing in the category is available", () => {
    const outOfStock = candidate({ available: false });
    const wrongCategory = candidate({ categorySlugs: ["hoodies"] });
    expect(cheapestCatalogMatch(config, [outOfStock, wrongCategory], REQUEST)).toBeNull();
  });

  it("is null with no candidates at all", () => {
    expect(cheapestCatalogMatch(config, [], REQUEST)).toBeNull();
  });

  it("returns a real, positive all-in price for the winner", () => {
    const result = cheapestCatalogMatch(config, [candidate()], REQUEST);
    expect(result).not.toBeNull();
    expect(result!.perPieceMinor).toBeGreaterThan(0);
    expect(result!.totalMinor).toBeGreaterThan(0);
    // Setup plus 48 decorated garments must add up to at least the total —
    // sanity-checks that this is really pricing a decorated order, not just
    // echoing the blank garment cost back.
    expect(result!.perPieceMinor).toBeGreaterThan(candidate().unitCostMinor);
  });

  it("a dark garment can cost more per piece than a cheaper-on-paper light one, and the ranking follows the real total", () => {
    // A dark garment picks up a screen-print underbase surcharge a light one
    // does not — so a nominally cheaper dark tee can lose to a nominally
    // pricier light one once decoration is priced in. This is the exact
    // case a plain unitCostMinor sort would get wrong.
    const darkAndCheaperBlank = candidate({
      id: "dark",
      unitCostMinor: 420,
      isDark: true,
      colorName: "Black",
    });
    const lightAndSlightlyPricier = candidate({
      id: "light",
      unitCostMinor: 440,
      isDark: false,
      colorName: "White",
    });
    const result = cheapestCatalogMatch(
      config,
      [darkAndCheaperBlank, lightAndSlightlyPricier],
      REQUEST,
    );
    // Whichever way the real engine's underbase surcharge actually tips it,
    // the result must be picked by the ENGINE's total, not by unitCostMinor
    // — proven here by checking the two totals directly rather than
    // asserting a specific winner (which would just re-encode today's rate
    // card into the test).
    const darkTotal = cheapestCatalogMatch(config, [darkAndCheaperBlank], REQUEST)!.perPieceMinor;
    const lightTotal = cheapestCatalogMatch(
      config,
      [lightAndSlightlyPricier],
      REQUEST,
    )!.perPieceMinor;
    const expectedWinnerId = darkTotal <= lightTotal ? "dark" : "light";
    expect(result?.product.id).toBe(expectedWinnerId);
  });
});
