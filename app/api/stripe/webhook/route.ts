import { NextResponse } from "next/server";
import { verifyStripeSignature } from "@/lib/commerce/stripe-signature";
import { relayStripeEvent } from "@/lib/commerce/payments-relay";

// The signature is computed over the exact bytes Stripe sent, so this route
// must never be static, cached, or body-parsed by anything upstream.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HANDLED_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
  "payment_intent.payment_failed",
]);

type StripeEvent = {
  id: string;
  type: string;
  data: {
    object: {
      id: string;
      object?: string;
      payment_status?: string | null;
      status?: string | null;
      amount_total?: number | null;
      amount?: number | null;
      currency?: string | null;
      payment_intent?: string | { id: string } | null;
      last_payment_error?: { message?: string } | null;
      metadata?: Record<string, string> | null;
    };
  };
};

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    // Loud, but not to Stripe: a 500 makes Stripe retry, which is what we want
    // while the secret is being configured.
    console.error("STRIPE_WEBHOOK_SECRET is not set; refusing to trust webhooks");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const payload = await request.text();
  const verified = verifyStripeSignature({
    payload,
    header: request.headers.get("stripe-signature"),
    secret,
  });
  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!HANDLED_EVENTS.has(event.type)) {
    return NextResponse.json({ received: true, ignored: event.type });
  }

  const object = event.data.object;
  const metadata = object.metadata ?? {};
  const tenantId = metadata.tenantId;
  const accountId = metadata.accountId;
  const storeId = metadata.storeId;
  if (!tenantId || !accountId || !storeId) {
    // Every session we create carries this metadata; one without it belongs to
    // something else on the same Stripe account.
    return NextResponse.json({ received: true, ignored: "missing metadata" });
  }

  const isPaymentIntent = object.object === "payment_intent";
  const paymentIntentId = isPaymentIntent
    ? object.id
    : typeof object.payment_intent === "string"
      ? object.payment_intent
      : (object.payment_intent?.id ?? null);
  // A checkout.session.* event carries its own id directly. A payment_intent.*
  // event does not — Stripe assigns the Checkout Session id only after we've
  // already created it, so it can never be embedded in the PaymentIntent's own
  // metadata. jobRequestId travels on both, so it's the fallback lookup key.
  const sessionId = isPaymentIntent ? null : object.id;
  const jobRequestId = metadata.jobRequestId ?? null;

  if (!sessionId && !jobRequestId) {
    return NextResponse.json({ received: true, ignored: "no checkout session or job reference" });
  }

  try {
    const result = await relayStripeEvent({
      context: { tenantId, accountId, storeId },
      eventId: event.id,
      eventType: event.type,
      sessionId,
      jobRequestId,
      paymentIntentId,
      amountTotalMinor: object.amount_total ?? object.amount ?? null,
      currency: object.currency ? object.currency.toUpperCase() : null,
      paymentStatus: object.payment_status ?? object.status ?? "unknown",
      failureReason: object.last_payment_error?.message ?? null,
    });
    return NextResponse.json({ received: true, ...result });
  } catch (caught) {
    // 500 so Stripe retries with backoff rather than dropping a real payment.
    console.error("Stripe webhook relay failed", caught);
    return NextResponse.json({ error: "Could not settle payment" }, { status: 500 });
  }
}
