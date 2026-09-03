import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const quantityStep = read("components/design/QuantityStep.tsx");
const studio = read("components/design/DesignStudio.tsx");

describe("names/numbers surcharge is actually wired", () => {
  // The fee was defined in pricing config and shown in the UI, but no
  // storefront caller ever passed the flag that applies it, so it was
  // advertised and never charged. Guard the wiring, not just the engine.
  it("passes includeNamesNumbers into the Input Quantity quote", () => {
    expect(quantityStep).toContain("includeNamesNumbers");
  });

  it("only applies it to a fully-named order, never to un-named spares", () => {
    expect(quantityStep).toContain(
      "includeNamesNumbers: namedQty > 0 && spareQty === 0",
    );
  });

  it("tells the customer when a mixed order's fee is not in the estimate", () => {
    expect(quantityStep).toMatch(/not in the estimate above/);
  });
});

describe("the studio asks no ordering questions", () => {
  it("no longer prices, because it has no quantity to price against", () => {
    expect(studio).not.toMatch(/const quoted = useMemo\(/);
    expect(studio).not.toMatch(/\bfunction unitPriceMinor\b/);
    expect(studio).not.toMatch(/\bconst \[designQty\b/);
  });

  it("has no add-to-cart path of its own", () => {
    expect(studio).not.toMatch(/\basync function addDesignToCart\b/);
  });

  it("exits to the Input Quantity step instead", () => {
    expect(studio).toContain("Continue to Quantity");
    expect(studio).toContain("/design/quantity");
  });
});
