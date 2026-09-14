import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { CommerceHeaders } from "@gwg/contracts";
import { buildApp } from "../src/app.js";
import { DevelopmentHeaderAuth } from "../src/auth.js";
import { loadEnvironment } from "../src/config.js";
import type { CommerceDatabase } from "../src/db/client.js";

/**
 * A request Fastify itself refuses — an empty body declared as JSON, a body
 * that is not JSON at all — was reported by the error handler as a 500 with
 * "An unexpected error occurred", because only the application's own error
 * classes were recognised and everything else fell through to the server
 * fault. Deleting a saved design from My Designs did exactly that: the web
 * client sent `content-type: application/json` on a body-less DELETE (15 Sep).
 *
 * The web client no longer sends the header without a body, but the API must
 * still call a malformed request what it is. A 4xx tells the caller to fix the
 * request; a 500 tells them the server is broken, and pages on-call for nothing.
 *
 * No database is needed: the request is rejected before any route runs.
 */
describe("a malformed request is reported as the caller's mistake", () => {
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
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it("does not call an empty JSON body on a DELETE a server fault", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/design-projects/${randomUUID()}`,
      headers: { ...headers, "content-type": "application/json" },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error.code).toBe("FST_ERR_CTP_EMPTY_JSON_BODY");
    expect(body.error.message).not.toBe("An unexpected error occurred");
  });

  it("does not call a body that is not JSON a server fault", async () => {
    const response = await app.inject({
      method: "PUT",
      url: `/v1/design-projects/${randomUUID()}`,
      headers: { ...headers, "content-type": "application/json" },
      payload: "{not json",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("FST_ERR_CTP_INVALID_JSON_BODY");
  });

  it("keeps the request id on the reply", async () => {
    const response = await app.inject({
      method: "DELETE",
      url: `/v1/design-projects/${randomUUID()}`,
      headers: { ...headers, "content-type": "application/json" },
    });

    expect(typeof response.json().error.requestId).toBe("string");
  });
});
