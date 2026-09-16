import { NextResponse } from "next/server";
import {
  buildQuoteForward,
  isCodChatAuthorized,
  isForwardableQuoteBody,
} from "@/lib/commerce/codchat-relay";
import { resolveStoreContext } from "@/lib/commerce/store-context";

// A live quote every time, never cached or statically rendered.
export const dynamic = "force-dynamic";

/**
 * Public relay for CodChat's Estimate operation.
 *
 * CodChat's connector was built to POST a StorefrontQuoteRequestSchema body
 * (qty, product_id or sku, decorations[], rush) to `{baseUrl}/pricing/quote`
 * and read back unit_price / total / turnaround_days / currency. The commerce
 * API answers exactly that at `POST /pricing/quote` - but only on the
 * internal load balancer. This route is the public front door: it checks
 * CodChat's shared token, forwards the body unchanged with the web tier's
 * own service credentials and tenant scope, and hands back whatever the
 * pricing engine says, status code included.
 *
 * Nothing about pricing lives here. The figure a customer gets in the chat
 * comes from the same engine, the same published config and the same
 * catalogue lookup as the product page - which is the point (UAT row 53).
 *
 * Connector settings on the CodChat side: base URL
 * `https://<site>/api/codchat`, operation path `/pricing/quote`, bearer
 * credential = CODCHAT_LOOKUP_API_TOKEN (the same value the Order Status
 * connector already holds).
 */
export async function POST(request: Request) {
  if (!isCodChatAuthorized(request.headers.get("authorization"), process.env.CODCHAT_LOOKUP_API_TOKEN)) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid CodChat credentials" } },
      { status: 401 },
    );
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isForwardableQuoteBody(body)) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "A quote needs a JSON body with a positive qty and a product_id or sku.",
        },
      },
      { status: 400 },
    );
  }

  const baseUrl = process.env.COMMERCE_API_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json(
      {
        error: {
          code: "COMMERCE_API_UNAVAILABLE",
          message: "Quotes are not configured for this environment",
        },
      },
      { status: 503 },
    );
  }

  const scope = await resolveStoreContext();
  const forward = buildQuoteForward({
    baseUrl,
    serviceToken: process.env.COMMERCE_SERVICE_TOKEN,
    scope: { tenantId: scope.tenantId, accountId: scope.accountId, storeId: scope.storeId },
    body,
  });

  let response: Response;
  try {
    response = await fetch(forward.url, forward.init);
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "COMMERCE_API_UNAVAILABLE",
          message: "Quotes are unavailable right now. Please try again shortly.",
        },
      },
      { status: 503 },
    );
  }

  const payload: unknown = await response.json().catch(() => ({
    error: {
      code: "COMMERCE_API_ERROR",
      message: "The pricing service returned an unexpected response",
    },
  }));
  return NextResponse.json(payload, { status: response.status });
}
