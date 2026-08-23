import { CommerceErrorResponseSchema, CommerceHeaders } from "@gwg/contracts";

export type StripeRelayInput = {
  context: { tenantId: string; accountId: string; storeId: string };
  eventId: string;
  eventType: string;
  sessionId: string | null;
  jobRequestId: string | null;
  paymentIntentId: string | null;
  amountTotalMinor: number | null;
  currency: string | null;
  paymentStatus: string;
  failureReason: string | null;
};

/**
 * Hands a verified Stripe event to the commerce API.
 *
 * The webhook has no session and no store cookie, so it cannot go through the
 * normal `createCommerceClient()` path — the tenant scope comes from the
 * metadata we ourselves attached when the Checkout Session was created, and
 * the call is authenticated with the service + admin tokens.
 */
export async function relayStripeEvent(
  input: StripeRelayInput,
): Promise<{ handled: boolean; status: string }> {
  const baseUrl = process.env.COMMERCE_API_BASE_URL;
  const adminToken = process.env.ADMIN_API_TOKEN ?? process.env.DEV_ADMIN_TOKEN;
  const serviceToken = process.env.COMMERCE_SERVICE_TOKEN;
  if (!baseUrl) throw new Error("COMMERCE_API_BASE_URL is required");
  if (!adminToken) throw new Error("ADMIN_API_TOKEN is required to settle payments");

  const response = await fetch(`${baseUrl}/internal/payments/stripe/event`, {
    method: "POST",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      [CommerceHeaders.tenantId]: input.context.tenantId,
      [CommerceHeaders.accountId]: input.context.accountId,
      [CommerceHeaders.storeId]: input.context.storeId,
      [CommerceHeaders.correlationId]: input.eventId,
      "x-dev-admin-token": adminToken,
      ...(serviceToken ? { authorization: `Bearer ${serviceToken}` } : {}),
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(20_000),
  });

  const payload: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    const parsed = CommerceErrorResponseSchema.safeParse(payload);
    throw new Error(
      parsed.success
        ? `${parsed.data.error.code}: ${parsed.data.error.message}`
        : `Commerce API returned ${response.status}`,
    );
  }
  return payload as { handled: boolean; status: string };
}
