import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGetBulkDataRequestXml,
  buildGetMediaContentRequestXml,
  buildVendorProxyConfig,
  createSanmarClientFromEnv,
  extractVendorHex,
  isBulkLimitResponse,
  isBulkUnauthorizedResponse,
  NS_BULK,
  parseConfigurationAndPricingXml,
  parseInventoryLevelsXml,
  parseMediaContentXml,
  parsePartInventoryQuantity,
  parseBulkProductsFromStream,
  parseBulkProductsXml,
  parseProductColorBlocks,
  parseSellableProductId,
  productPartsToSkus,
  SanmarBulkLimitError,
  SanmarBulkUnauthorizedError,
  SanmarClient,
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

  it("treats Bulk 'not authorized user' as a refusal, not the daily limit", () => {
    const xml = `
      <GetBulkDataResponse>
        <ServiceMessage>
          <code>104</code>
          <description>You are not authorized user for this call</description>
        </ServiceMessage>
      </GetBulkDataResponse>`;
    expect(isBulkUnauthorizedResponse(xml)).toBe(true);
    expect(isBulkLimitResponse(xml)).toBe(false);
  });
});

describe("Media vs Bulk credentials", () => {
  it("sends the login e-mail to Bulk and the media password only to Media", () => {
    const bulk = buildGetBulkDataRequestXml("161", "buyer@example.com");
    const media = buildGetMediaContentRequestXml(
      "161",
      "edi-media-password",
      "108085",
    );
    expect(bulk).toContain("<password>buyer@example.com</password>");
    expect(bulk).not.toContain("edi-media-password");
    expect(media).toContain(">edi-media-password</password>");
    expect(media).not.toContain("buyer@example.com");
  });

  it("reads SANMAR_MEDIA_PASSWORD from env for Media only", () => {
    const withMedia = createSanmarClientFromEnv({
      SANMAR_ACCOUNT_ID: "161",
      SANMAR_LOGIN_EMAIL: "buyer@example.com",
      SANMAR_MEDIA_PASSWORD: "edi-media-password",
    });
    const withoutMedia = createSanmarClientFromEnv({
      SANMAR_ACCOUNT_ID: "161",
      SANMAR_LOGIN_EMAIL: "buyer@example.com",
    });
    expect(withMedia?.hasMediaPassword).toBe(true);
    expect(withoutMedia?.hasMediaPassword).toBe(false);
  });

  it("maps SANMAR_MEDIA_PASSWORD in the ECS vendor-secret task definition", () => {
    const root = resolve(import.meta.dirname, "../../../../../");
    const ecs = readFileSync(
      resolve(root, "infra/cloudshell/scripts/09-create-ecs.sh"),
      "utf8",
    );
    const retarget = readFileSync(
      resolve(root, "infra/cloudshell/scripts/18-retarget-ecs.sh"),
      "utf8",
    );
    expect(ecs).toContain('name:"SANMAR_MEDIA_PASSWORD"');
    expect(ecs).toContain("SANMAR_ACCOUNT_ID");
    expect(ecs).not.toMatch(
      /buildGetBulkDataRequestXml\([\s\S]*SANMAR_MEDIA_PASSWORD/,
    );
    expect(retarget).toContain("SANMAR_MEDIA_PASSWORD");
  });
});

/**
 * SanMar registered one fixed address for account 161 (30 Sep 2026 — see the
 * doc comment on SanmarClientOptions.vendorProxyUrl). Every SanMar call routes
 * through one small always-on box at that address when configured.
 */
describe("buildVendorProxyConfig", () => {
  it("calls SanMar directly when no proxy URL is configured", () => {
    expect(buildVendorProxyConfig({})).toBeUndefined();
  });

  it("builds a plain proxy config with no credentials", () => {
    expect(
      buildVendorProxyConfig({ vendorProxyUrl: "http://198.51.100.10:8888" }),
    ).toEqual({ uri: "http://198.51.100.10:8888" });
  });

  it("adds a Basic auth token when a username is set", () => {
    const config = buildVendorProxyConfig({
      vendorProxyUrl: "http://198.51.100.10:8888",
      vendorProxyUsername: "gwg",
      vendorProxyPassword: "s3cret",
    });
    expect(config?.uri).toBe("http://198.51.100.10:8888");
    expect(config?.token).toBe(
      `Basic ${Buffer.from("gwg:s3cret").toString("base64")}`,
    );
  });

  it("never puts the raw password in the token — only the base64 pair", () => {
    const config = buildVendorProxyConfig({
      vendorProxyUrl: "http://198.51.100.10:8888",
      vendorProxyUsername: "gwg",
      vendorProxyPassword: "s3cret",
    });
    expect(config?.token).not.toContain("s3cret");
  });

  it("tolerates a username with no password rather than throwing", () => {
    const config = buildVendorProxyConfig({
      vendorProxyUrl: "http://198.51.100.10:8888",
      vendorProxyUsername: "gwg",
    });
    expect(config?.token).toBe(`Basic ${Buffer.from("gwg:").toString("base64")}`);
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

/**
 * Shaped like the real 1 Oct 2026 reply (20,583 parts, ~50 MB): one namespace
 * prefix on everything, French text with accents and trademark glyphs, a
 * $0 part, a part with no image, and the ServiceMessage after the product list.
 */
const BULK_ENVELOPE_HEAD =
  '<?xml version="1.0" encoding="UTF-8"?>\n<SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://edi.atc-apparel.com/bulk-data/"><SOAP-ENV:Body><ns1:GetBulkDataResponse><ns1:ProductInventoryArray>';
const BULK_ENVELOPE_TAIL =
  '</ns1:ProductInventoryArray><ns1:ServiceMessageArray><ns1:ServiceMessage><ns1:code>200</ns1:code><ns1:description>No Error - Information Requested.</ns1:description><ns1:severity>Information</ns1:severity></ns1:ServiceMessage></ns1:ServiceMessageArray></ns1:GetBulkDataResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';

function bulkPart(input: {
  id: string;
  style: string;
  color: string;
  size: string;
  price: string;
  qty?: number;
  image?: string;
  name?: string;
}): string {
  return (
    `<ns1:Product><ns1:productId>${input.id}</ns1:productId>` +
    `<ns1:productName>${input.name ?? "ATC™ YUPOONG® CASQUETTE"}</ns1:productName>` +
    `<ns1:frProductName>ATCᴹᶜ CASQUETTE CAMIONNEUR RÉTRO</ns1:frProductName>` +
    `<ns1:style>${input.style}</ns1:style><ns1:size>${input.size}</ns1:size>` +
    `<ns1:swatchColor>${input.color}</ns1:swatchColor><ns1:frSwatchColor>Pétrole</ns1:frSwatchColor>` +
    `<ns1:description>Poign&amp;eacute;es &amp;quot;h&amp;quot;</ns1:description>` +
    `<ns1:brand>Yupoong</ns1:brand><ns1:image>${input.image ?? ""}</ns1:image>` +
    `<ns1:weight>0.25</ns1:weight><ns1:caseSize>144</ns1:caseSize><ns1:youth xsi:nil="true"/>` +
    `<ns1:discountCode>S</ns1:discountCode><ns1:quantity>${input.qty ?? 5}</ns1:quantity>` +
    `<ns1:price>${input.price}</ns1:price><ns1:salePrice></ns1:salePrice>` +
    `<ns1:saleEndDate></ns1:saleEndDate><ns1:priceGroup>4</ns1:priceGroup></ns1:Product>`
  );
}

const BULK_PARTS = [
  bulkPart({
    id: "36533-1",
    style: "ATC6606",
    color: "Royal/White",
    size: "OSFA",
    price: "10.99",
    qty: 530,
    image:
      "https://media.sanmarcanada.com/catalog/product/a/t/atc6606_royal_white.jpg",
  }),
  bulkPart({ id: "17977-1", style: "NF0A529K", color: "Noir", size: "S", price: "0.00", qty: 0 }),
  bulkPart({
    id: "17977-2",
    style: "NF0A529K",
    color: "Noir",
    size: "M",
    price: "89.5",
    qty: 12,
    image: "https://media.sanmarcanada.com/catalog/product/n/f/nf0a529k_flat_noir.jpg",
  }),
];
const BULK_REPLY = BULK_ENVELOPE_HEAD + BULK_PARTS.join("") + BULK_ENVELOPE_TAIL;

/** Splits text into byte chunks of `size`, which cuts through multi-byte characters. */
async function* bytesIn(text: string, size: number): AsyncGenerator<Uint8Array> {
  const bytes = new TextEncoder().encode(text);
  for (let i = 0; i < bytes.length; i += size) yield bytes.slice(i, i + size);
}

describe("parseBulkProductsFromStream", () => {
  const expected = parseBulkProductsXml(BULK_REPLY);

  it("sanity: the fixture has three parts, one of them priced 0", () => {
    expect(expected).toHaveLength(3);
    expect(expected.map((row) => row.price)).toEqual([10.99, 0, 89.5]);
  });

  it.each([1, 2, 3, 7, 64, 1000, 1_000_000])(
    "gives the same rows as the whole-string parser with %i-byte chunks",
    async (size) => {
      const { products } = await parseBulkProductsFromStream(
        bytesIn(BULK_REPLY, size),
      );
      expect(products).toEqual(expected);
    },
  );

  it("keeps the envelope and ServiceMessage, and none of the product text, as residual", async () => {
    const { residual } = await parseBulkProductsFromStream(
      bytesIn(BULK_REPLY, 5),
    );
    expect(residual).toContain("<ns1:code>200</ns1:code>");
    expect(residual).toContain("No Error - Information Requested.");
    expect(residual).not.toContain("17977-1");
    expect(residual).not.toContain("CASQUETTE");
  });

  it("reads a refusal: no products, the message intact", async () => {
    const refusal =
      '<?xml version="1.0"?><SOAP-ENV:Envelope xmlns:SOAP-ENV="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ns1="https://edi.atc-apparel.com/bulk-data/"><SOAP-ENV:Body><ns1:GetBulkDataResponse><ns1:ProductInventoryArray><ns1:Product><ns1:productId/><ns1:style/></ns1:Product></ns1:ProductInventoryArray><ns1:ServiceMessageArray><ns1:ServiceMessage><ns1:code>120</ns1:code><ns1:description>You are not authorized user for this call.</ns1:description></ns1:ServiceMessage></ns1:ServiceMessageArray></ns1:GetBulkDataResponse></SOAP-ENV:Body></SOAP-ENV:Envelope>';
    const { products, residual } = await parseBulkProductsFromStream(
      bytesIn(refusal, 9),
    );
    expect(products).toEqual([]);
    expect(isBulkUnauthorizedResponse(residual)).toBe(true);
  });

  it("does not mistake ProductInventoryArray or <productId> for a Product block", async () => {
    const { products } = await parseBulkProductsFromStream(
      bytesIn(BULK_ENVELOPE_HEAD + BULK_ENVELOPE_TAIL, 3),
    );
    expect(products).toEqual([]);
  });

  it("reads an unprefixed reply too", async () => {
    const plain =
      "<BulkDataResponse><Product><productId>1-1</productId><style>S1</style><quantity>2</quantity><price>3.5</price></Product></BulkDataResponse>";
    const { products } = await parseBulkProductsFromStream(bytesIn(plain, 4));
    expect(products).toEqual(parseBulkProductsXml(plain));
    expect(products).toHaveLength(1);
  });

  it("bounds what it keeps of a huge reply that has no products", async () => {
    const junk = "x".repeat(2_000_000);
    const { products, residual } = await parseBulkProductsFromStream(
      bytesIn(junk, 65_536),
    );
    expect(products).toEqual([]);
    expect(residual.length).toBeLessThanOrEqual(256 * 1024);
  });
});

describe("SanmarClient.getBulkProducts", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubBulkFetch(body: string, status = 200) {
    const sent: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init: { body: string }) => {
        sent.push(init.body);
        return new Response(body, { status });
      }),
    );
    return sent;
  }

  const client = (extra: Partial<ConstructorParameters<typeof SanmarClient>[0]> = {}) =>
    new SanmarClient({
      accountId: "161",
      loginEmail: "info@shop.example",
      ...extra,
    });

  it("returns every part from a real-shaped reply", async () => {
    stubBulkFetch(BULK_REPLY);
    const rows = await client().getBulkProducts();
    expect(rows.map((row) => row.partId)).toEqual([
      "36533-1",
      "17977-1",
      "17977-2",
    ]);
  });

  it("sends the shop login to Bulk when no Bulk login is set", async () => {
    const sent = stubBulkFetch(BULK_REPLY);
    await client().getBulkProducts();
    expect(sent[0]).toContain("<password>info@shop.example</password>");
    expect(sent[0]).toContain("<id>161</id>");
  });

  it("sends the Bulk login, not the shop login, when one is set", async () => {
    const sent = stubBulkFetch(BULK_REPLY);
    await client({ bulkLoginEmail: " harvey@shop.example " }).getBulkProducts();
    expect(sent[0]).toContain("<password>harvey@shop.example</password>");
    expect(sent[0]).not.toContain("info@shop.example");
  });

  it("reads SANMAR_BULK_LOGIN_EMAIL from env", async () => {
    const sent = stubBulkFetch(BULK_REPLY);
    const fromEnv = createSanmarClientFromEnv({
      SANMAR_ACCOUNT_ID: "161",
      SANMAR_LOGIN_EMAIL: "info@shop.example",
      SANMAR_BULK_LOGIN_EMAIL: "harvey@shop.example",
    });
    await fromEnv!.getBulkProducts();
    expect(sent[0]).toContain("<password>harvey@shop.example</password>");
  });

  it("throws the not-authorized error for a code 120 reply", async () => {
    stubBulkFetch(
      '<Envelope><Body><GetBulkDataResponse><ProductInventoryArray><Product><productId/></Product></ProductInventoryArray><ServiceMessageArray><ServiceMessage><code>120</code><description>You are not authorized user for this call.</description></ServiceMessage></ServiceMessageArray></GetBulkDataResponse></Body></Envelope>',
    );
    await expect(client().getBulkProducts()).rejects.toBeInstanceOf(
      SanmarBulkUnauthorizedError,
    );
  });

  it("throws the daily-limit error for a code 125 reply", async () => {
    stubBulkFetch(
      "<Envelope><Body><GetBulkDataResponse><ServiceMessageArray><ServiceMessage><code>125</code><description>Reached maximum limit of call</description></ServiceMessage></ServiceMessageArray></GetBulkDataResponse></Body></Envelope>",
    );
    await expect(client().getBulkProducts()).rejects.toBeInstanceOf(
      SanmarBulkLimitError,
    );
  });

  it("still classifies a refusal or limit that arrives as an HTTP 500 fault", async () => {
    stubBulkFetch(
      "<Envelope><Body><Fault><faultstring>Reached maximum limit of call</faultstring></Fault></Body></Envelope>",
      500,
    );
    await expect(client().getBulkProducts()).rejects.toBeInstanceOf(
      SanmarBulkLimitError,
    );
  });

  it("is not fooled by product text that mentions a limit", async () => {
    stubBulkFetch(
      BULK_ENVELOPE_HEAD +
        bulkPart({
          id: "1-1",
          style: "S1",
          color: "Black",
          size: "M",
          price: "5",
          name: "Rate limit already called 1 call mug",
        }) +
        BULK_ENVELOPE_TAIL,
    );
    const rows = await client().getBulkProducts();
    expect(rows).toHaveLength(1);
  });

  it("refuses an empty success rather than reporting zero parts as fine", async () => {
    stubBulkFetch(BULK_ENVELOPE_HEAD + BULK_ENVELOPE_TAIL);
    await expect(client().getBulkProducts()).rejects.toThrow(
      /No Error - Information Requested/,
    );
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
