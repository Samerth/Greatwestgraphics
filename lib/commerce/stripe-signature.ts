import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Stripe webhook signature check.
 *
 * Written out rather than pulled from the SDK for the same reason as the API
 * client: it is five lines of HMAC and the whole security of the payment path
 * rests on it, so it should be readable here. Mirrors Stripe's documented
 * scheme — `t=<unix>,v1=<hmac>` over `<t>.<raw body>`.
 */
export function verifyStripeSignature(input: {
  payload: string;
  header: string | null;
  secret: string;
  toleranceSeconds?: number;
  nowSeconds?: number;
}): { ok: true } | { ok: false; reason: string } {
  if (!input.header) return { ok: false, reason: "Missing stripe-signature header" };

  const parts = Object.fromEntries(
    input.header.split(",").map((piece) => {
      const [key, ...rest] = piece.trim().split("=");
      return [key, rest.join("=")];
    }),
  ) as { t?: string; v1?: string };

  if (!parts.t || !parts.v1) {
    return { ok: false, reason: "Malformed stripe-signature header" };
  }

  const timestamp = Number(parts.t);
  if (!Number.isFinite(timestamp)) {
    return { ok: false, reason: "Malformed signature timestamp" };
  }

  const tolerance = input.toleranceSeconds ?? 300;
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > tolerance) {
    // Blocks replay of a captured webhook long after the fact.
    return { ok: false, reason: "Signature timestamp outside tolerance" };
  }

  const expected = createHmac("sha256", input.secret)
    .update(`${parts.t}.${input.payload}`)
    .digest("hex");
  const given = Buffer.from(parts.v1, "utf8");
  const mine = Buffer.from(expected, "utf8");
  if (given.length !== mine.length || !timingSafeEqual(given, mine)) {
    return { ok: false, reason: "Signature mismatch" };
  }
  return { ok: true };
}
