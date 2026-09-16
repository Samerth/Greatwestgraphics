import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { CommerceHeaders } from "@gwg/contracts";

import {
  buildQuoteForward,
  isCodChatAuthorized,
  isForwardableQuoteBody,
} from "./codchat-relay";

/**
 * The estimate relay (16 Sep). CodChat's Estimate connector already posts a
 * StorefrontQuoteRequestSchema body to `{baseUrl}/pricing/quote`; this is
 * the public door it was missing - the same shape as the order-status relay.
 */
describe("CodChat's shared token", () => {
  it("is the only thing that opens the relay", () => {
    expect(isCodChatAuthorized("Bearer abc", "abc")).toBe(true);
    expect(isCodChatAuthorized("Bearer abd", "abc")).toBe(false);
    expect(isCodChatAuthorized("abc", "abc")).toBe(false);
    expect(isCodChatAuthorized(null, "abc")).toBe(false);
    // An unconfigured token must not become "anything goes".
    expect(isCodChatAuthorized("Bearer ", "")).toBe(false);
    expect(isCodChatAuthorized("Bearer abc", undefined)).toBe(false);
  });
});

describe("what gets forwarded", () => {
  const scope = { tenantId: "t-1", accountId: "a-1", storeId: "s-1" };

  it("targets the commerce API's quote endpoint with the service token and tenant scope", () => {
    const { url, init } = buildQuoteForward({
      baseUrl: "http://api.internal:4000",
      serviceToken: "svc-token",
      scope,
      body: { qty: 24, sku: "5000", decorations: [{ method: "screenPrint", location: "front", colours: 1 }] },
    });
    expect(url).toBe("http://api.internal:4000/pricing/quote");
    expect(init.method).toBe("POST");
    const headers = new Headers(init.headers);
    expect(headers.get("authorization")).toBe("Bearer svc-token");
    expect(headers.get(CommerceHeaders.tenantId)).toBe("t-1");
    expect(headers.get(CommerceHeaders.accountId)).toBe("a-1");
    expect(headers.get(CommerceHeaders.storeId)).toBe("s-1");
    expect(headers.get("content-type")).toBe("application/json");
  });

  it("passes the body through untouched, so the pricing engine validates it", () => {
    const body = { qty: 24, sku: "5000", rush: true };
    const { init } = buildQuoteForward({ baseUrl: "http://api", serviceToken: "x", scope, body });
    expect(JSON.parse(String(init.body))).toEqual(body);
  });

  it("sends no bearer when the environment has no service token (local dev)", () => {
    const { init } = buildQuoteForward({ baseUrl: "http://api", serviceToken: undefined, scope, body: { qty: 1 } });
    expect(new Headers(init.headers).get("authorization")).toBeNull();
  });

  it("refuses obvious junk before spending a round trip", () => {
    expect(isForwardableQuoteBody({ qty: 24, sku: "5000" })).toBe(true);
    expect(isForwardableQuoteBody({ qty: 0 })).toBe(false);
    expect(isForwardableQuoteBody({ qty: "24" })).toBe(false);
    expect(isForwardableQuoteBody([])).toBe(false);
    expect(isForwardableQuoteBody(null)).toBe(false);
    expect(isForwardableQuoteBody("qty=24")).toBe(false);
  });
});

describe("the route", () => {
  const route = readFileSync(resolve(process.cwd(), "app/api/codchat/pricing/quote/route.ts"), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");

  it("lives where CodChat's default operation path expects it", () => {
    // baseUrl https://<site>/api/codchat + path /pricing/quote
    expect(route).toContain('export async function POST');
    expect(route).toContain("process.env.CODCHAT_LOOKUP_API_TOKEN");
    expect(route).toContain("process.env.COMMERCE_SERVICE_TOKEN");
    expect(route).toContain("resolveStoreContext()");
  });

  it("is never cached", () => {
    expect(route).toContain('export const dynamic = "force-dynamic"');
  });

  it("hands the pricing engine's own status back", () => {
    expect(route).toContain("NextResponse.json(payload, { status: response.status })");
  });
});
