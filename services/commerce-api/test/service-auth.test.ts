import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import {
  DevelopmentHeaderAuth,
  InvalidServiceTokenError,
  ServiceTokenAuth,
  secretsMatch,
} from "../src/auth.js";
import { adminRoutesEnabled, loadEnvironment } from "../src/config.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const STORE = "33333333-3333-4333-8333-333333333333";
const TOKEN = "s".repeat(40);

function request(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

function scopeHeaders(extra: Record<string, string> = {}) {
  return {
    "x-tenant-id": TENANT,
    "x-account-id": ACCOUNT,
    "x-store-id": STORE,
    ...extra,
  };
}

describe("secretsMatch", () => {
  it("accepts an identical secret and rejects everything else", () => {
    expect(secretsMatch(TOKEN, TOKEN)).toBe(true);
    expect(secretsMatch(`${TOKEN}x`, TOKEN)).toBe(false);
    expect(secretsMatch(TOKEN.slice(0, -1), TOKEN)).toBe(false);
    expect(secretsMatch("", TOKEN)).toBe(false);
  });

  it("does not throw on a length mismatch", () => {
    expect(() => secretsMatch("short", TOKEN)).not.toThrow();
    expect(() => secretsMatch("x".repeat(500), TOKEN)).not.toThrow();
  });
});

describe("ServiceTokenAuth", () => {
  const auth = new ServiceTokenAuth(TOKEN);

  it("resolves the tenant scope when the bearer token matches", async () => {
    const context = await auth.resolve(
      request(scopeHeaders({ authorization: `Bearer ${TOKEN}` })),
    );
    expect(context.tenantId).toBe(TENANT);
    expect(context.accountId).toBe(ACCOUNT);
    expect(context.storeId).toBe(STORE);
  });

  it("refuses correct tenant headers without a token", async () => {
    await expect(auth.resolve(request(scopeHeaders()))).rejects.toBeInstanceOf(
      InvalidServiceTokenError,
    );
  });

  it("refuses a wrong token, a non-bearer scheme and a bare token", async () => {
    const rejected = [
      { authorization: `Bearer ${"w".repeat(40)}` },
      { authorization: `Basic ${TOKEN}` },
      { authorization: TOKEN },
    ];
    for (const headers of rejected) {
      await expect(
        auth.resolve(request(scopeHeaders(headers))),
      ).rejects.toBeInstanceOf(InvalidServiceTokenError);
    }
  });

  it("checks the token before trusting any tenant header", async () => {
    // A caller with no credentials must not be able to tell a malformed tenant
    // id from a valid one, or the endpoint becomes a scope probe.
    await expect(
      auth.resolve(request({ "x-tenant-id": "not-a-uuid" })),
    ).rejects.toBeInstanceOf(InvalidServiceTokenError);
  });
});

describe("DevelopmentHeaderAuth", () => {
  it("keeps refusing in production so an unconfigured deployment stays shut", async () => {
    await expect(
      new DevelopmentHeaderAuth(true).resolve(request(scopeHeaders())),
    ).rejects.toThrow(/not configured/i);
  });

  it("still accepts plain headers outside production", async () => {
    const context = await new DevelopmentHeaderAuth(false).resolve(
      request(scopeHeaders()),
    );
    expect(context.tenantId).toBe(TENANT);
  });
});

describe("admin route availability", () => {
  const base = {
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
  };

  it("serves admin routes in production when an admin token is configured", () => {
    const environment = loadEnvironment({
      ...base,
      NODE_ENV: "production",
      ADMIN_API_TOKEN: "a".repeat(40),
    } as NodeJS.ProcessEnv);
    expect(adminRoutesEnabled(environment)).toBe(true);
  });

  it("leaves them closed in production when no token is configured", () => {
    const environment = loadEnvironment({
      ...base,
      NODE_ENV: "production",
    } as NodeJS.ProcessEnv);
    expect(adminRoutesEnabled(environment)).toBe(false);
  });

  it("refuses an admin token equal to the service token", () => {
    expect(() =>
      loadEnvironment({
        ...base,
        NODE_ENV: "production",
        COMMERCE_SERVICE_TOKEN: TOKEN,
        ADMIN_API_TOKEN: TOKEN,
      } as NodeJS.ProcessEnv),
    ).toThrow(/must differ/i);
  });

  it("still refuses the development flag in production", () => {
    expect(() =>
      loadEnvironment({
        ...base,
        NODE_ENV: "production",
        ENABLE_DEV_ADMIN_ROUTES: "true",
        DEV_ADMIN_TOKEN: "d".repeat(20),
      } as NodeJS.ProcessEnv),
    ).toThrow(/cannot be enabled in production/i);
  });
});
