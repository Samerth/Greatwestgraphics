import { describe, expect, it } from "vitest";
import {
  buildGetBulkDataRequestXml,
  extractVendorHex,
  isBulkLimitResponse,
  NS_BULK,
  parseConfigurationAndPricingXml,
  parseInventoryLevelsXml,
  parseMediaContentXml,
  parsePartInventoryQuantity,
  parseBulkProductsXml,
  parseProductColorBlocks,
  parseSellableProductId,
  productPartsToSkus,
  soapFaultString,
} from "./client.js";

describe("parseSellableProductId", () => {
  it("parses style, color, size", () => {
    expect(parseSellableProductId("NF0A529K(TNF Black,S,)")).toEqual({
      styleId: "NF0A529K",
      colorName: "TNF Black",
      sizeName: "S",
      discontinued: false,
    });
  });

  it("flags discontinued codes", () => {
    expect(parseSellableProductId("NF0A529K(TNF Black,M,C)")?.discontinued).toBe(
      true,
    );
  });
});

describe("parsePartInventoryQuantity / parseInventoryLevelsXml", () => {
  const samplePart = `
    <ns1:PartInventory>
      <ns1:partId>17977-1</ns1:partId>
      <ns1:quantityAvailable>
        <ns1:Quantity>
          <ns1:uom>EA</ns1:uom>
          <ns1:value>289</ns1:value>
        </ns1:Quantity>
      </ns1:quantityAvailable>
      <ns1:InventoryLocationArray>
        <ns1:InventoryLocation>
          <ns1:inventoryLocationQuantity>
            <ns1:Quantity><ns1:uom>EA</ns1:uom><ns1:value>54</ns1:value></ns1:Quantity>
          </ns1:inventoryLocationQuantity>
          <ns1:FutureAvailabilityArray>
            <ns1:FutureAvailability>
              <ns1:Quantity><ns1:uom>EA</ns1:uom><ns1:value>420</ns1:value></ns1:Quantity>
            </ns1:FutureAvailability>
          </ns1:FutureAvailabilityArray>
        </ns1:InventoryLocation>
        <ns1:InventoryLocation>
          <ns1:inventoryLocationQuantity>
            <ns1:Quantity><ns1:uom>EA</ns1:uom><ns1:value>232</ns1:value></ns1:Quantity>
          </ns1:inventoryLocationQuantity>
        </ns1:InventoryLocation>
      </ns1:InventoryLocationArray>
      <ns1:lastModified>2020-02-27T20:16:10</ns1:lastModified>
    </ns1:PartInventory>
  `;

  it("uses quantityAvailable total, not a nested future/location value", () => {
    expect(parsePartInventoryQuantity(samplePart)).toBe(289);
  });

  it("parses PartInventory blocks from a SOAP body", () => {
    const xml = `<GetInventoryLevelsResponse>${samplePart}</GetInventoryLevelsResponse>`;
    expect(parseInventoryLevelsXml(xml)).toEqual([
      {
        skuId: "17977-1",
        quantity: 289,
        lastUpdated: "2020-02-27T20:16:10",
      },
    ]);
  });

  it("sums location quantities when quantityAvailable is missing", () => {
    const block = `
      <PartInventory>
        <partId>ABC-1</partId>
        <inventoryLocationQuantity><Quantity><value>10</value></Quantity></inventoryLocationQuantity>
        <inventoryLocationQuantity><Quantity><value>5</value></Quantity></inventoryLocationQuantity>
      </PartInventory>
    `;
    expect(parsePartInventoryQuantity(block)).toBe(15);
  });
});

describe("parseConfigurationAndPricingXml", () => {
  it("maps partId to lowest-minQuantity Customer price", () => {
    const xml = `
      <GetConfigurationAndPricingResponse>
        <Configuration>
          <PartArray>
            <Part>
              <partId>31516-1</partId>
              <PartPriceArray>
                <PartPrice>
                  <minQuantity>12</minQuantity>
                  <price>30.00</price>
                </PartPrice>
                <PartPrice>
                  <minQuantity>1</minQuantity>
                  <price>37.99</price>
                </PartPrice>
              </PartPriceArray>
            </Part>
          </PartArray>
        </Configuration>
      </GetConfigurationAndPricingResponse>
    `;
    expect(parseConfigurationAndPricingXml(xml)).toEqual([
      { partId: "31516-1", price: 37.99, minQuantity: 1 },
    ]);
  });
});

describe("parseMediaContentXml", () => {
  it("splits several addresses out of one url element", () => {
    // SanMar Canada returns every colour and angle newline-separated inside a
    // single element. Read as one address it becomes a hundred URLs glued
    // together, which is what was being stored as the product image.
    const xml = `
      <GetMediaContentResponse>
        <MediaContent>
          <url>https://media.example.com/front.jpg
https://media.example.com/back.jpg
https://media.example.com/side.jpg</url>
          <classTypeId>1006</classTypeId>
        </MediaContent>
      </GetMediaContentResponse>`;
    expect(parseMediaContentXml(xml)).toEqual([
      "https://media.example.com/front.jpg",
      "https://media.example.com/back.jpg",
      "https://media.example.com/side.jpg",
    ]);
  });

  it("keeps the first address usable on its own", () => {
    // Style fallback may still use urls[0]; each colourway must match its
    // own filename / Bulk part image instead of sharing this first address.
    const xml = `
      <GetMediaContentResponse>
        <MediaContent>
          <url>  https://media.example.com/a.jpg\thttps://media.example.com/b.jpg  </url>
          <classTypeId>1006</classTypeId>
        </MediaContent>
      </GetMediaContentResponse>`;
    const [first] = parseMediaContentXml(xml);
    expect(first).toBe("https://media.example.com/a.jpg");
  });

  it("ignores non-http noise inside the element", () => {
    const xml = `
      <GetMediaContentResponse>
        <MediaContent>
          <url>n/a https://media.example.com/real.jpg</url>
          <classTypeId>1006</classTypeId>
        </MediaContent>
      </GetMediaContentResponse>`;
    expect(parseMediaContentXml(xml)).toEqual([
      "https://media.example.com/real.jpg",
    ]);
  });

  it("prefers Primary classType 1006 URLs", () => {
    const xml = `
      <GetMediaContentResponse>
        <MediaContent>
          <url>https://media.example.com/other.jpg</url>
          <classTypeId>1007</classTypeId>
        </MediaContent>
        <MediaContent>
          <url>https://media.example.com/primary.jpg</url>
          <classTypeId>1006</classTypeId>
        </MediaContent>
      </GetMediaContentResponse>
    `;
    expect(parseMediaContentXml(xml)[0]).toBe(
      "https://media.example.com/primary.jpg",
    );
  });
});

describe("getBulkData request / SOAP faults", () => {
  it("qualifies GetBulkDataRequest with the ATC Bulk namespace", () => {
    const xml = buildGetBulkDataRequestXml("161", "buyer@example.com");
    expect(xml).toContain(`xmlns="${NS_BULK}"`);
    expect(xml).toContain("<id>161</id>");
    expect(xml).toContain("<password>buyer@example.com</password>");
  });

  it("reads the SanMar 500 fault when the request is unqualified", () => {
    // Live ATC response to <GetBulkDataRequest> without xmlns.
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/"><SOAP-ENV:Body><SOAP-ENV:Fault><faultcode>SOAP-ENV:Server</faultcode><faultstring>Procedure 'GetBulkDataRequest' not present</faultstring></SOAP-ENV:Fault></SOAP-ENV:Body></SOAP-ENV:Envelope>`;
    expect(soapFaultString(xml)).toBe("Procedure 'GetBulkDataRequest' not present");
    expect(isBulkLimitResponse(xml)).toBe(false);
  });

  it("treats service code 125 as the Bulk daily limit, not a 500", () => {
    const xml = `
      <GetBulkDataResponse>
        <ServiceMessage>
          <code>125</code>
          <description>Bulk Data daily limit reached</description>
        </ServiceMessage>
      </GetBulkDataResponse>`;
    expect(isBulkLimitResponse(xml)).toBe(true);
  });
});

describe("parseBulkProductsXml", () => {
  it("reads part qty and price from Bulk Data Product nodes", () => {
    const xml = `
      <BulkDataResponse>
        <Product>
          <productId>19920-1</productId>
          <productName>OGIO CRUNCH DUFFEL</productName>
          <style>108085</style>
          <size>OSFA</size>
          <swatchColor>Black</swatchColor>
          <brand>OGIO</brand>
          <image>https://media.sanmarcanada.com/catalog/product/1/0/108085_black_2011.jpg</image>
          <quantity>1553</quantity>
          <price>42.66</price>
        </Product>
      </BulkDataResponse>
    `;
    expect(parseBulkProductsXml(xml)).toEqual([
      {
        partId: "19920-1",
        styleId: "108085",
        colorName: "Black",
        sizeName: "OSFA",
        quantity: 1553,
        price: 42.66,
        imageUrl:
          "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_2011.jpg",
        productName: "OGIO CRUNCH DUFFEL",
        brandName: "OGIO",
      },
    ]);
  });

  it("keeps a Bulk hex when the vendor actually sent one", () => {
    const xml = `
      <BulkDataResponse>
        <Product>
          <productId>19920-1</productId>
          <style>108085</style>
          <swatchColor>Black</swatchColor>
          <hex>111111</hex>
          <image>https://media.example.com/108085_black_2011.jpg</image>
          <quantity>1</quantity>
          <price>1</price>
        </Product>
      </BulkDataResponse>
    `;
    expect(parseBulkProductsXml(xml)[0]?.colorHex).toBe("#111111");
  });
});

describe("extractVendorHex / parseProductColorBlocks", () => {
  it("accepts a PromoStandards hex and ignores a colour name", () => {
    expect(extractVendorHex("000000")).toBe("#000000");
    expect(extractVendorHex("#AbC")).toBe("#aabbcc");
    expect(extractVendorHex("Black")).toBeUndefined();
  });

  it("reads hex from a Color block when present", () => {
    const xml = `
      <Product>
        <ColorArray>
          <Color>
            <colorName>Black</colorName>
            <hex>111111</hex>
          </Color>
          <Color>
            <colorName>Athletic Gold</colorName>
          </Color>
        </ColorArray>
      </Product>
    `;
    expect(parseProductColorBlocks(xml)).toEqual([
      { colorName: "Black", hex: "#111111" },
      { colorName: "Athletic Gold" },
    ]);
  });
});

describe("productPartsToSkus", () => {
  it("keeps each ProductPart url on that colour and does not copy images[0]", () => {
    const gold =
      "https://media.sanmarcanada.com/catalog/product/1/0/108085_athletic_gold_2011.jpg";
    const black =
      "https://media.sanmarcanada.com/catalog/product/1/0/108085_black_2011.jpg";
    const xml = `
      <Product>
        <ProductPart>
          <partId>19920-1</partId>
          <colorName>Black</colorName>
          <labelSize>OSFA</labelSize>
          <url>${black}</url>
        </ProductPart>
        <ProductPart>
          <partId>19920-2</partId>
          <colorName>Athletic Gold</colorName>
          <labelSize>OSFA</labelSize>
        </ProductPart>
      </Product>
    `;
    const skus = productPartsToSkus(
      {
        productId: "108085",
        productName: "OGIO CRUNCH DUFFEL",
        images: [gold],
      },
      xml,
    );
    expect(skus.find((sku) => sku.colorName === "Black")?.imageUrl).toBe(black);
    expect(
      skus.find((sku) => sku.colorName === "Athletic Gold")?.imageUrl,
    ).toBeUndefined();
  });
});
