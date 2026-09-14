import { afterEach, describe, expect, it, vi } from "vitest";

import { CommerceHeaders } from "@gwg/contracts";

import { CommerceClient } from "./client";

/**
 * Deleting a saved design from My Designs failed with "An unexpected error
 * occurred" (15 Sep). The client sent `content-type: application/json` on
 * every call, including a DELETE with no body; Fastify then tried to parse an
 * empty body as JSON, refused, and the API reported the refusal as a 500.
 *
 * The header is only true of a request that carries a JSON body, so it is
 * dropped whenever there is nothing to describe. These run the real client
 * against a captured `fetch` rather than reading source, because the bug was
 * in what went over the wire.
 */
const identity = {
  tenantId: "tenant-1",
  accountId: "account-1",
  storeId: "store-1",
  customerPersonId: "person-1",
};

function captureFetch(body = "{}") {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(body, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fetchMock);
  return calls;
}

const sentHeaders = (init: RequestInit) => new Headers(init.headers);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the client only claims a JSON body when it sends one", () => {
  it("sends no content-type on a body-less DELETE", async () => {
    const calls = captureFetch();
    await new CommerceClient("http://api.test", identity).deleteDesignProject("abc");

    expect(calls).toHaveLength(1);
    expect(calls[0].init.method).toBe("DELETE");
    expect(calls[0].url).toBe("http://api.test/v1/design-projects/abc");
    expect(sentHeaders(calls[0].init).has("content-type")).toBe(false);
  });

  it("sends no content-type on a plain GET either", async () => {
    const calls = captureFetch("[]");
    await new CommerceClient("http://api.test", identity).listDesignProjects();

    expect(sentHeaders(calls[0].init).has("content-type")).toBe(false);
  });

  it("still sends it when there is a body", async () => {
    const calls = captureFetch();
    await new CommerceClient("http://api.test", identity).updateDesignProject("abc", {
      name: "Renamed",
    });

    expect(calls[0].init.method).toBe("PUT");
    expect(calls[0].init.body).toBe(JSON.stringify({ name: "Renamed" }));
    expect(sentHeaders(calls[0].init).get("content-type")).toBe("application/json");
  });

  it("keeps the tenant scope headers on the body-less call", () => {
    // Dropping the content-type must not take the identity with it: that is
    // how the API knows whose design is being deleted.
    const calls = captureFetch();
    return new CommerceClient("http://api.test", identity)
      .deleteDesignProject("abc")
      .then(() => {
        const headers = sentHeaders(calls[0].init);
        expect(headers.get(CommerceHeaders.tenantId)).toBe("tenant-1");
        expect(headers.get(CommerceHeaders.accountId)).toBe("account-1");
        expect(headers.get(CommerceHeaders.storeId)).toBe("store-1");
        expect(headers.get(CommerceHeaders.actorId)).toBe("person-1");
      });
  });
});
