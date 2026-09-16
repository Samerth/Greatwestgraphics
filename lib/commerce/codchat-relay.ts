import { CommerceHeaders } from "@gwg/contracts";

/**
 * Shared pieces of the public relays CodChat calls.
 *
 * The commerce API sits behind an internal load balancer with no public
 * address, so CodChat's connectors call the web tier, which checks CodChat's
 * shared token and forwards over the private connection it already has.
 * Order status has done this since 10 Sep; the estimate relay (16 Sep) is
 * the same pattern for `POST /pricing/quote`, which CodChat's Estimate
 * operation was already built to target - its connector just had nowhere
 * public to send it (the configured domain answered 404 for everything).
 */

/** True only for `Authorization: Bearer <exactly the shared token>`. */
export function isCodChatAuthorized(
  authorization: string | null,
  sharedToken: string | undefined,
): boolean {
  if (!sharedToken || !authorization?.startsWith("Bearer ")) return false;
  return authorization.slice("Bearer ".length) === sharedToken;
}

export type TenantScope = { tenantId: string; accountId: string; storeId: string };

/**
 * The upstream request for a quote. The service token is what the quote
 * endpoint trusts from the web tier; the tenant headers say which store's
 * published pricing to use. The body is forwarded as CodChat sent it - the
 * commerce API validates it against StorefrontQuoteRequestSchema and answers
 * its own 400s, which the relay passes straight back.
 */
export function buildQuoteForward(input: {
  baseUrl: string;
  serviceToken: string | undefined;
  scope: TenantScope;
  body: unknown;
}): { url: string; init: RequestInit } {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    [CommerceHeaders.tenantId]: input.scope.tenantId,
    [CommerceHeaders.accountId]: input.scope.accountId,
    [CommerceHeaders.storeId]: input.scope.storeId,
  };
  if (input.serviceToken) headers.authorization = `Bearer ${input.serviceToken}`;
  return {
    url: new URL("/pricing/quote", input.baseUrl).toString(),
    init: {
      method: "POST",
      headers,
      body: JSON.stringify(input.body),
      cache: "no-store",
      // A quote is a catalogue lookup plus a pricing run; on the same VPC it
      // is well under a second, but the ceiling leaves room for a cold start.
      signal: AbortSignal.timeout(30_000),
    },
  };
}

/** A body is forwardable when it is a JSON object with a positive quantity;
 * anything else is refused here rather than costing a round trip. */
export function isForwardableQuoteBody(body: unknown): body is Record<string, unknown> {
  if (!body || typeof body !== "object" || Array.isArray(body)) return false;
  const qty = (body as { qty?: unknown }).qty;
  return typeof qty === "number" && Number.isFinite(qty) && qty > 0;
}
