import { describe, expect, it } from "vitest";
import {
  parseConfigurationAndPricingXml,
  parseInventoryLevelsXml,
  parseMediaContentXml,
  parsePartInventoryQuantity,
  parseBulkProductsXml,
  parseSellableProductId,
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
});
