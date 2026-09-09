import { describe, expect, it } from "vitest";
import type { FastifyRequest } from "fastify";
import {
  InvalidServiceTokenError,
  StorefrontQuoteAuth,
} from "../src/auth.js";

const TENANT = "11111111-1111-4111-8111-111111111111";
const ACCOUNT = "22222222-2222-4222-8222-222222222222";
const STORE = "33333333-3333-4333-8333-333333333333";
const CUSTOM_TENANT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOM_ACCOUNT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const CUSTOM_STORE = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const ENV_TENANT = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const ENV_ACCOUNT = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const ENV_STORE = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const TOKEN = "s".repeat(40);

function request(headers: Record<string, string>): FastifyRequest {
  return { headers } as unknown as FastifyRequest;
}

describe("StorefrontQuoteAuth", () => {
  describe("with no env var defaults", () => {
    const auth = new StorefrontQuoteAuth(TOKEN, {
      STOREFRONT_DEFAULT_TENANT_ID: undefined,
      STOREFRONT_DEFAULT_ACCOUNT_ID: undefined,
      STOREFRONT_DEFAULT_STORE_ID: undefined,
    });

    it("returns 401 without valid bearer token", async () => {
      await expect(auth.resolve(request({}))).rejects.toBeInstanceOf(
        InvalidServiceTokenError,
      );
    });

    it("returns 401 with wrong bearer token", async () => {
      await expect(
        auth.resolve(request({ authorization: `Bearer ${"w".repeat(40)}` })),
      ).rejects.toBeInstanceOf(InvalidServiceTokenError);
    });

    it("returns 401 with non-bearer auth scheme", async () => {
      await expect(
        auth.resolve(request({ authorization: `Basic ${TOKEN}` })),
      ).rejects.toBeInstanceOf(InvalidServiceTokenError);
    });

    it("returns 401 with bare token (no Bearer prefix)", async () => {
      await expect(
        auth.resolve(request({ authorization: TOKEN })),
      ).rejects.toBeInstanceOf(InvalidServiceTokenError);
    });

    it("soft-defaults to fallback UUIDs when headers missing and token valid", async () => {
      const context = await auth.resolve(
        request({ authorization: `Bearer ${TOKEN}` }),
      );
      expect(context.tenantId).toBe(TENANT);
      expect(context.accountId).toBe(ACCOUNT);
      expect(context.storeId).toBe(STORE);
    });

    it("uses provided headers when present", async () => {
      const context = await auth.resolve(
        request({
          authorization: `Bearer ${TOKEN}`,
          "x-tenant-id": CUSTOM_TENANT,
          "x-account-id": CUSTOM_ACCOUNT,
          "x-store-id": CUSTOM_STORE,
        }),
      );
      expect(context.tenantId).toBe(CUSTOM_TENANT);
      expect(context.accountId).toBe(CUSTOM_ACCOUNT);
      expect(context.storeId).toBe(CUSTOM_STORE);
    });

    it("fills only missing headers with defaults", async () => {
      const context = await auth.resolve(
        request({
          authorization: `Bearer ${TOKEN}`,
          "x-tenant-id": CUSTOM_TENANT,
        }),
      );
      expect(context.tenantId).toBe(CUSTOM_TENANT);
      expect(context.accountId).toBe(ACCOUNT);
      expect(context.storeId).toBe(STORE);
    });

    it("parses actor id header when present", async () => {
      const actorId = "99999999-9999-4999-8999-999999999999";
      const context = await auth.resolve(
        request({
          authorization: `Bearer ${TOKEN}`,
          "x-actor-id": actorId,
        }),
      );
      expect(context.actor.id).toBe(actorId);
      expect(context.actor.type).toBe("customer");
    });

    it("leaves actor id undefined when not provided", async () => {
      const context = await auth.resolve(
        request({ authorization: `Bearer ${TOKEN}` }),
      );
      expect(context.actor.id).toBeUndefined();
      expect(context.actor.type).toBe("customer");
    });
  });

  describe("with env var defaults configured", () => {
    const auth = new StorefrontQuoteAuth(TOKEN, {
      STOREFRONT_DEFAULT_TENANT_ID: ENV_TENANT,
      STOREFRONT_DEFAULT_ACCOUNT_ID: ENV_ACCOUNT,
      STOREFRONT_DEFAULT_STORE_ID: ENV_STORE,
    });

    it("uses env var defaults when headers missing", async () => {
      const context = await auth.resolve(
        request({ authorization: `Bearer ${TOKEN}` }),
      );
      expect(context.tenantId).toBe(ENV_TENANT);
      expect(context.accountId).toBe(ENV_ACCOUNT);
      expect(context.storeId).toBe(ENV_STORE);
    });

    it("prefers provided headers over env var defaults", async () => {
      const context = await auth.resolve(
        request({
          authorization: `Bearer ${TOKEN}`,
          "x-tenant-id": CUSTOM_TENANT,
          "x-account-id": CUSTOM_ACCOUNT,
          "x-store-id": CUSTOM_STORE,
        }),
      );
      expect(context.tenantId).toBe(CUSTOM_TENANT);
      expect(context.accountId).toBe(CUSTOM_ACCOUNT);
      expect(context.storeId).toBe(CUSTOM_STORE);
    });

    it("fills missing headers with env var defaults (partial)", async () => {
      const context = await auth.resolve(
        request({
          authorization: `Bearer ${TOKEN}`,
          "x-tenant-id": CUSTOM_TENANT,
        }),
      );
      expect(context.tenantId).toBe(CUSTOM_TENANT);
      expect(context.accountId).toBe(ENV_ACCOUNT);
      expect(context.storeId).toBe(ENV_STORE);
    });
  });

  describe("with partial env var defaults", () => {
    const auth = new StorefrontQuoteAuth(TOKEN, {
      STOREFRONT_DEFAULT_TENANT_ID: ENV_TENANT,
      STOREFRONT_DEFAULT_ACCOUNT_ID: undefined,
      STOREFRONT_DEFAULT_STORE_ID: ENV_STORE,
    });

    it("uses env var where set and fallback where not", async () => {
      const context = await auth.resolve(
        request({ authorization: `Bearer ${TOKEN}` }),
      );
      expect(context.tenantId).toBe(ENV_TENANT);
      expect(context.accountId).toBe(ACCOUNT);
      expect(context.storeId).toBe(ENV_STORE);
    });
  });
});
