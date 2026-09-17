import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { CommerceHeaders } from "@gwg/contracts";
import { PricingValidationErrorV2 } from "@gwg/pricing";
import { buildApp } from "../src/app.js";
import { DevelopmentHeaderAuth } from "../src/auth.js";
import { loadEnvironment } from "../src/config.js";
import type { CommerceDatabase } from "../src/db/client.js";

/**
 * A quote request the shop cannot honour as asked - a method it does not
 * price, ten colours on a screen print - used to fall through the error
 * handler as a 500 "An unexpected error occurred". CodChat's estimate tool
 * read that as an outage and told the customer the pricing service was
 * down (17 Sep). It is the caller's request that needs changing, so it is
 * a 400 with the reason.
 *
 * No database: the unpriceable method is refused before any query, and the
 * Proxy below turns any database touch into a failure.
 */
describe("an unpriceable quote request is the caller's problem, not a server fault", () => {
  let app: FastifyInstance;

  const headers = {
    [CommerceHeaders.tenantId]: randomUUID(),
    [CommerceHeaders.accountId]: randomUUID(),
    [CommerceHeaders.storeId]: randomUUID(),
    [CommerceHeaders.actorId]: randomUUID(),
  };

  beforeEach(async () => {
    const db = new Proxy(
      {},
      {
        get(_target, property) {
          throw new Error(`database touched via ${String(property)}`);
        },
      },
    ) as unknown as CommerceDatabase;

    app = buildApp({
      db,
      auth: new DevelopmentHeaderAuth(false),
      environment: loadEnvironment({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        NODE_ENV: "test",
      } as NodeJS.ProcessEnv),
    });
    // A route that fails the way the pricing engine fails, so the handler's
    // mapping is exercised without a published config or a database.
    app.get("/__test/pricing-validation", async () => {
      throw new PricingValidationErrorV2("Screen print supports 1–8 colours, got 10");
    });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("refuses a decoration method the shop cannot price with a 400 that names what it can", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      headers,
      payload: {
        qty: 24,
        garment_cost_minor: 800,
        decorations: [{ method: "sublimation", location: "front" }],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("UNSUPPORTED_DECORATION_METHOD");
    expect(body.error.message).toMatch(/screen print, embroidery or DTF/);
    expect(typeof body.error.requestId).toBe("string");
  });

  it("treats an unknown method string the same way", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/pricing/quote",
      headers,
      payload: {
        qty: 24,
        garment_cost_minor: 800,
        decorations: [{ method: "patches", location: "front" }],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("UNSUPPORTED_DECORATION_METHOD");
  });

  it("passes the pricing engine's own validation errors through as 400 with its message", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/__test/pricing-validation",
      headers,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("PRICING_VALIDATION_ERROR");
    expect(body.error.message).toBe("Screen print supports 1–8 colours, got 10");
  });
});
