import { describe, expect, it } from "vitest";
import { bulkPriceInstruction } from "./bulk-price.js";
import { parseBulkProductsXml } from "./client.js";

describe("bulkPriceInstruction", () => {
  it("writes an ordinary price", () => {
    expect(bulkPriceInstruction({ price: 24.99 }, false)).toEqual({
      kind: "write",
      priceDollars: 24.99,
    });
  });

  it("does not follow a sale by default: a part whose price equals its sale price only fills a gap", () => {
    // Real: part 28373-1 holds $24.99 on file; Bulk says price 18.99, sale 18.99.
    expect(
      bulkPriceInstruction({ price: 18.99, salePrice: 18.99 }, false),
    ).toEqual({ kind: "fillIfMissing", priceDollars: 18.99 });
  });

  it("follows the sale when told to", () => {
    expect(
      bulkPriceInstruction({ price: 18.99, salePrice: 18.99 }, true),
    ).toEqual({ kind: "write", priceDollars: 18.99 });
  });

  it("treats price above the sale price as the regular price and writes it", () => {
    // 611 of the 3,702 sale parts in the 1 Oct reply look like this.
    expect(
      bulkPriceInstruction({ price: 4.89, salePrice: 2.45 }, false),
    ).toEqual({ kind: "write", priceDollars: 4.89 });
  });

  it("ignores a missing, zero or negative price", () => {
    expect(bulkPriceInstruction({}, false)).toEqual({ kind: "none" });
    expect(bulkPriceInstruction({ price: 0 }, false)).toEqual({ kind: "none" });
    expect(bulkPriceInstruction({ price: -1 }, true)).toEqual({ kind: "none" });
  });

  it("does not treat a zero sale price as a sale", () => {
    expect(bulkPriceInstruction({ price: 10, salePrice: 0 }, false)).toEqual({
      kind: "write",
      priceDollars: 10,
    });
  });
});

describe("Bulk reader keeps the sale price and discount code", () => {
  it("parses salePrice and discountCode, leaving them out when empty", () => {
    const xml = `<R>
      <Product><productId>1-1</productId><style>S1</style><quantity>3</quantity>
        <price>18.99</price><salePrice>18.99</salePrice><discountCode>S</discountCode></Product>
      <Product><productId>1-2</productId><style>S1</style><quantity>3</quantity>
        <price>24.99</price><salePrice></salePrice><discountCode></discountCode></Product>
    </R>`;
    const [onSale, regular] = parseBulkProductsXml(xml);
    expect(onSale).toMatchObject({ price: 18.99, salePrice: 18.99, discountCode: "S" });
    expect(regular?.price).toBe(24.99);
    expect(regular).not.toHaveProperty("salePrice");
    expect(regular).not.toHaveProperty("discountCode");
  });
});
