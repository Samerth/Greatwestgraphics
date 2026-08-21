/**
 * Minimal Stripe REST client.
 *
 * Deliberately fetch-based rather than the `stripe` npm SDK: the commerce API
 * already speaks HTTP to every other vendor (SanMar, S&S), the SDK pulls in a
 * large dependency for the three calls we make, and a hand-rolled form encoder
 * keeps the request shape visible in review — which matters for money.
 */

const STRIPE_API_BASE = "https://api.stripe.com";
const STRIPE_API_VERSION = "2024-06-20";

export class StripeApiError extends Error {
  readonly code = "STRIPE_API_ERROR";

  constructor(
    message: string,
    readonly status: number,
    readonly stripeCode?: string,
  ) {
    super(message);
  }
}

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  status: string | null;
  paymentStatus: string | null;
  amountTotalMinor: number | null;
  currency: string | null;
  customerId: string | null;
  paymentIntentId: string | null;
  expiresAt: number | null;
};

/** Stripe wants `a[b][c]=v`; nested objects and arrays are flattened here. */
export function encodeForm(
  value: Record<string, unknown>,
  prefix = "",
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, raw] of Object.entries(value)) {
    if (raw === undefined || raw === null) continue;
    const name = prefix ? `${prefix}[${key}]` : key;
    if (Array.isArray(raw)) {
      raw.forEach((entry, index) => {
        if (entry && typeof entry === "object") {
          for (const [k, v] of encodeForm(
            entry as Record<string, unknown>,
            `${name}[${index}]`,
          )) {
            params.append(k, v);
          }
        } else {
          params.append(`${name}[${index}]`, String(entry));
        }
      });
    } else if (typeof raw === "object") {
      for (const [k, v] of encodeForm(raw as Record<string, unknown>, name)) {
        params.append(k, v);
      }
    } else {
      params.append(name, String(raw));
    }
  }
  return params;
}

type StripeSessionPayload = {
  id: string;
  url?: string | null;
  status?: string | null;
  payment_status?: string | null;
  amount_total?: number | null;
  currency?: string | null;
  customer?: string | { id: string } | null;
  payment_intent?: string | { id: string } | null;
  expires_at?: number | null;
};

function normalizeSession(payload: StripeSessionPayload): StripeCheckoutSession {
  const idOf = (value: string | { id: string } | null | undefined) =>
    typeof value === "string" ? value : (value?.id ?? null);
  return {
    id: payload.id,
    url: payload.url ?? null,
    status: payload.status ?? null,
    paymentStatus: payload.payment_status ?? null,
    amountTotalMinor: payload.amount_total ?? null,
    currency: payload.currency ? payload.currency.toUpperCase() : null,
    customerId: idOf(payload.customer),
    paymentIntentId: idOf(payload.payment_intent),
    expiresAt: payload.expires_at ?? null,
  };
}

export class StripeClient {
  constructor(
    private readonly secretKey: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async request<T>(
    path: string,
    init: { method: "GET" | "POST"; body?: URLSearchParams; idempotencyKey?: string },
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetchImpl(`${STRIPE_API_BASE}${path}`, {
        method: init.method,
        headers: {
          authorization: `Bearer ${this.secretKey}`,
          "stripe-version": STRIPE_API_VERSION,
          ...(init.body
            ? { "content-type": "application/x-www-form-urlencoded" }
            : {}),
          // Retrying a create must never create a second charge surface.
          ...(init.idempotencyKey
            ? { "idempotency-key": init.idempotencyKey }
            : {}),
        },
        body: init.body,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new StripeApiError("Stripe is unreachable right now", 503);
    }

    const payload = (await response.json().catch(() => undefined)) as
      | { error?: { message?: string; code?: string } }
      | undefined;

    if (!response.ok) {
      throw new StripeApiError(
        payload?.error?.message ?? "Stripe rejected this request",
        response.status,
        payload?.error?.code,
      );
    }
    return payload as T;
  }

  async createCheckoutSession(input: {
    amountMinor: number;
    currency: string;
    productName: string;
    productDescription?: string;
    customerEmail?: string | null;
    successUrl: string;
    cancelUrl: string;
    clientReferenceId: string;
    metadata: Record<string, string>;
    idempotencyKey: string;
  }): Promise<StripeCheckoutSession> {
    const body = encodeForm({
      mode: "payment",
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      client_reference_id: input.clientReferenceId,
      ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
      // Stripe keeps the receipt and the dashboard row readable for staff who
      // will only ever see the job number.
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: input.currency.toLowerCase(),
            unit_amount: input.amountMinor,
            product_data: {
              name: input.productName,
              ...(input.productDescription
                ? { description: input.productDescription }
                : {}),
            },
          },
        },
      ],
      metadata: input.metadata,
      payment_intent_data: { metadata: input.metadata },
    });

    return normalizeSession(
      await this.request<StripeSessionPayload>("/v1/checkout/sessions", {
        method: "POST",
        body,
        idempotencyKey: input.idempotencyKey,
      }),
    );
  }

  async getCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
    return normalizeSession(
      await this.request<StripeSessionPayload>(
        `/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
        { method: "GET" },
      ),
    );
  }

  async expireCheckoutSession(sessionId: string): Promise<void> {
    await this.request(
      `/v1/checkout/sessions/${encodeURIComponent(sessionId)}/expire`,
      { method: "POST", body: new URLSearchParams() },
    );
  }
}
