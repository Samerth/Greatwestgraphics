import { describe, expect, it } from "vitest";
import { externalKeyToNumericId } from "./ids.js";
import {
  parseCatalogCsv,
  parseInventoryCsv,
  parseSanmarEdiPair,
} from "./csv-parser.js";

describe("externalKeyToNumericId", () => {
  it("is stable and positive", () => {
    const a = externalKeyToNumericId("sanmar:PC61");
    const b = externalKeyToNumericId("sanmar:PC61");
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0);
  });
});

describe("parseCatalogCsv", () => {
  it("parses canonical headers and aliases", () => {
    const csv = [
      "style_key,brand_name,style_name,color_name,size_name,sku,qty,price",
      "PC61,Gildan,Softstyle,Black,L,PC61-BLK-L,12,4.50",
      'PC61,Gildan,Softstyle,"Navy Blue",XL,PC61-NVY-XL,3,"$5.00"',
    ].join("\n");

    const rows = parseCatalogCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      styleKey: "PC61",
      brandName: "Gildan",
      colorName: "Black",
      skuKey: "PC61-BLK-L",
      qty: 12,
      priceDollars: 4.5,
    });
    expect(rows[1]?.colorName).toBe("Navy Blue");
    expect(rows[1]?.priceDollars).toBe(5);
  });
});

describe("parseInventoryCsv", () => {
  it("updates by sku_key", () => {
    const csv = "sku_key,qty,price\nPC61-BLK-L,40,4.75\n";
    expect(parseInventoryCsv(csv)).toEqual([
      { skuKey: "PC61-BLK-L", sku: undefined, qty: 40, priceDollars: 4.75 },
    ]);
  });
});

describe("parseSanmarEdiPair", () => {
  it("joins products and skus", () => {
    const products =
      "productId,productName,brandName,category,price,imageUrl\nPC61,Softstyle,Gildan,T-Shirts,4.25,https://img/pc61.jpg\n";
    const skus =
      "skuId,productId,sku,colorName,sizeName,quantity,price,imageUrl\n1,PC61,PC61-BLK-L,Black,L,10,4.50,\n";
    const rows = parseSanmarEdiPair(products, skus);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      styleKey: "PC61",
      brandName: "Gildan",
      styleName: "Softstyle",
      category: "T-Shirts",
      skuKey: "1",
      qty: 10,
    });
  });
});
