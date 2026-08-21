import type {
  Actor,
  CheckoutSessionResponse,
  CreateCheckoutSession,
  StripeWebhookRelay,
} from "@gwg/contracts";
import { and, desc, eq } from "drizzle-orm";
import type { CommerceDatabase } from "../db/client.js";
import {
  finalQuotes,
  jobRequests,
  paymentIntents,
  paymentObligations,
  people,
  stripeCheckoutSessions,
} from "../db/schema.js";
import {
  JobRequestService,
  ResourceNotFoundError,
  CustomerActionError,
} from "./job-request-service.js";
import { StripeClient } from "../adapters/stripe/client.js";

export class PaymentConfigurationError extends Error {
  readonly code = "PAYMENT_NOT_CONFIGURED";
}

/** Something about the money itself does not line up — never mark this paid. */
export class PaymentReconciliationError extends Error {
  readonly code = "PAYMENT_RECONCILIATION_ERROR";
}

type WebhookOutcome = {
  handled: boolean;
  status: "paid" | "processing" | "failed" | "expired" | "ignored" | "duplicate";
};

/**
 * Card payment for an accepted final quote.
 *
 * This does not invent a status: the job sits at `awaiting_payment` exactly as
 * it does for the manual e-transfer path, and only Stripe's webhook moves it on.
 * A customer who opens Checkout and walks away is therefore left where they
 * started, still able to request a manual invoice instead.
 */
export class StripePaymentService {
  constructor(
    private readonly db: CommerceDatabase,
    private readonly stripe: StripeClient,
    private readonly jobRequests: JobRequestService,
    private readonly siteBaseUrl: string,
  ) {}

  async createCheckoutSession(
    jobRequestId: string,
    command: CreateCheckoutSession,
    actor: Actor,
    customerPersonId?: string,
  ): Promise<CheckoutSessionResponse> {
    const { tenantId, accountId, storeId } = command.context;
    if (actor.type !== "customer" || !actor.id) {
      throw new CustomerActionError("Sign in to pay for this job.");
    }

    const [job] = await this.db
      .select()
      .from(jobRequests)
      .where(
        and(
          eq(jobRequests.tenantId, tenantId),
          eq(jobRequests.accountId, accountId),
          eq(jobRequests.id, jobRequestId),
          ...(customerPersonId
            ? [eq(jobRequests.customerPersonId, customerPersonId)]
            : []),
        ),
      )
      .limit(1);
    if (!job) throw new ResourceNotFoundError("Job request not found in account scope");

    if (job.status === "paid" || job.paymentStatus === "succeeded") {
      throw new CustomerActionError("This job is already paid.");
    }
    if (
      job.status !== "awaiting_payment" &&
      job.status !== "payment_failed" &&
      job.status !== "payment_pending"
    ) {
      throw new CustomerActionError(
        "Card payment opens once you accept the final quote.",
      );
    }

    const [latestQuote] = await this.db
      .select()
      .from(finalQuotes)
      .where(
        and(
          eq(finalQuotes.tenantId, tenantId),
          eq(finalQuotes.accountId, accountId),
          eq(finalQuotes.jobRequestId, jobRequestId),
        ),
      )
      .orderBy(desc(finalQuotes.version))
      .limit(1);
    if (!latestQuote?.acceptedAt) {
      throw new CustomerActionError(
        "Accept the final quote before paying.",
      );
    }

    const [obligation] = await this.db
      .select()
      .from(paymentObligations)
      .where(
        and(
          eq(paymentObligations.tenantId, tenantId),
          eq(paymentObligations.accountId, accountId),
          eq(paymentObligations.finalQuoteId, latestQuote.id),
        ),
      )
      .limit(1);
    if (!obligation) {
      throw new ResourceNotFoundError("Payment obligation not found");
    }
    if (obligation.status === "paid") {
      throw new CustomerActionError("This job is already paid.");
    }

    // Reuse an open session rather than stacking Checkout links: the table is
    // unique per (tenant, job), and a customer who clicks twice should land on
    // the same payment page, not a second one Stripe would keep alive.
    const [existing] = await this.db
      .select()
      .from(stripeCheckoutSessions)
      .where(
        and(
          eq(stripeCheckoutSessions.tenantId, tenantId),
          eq(stripeCheckoutSessions.jobRequestId, jobRequestId),
        ),
      )
      .limit(1);

    const reusableUrl =
      existing &&
      existing.paymentStatus === "requires_payment" &&
      existing.amountMinor === latestQuote.amountMinor &&
      existing.currency === latestQuote.currency &&
      (!existing.expiresAt || existing.expiresAt.getTime() > Date.now() + 120_000)
        ? ((existing.metadata as { checkoutUrl?: string } | null)?.checkoutUrl ?? null)
        : null;

    if (reusableUrl && existing) {
      return {
        checkoutUrl: reusableUrl,
        sessionId: existing.stripeSessionId,
        amountMinor: existing.amountMinor,
        currency: existing.currency,
        expiresAt: existing.expiresAt ? existing.expiresAt.toISOString() : null,
      };
    }

    const [person] = await this.db
      .select({ email: people.email })
      .from(people)
      .where(eq(people.id, job.customerPersonId))
      .limit(1);

    const successUrl = `${this.siteBaseUrl}${
      command.successPath ?? `/portal/jobs/${jobRequestId}`
    }?payment=success&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${this.siteBaseUrl}${
      command.cancelPath ?? `/portal/jobs/${jobRequestId}`
    }?payment=cancelled`;

    const metadata = {
      tenantId,
      accountId,
      storeId,
      jobRequestId,
      jobDisplayId: job.displayId,
      finalQuoteId: latestQuote.id,
      paymentObligationId: obligation.id,
    } satisfies Record<string, string>;

    const session = await this.stripe.createCheckoutSession({
      amountMinor: latestQuote.amountMinor,
      currency: latestQuote.currency,
      productName: `Great West Graphics — ${job.displayId}`,
      productDescription: latestQuote.note ?? undefined,
      customerEmail: person?.email ?? null,
      successUrl,
      cancelUrl,
      clientReferenceId: jobRequestId,
      metadata,
      // Same quote, same amount, same session — a double click cannot open two.
      idempotencyKey: `checkout:${jobRequestId}:${latestQuote.id}:${latestQuote.amountMinor}`,
    });

    if (!session.url) {
      throw new PaymentReconciliationError(
        "Stripe did not return a payment page for this job.",
      );
    }

    const expiresAt = session.expiresAt ? new Date(session.expiresAt * 1000) : null;
    const [row] = await this.db
      .insert(stripeCheckoutSessions)
      .values({
        tenantId,
        jobRequestId,
        stripeSessionId: session.id,
        stripeCustomerId: session.customerId,
        amountMinor: latestQuote.amountMinor,
        currency: latestQuote.currency,
        paymentStatus: "requires_payment",
        successUrl,
        cancelUrl,
        expiresAt,
        metadata: { ...metadata, checkoutUrl: session.url },
      })
      .onConflictDoUpdate({
        target: [stripeCheckoutSessions.tenantId, stripeCheckoutSessions.jobRequestId],
        set: {
          stripeSessionId: session.id,
          stripeCustomerId: session.customerId,
          amountMinor: latestQuote.amountMinor,
          currency: latestQuote.currency,
          paymentStatus: "requires_payment",
          successUrl,
          cancelUrl,
          expiresAt,
          completedAt: null,
          metadata: { ...metadata, checkoutUrl: session.url },
          updatedAt: new Date(),
        },
      })
      .returning();

    if (!row) {
      throw new PaymentReconciliationError(
        "Failed to create the Stripe checkout session record.",
      );
    }

    await this.db
      .update(jobRequests)
      .set({ stripeCheckoutSessionId: row.id, updatedAt: new Date() })
      .where(eq(jobRequests.id, jobRequestId));

    return {
      checkoutUrl: session.url,
      sessionId: session.id,
      amountMinor: latestQuote.amountMinor,
      currency: latestQuote.currency,
      expiresAt: expiresAt ? expiresAt.toISOString() : null,
    };
  }

  /**
   * Applies a verified Stripe event.
   *
   * The web tier verifies the signature and forwards the few fields that
   * matter; everything consequential is re-derived from our own row, so a
   * forged relay cannot name its own amount. Re-delivery is normal for Stripe,
   * so every branch is safe to run twice.
   */
  async applyWebhookEvent(relay: StripeWebhookRelay): Promise<WebhookOutcome> {
    const [session] = await this.db
      .select()
      .from(stripeCheckoutSessions)
      .where(eq(stripeCheckoutSessions.stripeSessionId, relay.sessionId))
      .limit(1);
    if (!session) {
      // A session we never created (another environment sharing the Stripe
      // account, most likely). Acknowledge so Stripe stops retrying.
      return { handled: false, status: "ignored" };
    }

    if (relay.paymentIntentId) {
      const [priorIntent] = await this.db
        .select()
        .from(paymentIntents)
        .where(eq(paymentIntents.stripePaymentIntentId, relay.paymentIntentId))
        .limit(1);
      if (priorIntent?.lastWebhookEventId === relay.eventId) {
        return { handled: true, status: "duplicate" };
      }
      await this.db
        .insert(paymentIntents)
        .values({
          tenantId: session.tenantId,
          stripePaymentIntentId: relay.paymentIntentId,
          stripeCheckoutSessionId: session.id,
          status: relay.paymentStatus,
          amountMinor: relay.amountTotalMinor ?? session.amountMinor,
          amountReceivedMinor:
            relay.paymentStatus === "paid" ? (relay.amountTotalMinor ?? session.amountMinor) : 0,
          failureReason: relay.failureReason,
          lastWebhookEventId: relay.eventId,
          metadata: { eventType: relay.eventType },
        })
        .onConflictDoUpdate({
          target: paymentIntents.stripePaymentIntentId,
          set: {
            status: relay.paymentStatus,
            amountReceivedMinor:
              relay.paymentStatus === "paid"
                ? (relay.amountTotalMinor ?? session.amountMinor)
                : 0,
            failureReason: relay.failureReason,
            lastWebhookEventId: relay.eventId,
            updatedAt: new Date(),
          },
        });
    }

    const context = {
      tenantId: session.tenantId,
      accountId: relay.context.accountId,
      storeId: relay.context.storeId,
    };

    switch (relay.eventType) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded": {
        if (relay.paymentStatus !== "paid") {
          // Async method (bank debit) still clearing. Reflect it, wait for the
          // succeeded event before releasing the job to production.
          await this.markSession(session.id, "processing", null);
          await this.moveToPaymentPending(session.jobRequestId, context, relay);
          return { handled: true, status: "processing" };
        }
        if (
          relay.amountTotalMinor !== null &&
          relay.amountTotalMinor !== session.amountMinor
        ) {
          // Underpayment or a quote that changed mid-checkout. Staff settle
          // this by hand rather than the job silently going to production.
          throw new PaymentReconciliationError(
            `Stripe reported ${relay.amountTotalMinor} for a ${session.amountMinor} obligation`,
          );
        }
        if (session.paymentStatus === "succeeded" && session.completedAt) {
          return { handled: true, status: "duplicate" };
        }
        await this.markSession(session.id, "succeeded", new Date());
        await this.jobRequests.recordPayment(
          session.jobRequestId,
          {
            context,
            note: `Card payment received via Stripe (${relay.paymentIntentId ?? relay.sessionId}).`,
            source: {
              system: "stripe",
              externalId: relay.paymentIntentId ?? relay.sessionId,
              correlationId: relay.eventId,
            },
          },
          { type: "system", displayName: "Stripe" },
        );
        return { handled: true, status: "paid" };
      }

      case "checkout.session.async_payment_failed":
      case "payment_intent.payment_failed": {
        await this.markSession(session.id, "failed", null);
        // The job is deliberately left where it is: the customer can retry the
        // card or fall back to requesting a manual invoice.
        return { handled: true, status: "failed" };
      }

      case "checkout.session.expired": {
        if (session.paymentStatus === "succeeded") {
          return { handled: true, status: "duplicate" };
        }
        await this.markSession(session.id, "cancelled", null);
        return { handled: true, status: "expired" };
      }

      default:
        return { handled: false, status: "ignored" };
    }
  }

  private async markSession(
    id: string,
    paymentStatus: "requires_payment" | "processing" | "succeeded" | "failed" | "cancelled",
    completedAt: Date | null,
  ): Promise<void> {
    await this.db
      .update(stripeCheckoutSessions)
      .set({
        paymentStatus,
        ...(completedAt ? { completedAt } : {}),
        updatedAt: new Date(),
      })
      .where(eq(stripeCheckoutSessions.id, id));
  }

  private async moveToPaymentPending(
    jobRequestId: string,
    context: { tenantId: string; accountId: string; storeId: string },
    relay: StripeWebhookRelay,
  ): Promise<void> {
    const [job] = await this.db
      .select({ status: jobRequests.status })
      .from(jobRequests)
      .where(eq(jobRequests.id, jobRequestId))
      .limit(1);
    if (!job || job.status !== "awaiting_payment") return;
    await this.jobRequests.transition(
      jobRequestId,
      {
        context,
        toStatus: "payment_pending",
        reason: "Card payment started in Stripe Checkout",
        source: {
          system: "stripe",
          externalId: relay.sessionId,
          correlationId: relay.eventId,
        },
      },
      { type: "system", displayName: "Stripe" },
    );
  }
}
