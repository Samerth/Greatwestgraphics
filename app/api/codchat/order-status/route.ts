import { NextResponse } from "next/server";
import { z } from "zod";

// Real per-request lookup, never cached or statically generated.
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  orderRef: z.string().trim().min(1).max(80),
  verifiedEmail: z.string().trim().email().max(320),
});

/**
 * Public relay for CodChat's order-status lookup.
 *
 * commerce-api has no public address of its own — it sits behind an
 * internal load balancer reachable only from this web server (see
 * infra/cloudshell/README.md: "the commerce API is served by an internal
 * load balancer with no public address... port 4000 is closed to the
 * internet"). This route is the bridge: the one new public surface CodChat's
 * connector actually calls. Its entire job is to check CodChat's shared
 * password, forward the same two fields over the private connection this
 * server already has to commerce-api, and hand back whatever it says.
 *
 * All the real logic — checking the email actually matches the order's
 * owner, deciding what "In production" etc. means, limiting the response to
 * three safe fields, refusing to distinguish "no such order" from "wrong
 * email" — lives entirely in commerce-api's own
 * codchat-order-lookup-service.ts and is untouched by this file. This route
 * changes nothing about what can be asked or answered; it only changes
 * which network can ask it.
 *
 * CODCHAT_LOOKUP_API_TOKEN must be set to the identical value here and on
 * commerce-api — two separate deployed processes sharing one secret, not two
 * different ones. Locally both happen to read the same root .env file, which
 * is why this "just works" in development without extra setup; staging and
 * production configure it as two secrets with the same value, one per
 * service (see docs/AWS_DEPLOYMENT.md).
 */
export async function GET(request: Request) {
  const token = process.env.CODCHAT_LOOKUP_API_TOKEN;
  const header = request.headers.get("authorization");
  if (
    !token ||
    !header?.startsWith("Bearer ") ||
    header.slice("Bearer ".length) !== token
  ) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Invalid CodChat credentials" } },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    orderRef: url.searchParams.get("orderRef") ?? undefined,
    verifiedEmail: url.searchParams.get("verifiedEmail") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid request",
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
          message: "Order lookup is not configured for this environment",
        },
      },
      { status: 503 },
    );
  }

  const upstream = new URL("/v1/codchat/order-status", baseUrl);
  upstream.searchParams.set("orderRef", parsed.data.orderRef);
  upstream.searchParams.set("verifiedEmail", parsed.data.verifiedEmail);

  let response: Response;
  try {
    response = await fetch(upstream, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "COMMERCE_API_UNAVAILABLE",
          message: "Order lookup is unavailable right now. Please try again shortly.",
        },
      },
      { status: 503 },
    );
  }

  const payload: unknown = await response.json().catch(() => ({
    error: {
      code: "COMMERCE_API_ERROR",
      message: "Order lookup returned an unexpected response",
    },
  }));
  return NextResponse.json(payload, { status: response.status });
}
