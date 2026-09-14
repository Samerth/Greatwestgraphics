import { describe, expect, it } from "vitest";

import {
  looksLikeStyleCode,
  storefrontProductName,
  storefrontStyleCode,
} from "./product-name";

/**
 * Reported on 14 September: the storefront was showing "Under Armour 1373881"
 * as a product name. `styleName` is the vendor's style *code*; `title` is the
 * garment's actual name.
 */
describe("a product shows its name, not its style code", () => {
  it("prefers the descriptive title", () => {
    expect(
      storefrontProductName({
        brandName: "Under Armour",
        title: "Storm Fleece Hoodie",
        styleName: "1373881",
      }),
    ).toBe("Under Armour Storm Fleece Hoodie");
  });

  it("does not repeat a brand the title already carries", () => {
    // Several vendors ship the brand inside the title.
    expect(
      storefrontProductName({
        brandName: "Under Armour",
        title: "Under Armour Storm Fleece Hoodie",
        styleName: "1373881",
      }),
    ).toBe("Under Armour Storm Fleece Hoodie");
  });

  it("matches the brand case-insensitively when deciding that", () => {
    expect(
      storefrontProductName({
        brandName: "Under Armour",
        title: "UNDER ARMOUR Storm Fleece Hoodie",
        styleName: "1373881",
      }),
    ).toBe("UNDER ARMOUR Storm Fleece Hoodie");
  });

  it("falls back to the style code when the vendor sent no title", () => {
    // A real gap — a catalogue audit found 47 styles with no name. A bare
    // code is poor; showing nothing would be worse.
    expect(
      storefrontProductName({
        brandName: "Under Armour",
        title: null,
        styleName: "1373881",
      }),
    ).toBe("Under Armour 1373881");
  });

  it("keeps a style name that is a real name rather than a code", () => {
    // Gildan's "Softstyle" is genuinely the style's name.
    expect(
      storefrontProductName({
        brandName: "Gildan",
        title: null,
        styleName: "Softstyle",
      }),
    ).toBe("Gildan Softstyle");
  });

  it("survives every field being missing", () => {
    expect(storefrontProductName({})).toBe("");
    expect(storefrontProductName({ brandName: "Gildan" })).toBe("Gildan");
  });
});

describe("telling a style code from a name", () => {
  it("treats all-digit and short part numbers as codes", () => {
    for (const code of ["1373881", "K500", "G500", "PC61LS", "18500"]) {
      expect(looksLikeStyleCode(code), code).toBe(true);
    }
  });

  it("treats real names as names", () => {
    for (const name of [
      "Softstyle",
      "Ultra Cotton T Shirt",
      "Heavyweight",
      "Storm Fleece Hoodie",
    ]) {
      expect(looksLikeStyleCode(name), name).toBe(false);
    }
  });

  it("is not fooled by an empty or blank value", () => {
    expect(looksLikeStyleCode("")).toBe(false);
    expect(looksLikeStyleCode("   ")).toBe(false);
  });
});

describe("the style code is still available as supporting detail", () => {
  it("is returned when the name came from the title", () => {
    expect(
      storefrontStyleCode({ title: "Storm Fleece Hoodie", styleName: "1373881" }),
    ).toBe("1373881");
  });

  it("is withheld when the code is already doing duty as the name", () => {
    // Otherwise the card reads "Under Armour 1373881 · 1373881".
    expect(storefrontStyleCode({ title: null, styleName: "1373881" })).toBeNull();
  });
});

describe("the order carries the garment's name too", () => {
  // The admin work order read "Adidas A556" (15 Sep): the cart line was
  // still named brand + style code even after the catalogue cards were
  // fixed. Every line that reaches an order goes through the same helper.
  const { readFileSync } = require("node:fs") as typeof import("node:fs");
  const { resolve } = require("node:path") as typeof import("node:path");
  const read = (p: string) =>
    readFileSync(resolve(process.cwd(), p), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .replace(/^\s*\/\/.*$/gm, "");

  it("names cart lines from the quantity step with the shared helper", () => {
    const quantity = read("components/design/QuantityStep.tsx");
    expect(quantity).not.toMatch(/`\$\{d\.style\.brandName\} \$\{d\.style\.styleName\}`/);
    expect(quantity.match(/lineProductName\(d\)/g)?.length).toBe(2);
    expect(quantity).toContain("storefrontProductName({");
  });

  it("names the garment in the studio the same way", () => {
    const studio = read("components/design/DesignStudio.tsx");
    expect(studio).not.toMatch(
      /`\$\{productDetail\.style\.brandName\} \$\{productDetail\.style\.styleName\}`/,
    );
  });
});
