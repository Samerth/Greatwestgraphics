import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CommerceApiError } from "@/lib/commerce/client";
import { loadPortalJob } from "@/lib/commerce/portal-client";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { money, getAuthoritativeLineTotalMinor } from "@/lib/utils/quote-pricing";
import { getCustomerSession } from "@/lib/auth/session";
import { RosterTable, type RosterEntry } from "@/components/shared/RosterTable";
import { ProofReview } from "@/components/portal/ProofReview";
import { FinalQuoteReview } from "@/components/portal/FinalQuoteReview";
import { ChangesReply } from "@/components/portal/ChangesReply";
import { InvoiceRequest } from "@/components/portal/InvoiceRequest";
import { PayNowButton } from "@/components/portal/PayNowButton";
import { OrderHandoff } from "@/components/portal/OrderHandoff";
import { PortalSubmittedItems } from "@/components/portal/PortalSubmittedItems";
import {
  PortalNextAction,
  PortalOrderHeader,
  PortalTimeline,
} from "@/components/portal/PortalProgress";
import { portalNextAction } from "@/lib/commerce/portal-progress";
import { PaymentConfirmationPoller } from "@/components/portal/PaymentConfirmationPoller";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  // Stripe sends the customer back here with this flag, but it only ever
  // decides whether to show PaymentConfirmationPoller — the job's real
  // status still comes from the webhook and a fresh read of the database on
  // every poll, never from this query string itself.
  const paymentReturn = (await searchParams)?.payment;
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/account?next=/portal/jobs/${id}`);
  }

  let job;
  let error: string | undefined;
  try {
    const loaded = await loadPortalJob(id);
    job = loaded?.job;
  } catch (caught) {
    // A job that is missing, or that belongs to somebody else, is a 404 — not
    // a 200 page saying so. Returning 200 told crawlers and uptime checks that
    // a forbidden URL was fine. Anything else is our fault, so it keeps the
    // retry affordance instead of pretending the job does not exist.
    if (
      caught instanceof CommerceApiError &&
      (caught.status === 403 || caught.status === 404)
    ) {
      notFound();
    }
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : "The customer portal is not configured for this environment.";
  }

  if (!job && !error) {
    notFound();
  }

  if (!job) {
    return (
      <section className="py-sp-8">
        <Container>
          <h1 className="font-display font-bold text-header">Job unavailable</h1>
          <p role="alert" className="text-text-secondary">{error}</p>
          <div className="flex gap-sp-2">
            <ButtonLink href={`/portal/jobs/${id}`}>Retry</ButtonLink>
            <ButtonLink href="/portal/jobs" variant="secondary">All jobs</ButtonLink>
          </div>
        </Container>
      </section>
    );
  }

  const presentation = jobStatusPresentation[job.status];
  const latestQuote = [...job.finalQuotes].sort(
    (a, b) => b.version - a.version,
  )[0];
  const quoteAccepted = Boolean(latestQuote?.acceptedAt);
  // The response carries no payment column, so "already paid" is read off the
  // statuses that can only be reached after money arrived.
  const alreadyPaid = (
    [
      "paid",
      "ready_for_production",
      "in_production",
      "ready_for_pickup",
      "shipped",
      "completed",
    ] as const
  ).includes(job.status as never);

  // Point 2: derived from what is actually outstanding, not from the status
  // label — a job can read "Submitted" and still have a proof in front of the
  // customer.
  const awaitingProofDecision = job.proofs.some(
    (proof) =>
      (!proof.decision || proof.decision === "pending") &&
      proof.awaitingDecisionFrom !== "staff",
  );
  const nextAction = portalNextAction({
    status: job.status,
    awaitingProofDecision,
    hasUnacceptedQuote: Boolean(latestQuote),
    quoteAccepted,
    alreadyPaid,
    invoiceRequested: Boolean(job.invoiceRequestedAt),
  });
  const placedAt =
    [...job.timeline].sort(
      (a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt),
    )[0]?.occurredAt ?? null;

  return (
    <section className="py-sp-8">
      <Container>
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          Customer portal
        </p>
        <ButtonLink href="/portal/jobs" variant="secondary" size="sm">
          ← All jobs
        </ButtonLink>

        <div className="mt-sp-4 mb-sp-5 space-y-sp-3">
          <PortalOrderHeader
            displayId={job.displayId}
            placedAt={placedAt}
            statusLabel={presentation.label}
            status={job.status}
          />
          <PortalNextAction action={nextAction} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-sp-5 items-start">
          <div className="space-y-sp-5">
            {/* The proof leads. It is the reason the customer opened this
                page, and burying it under the order summary was point 4 of
                the client's list. */}
            <section className="border border-border rounded-md p-sp-4">
              <h2 className="font-display font-bold text-lg mb-sp-3">
                Your proof
              </h2>
              <ProofReview jobId={job.id} proofs={job.proofs} />
            </section>

            {job.status === "changes_requested" ? (
              <section className="border border-accent rounded-md p-sp-4 bg-accent-tint">
                <h2 className="font-display font-bold text-lg mb-sp-3">
                  Reply to requested changes
                </h2>
                <ChangesReply jobId={job.id} />
              </section>
            ) : null}

            <section className="border border-border rounded-md p-sp-4">
              <h2 className="font-display font-bold text-lg mb-sp-3">
                Submitted items
              </h2>
              <PortalSubmittedItems
                lines={job.lines}
                customerNote={job.customerNote}
              />
              <p className="text-xs text-text-tertiary mt-sp-3 mb-0">
                These are immutable submission snapshots. Final pricing follows
                design and availability review.
              </p>
            </section>

            <section className="border border-border rounded-md p-sp-4">
              <h2 className="font-display font-bold text-lg mb-sp-3">
                Final quote
              </h2>
              <FinalQuoteReview
                jobId={job.id}
                status={job.status}
                quotes={job.finalQuotes}
              />
            </section>

            <section className="border border-border rounded-md p-sp-4">
              <h2 className="font-display font-bold text-lg mb-sp-3">
                Order timeline
              </h2>
              <PortalTimeline status={job.status} history={job.timeline} />
            </section>

            <OrderHandoff contact={job.contact} fulfillment={job.fulfillment} />
          </div>

          <aside className="border border-border rounded-md p-sp-4">
            <h2 className="font-display font-bold text-lg mb-sp-2">Next action</h2>
            <p className="text-text-secondary">{presentation.nextAction}</p>
            {!alreadyPaid && (
              <div className="bg-fill-subtle-15 border border-border rounded-md p-sp-3 text-sm mb-sp-3">
                {job.invoiceRequestedAt
                  ? "Invoice requested. We will send payment instructions to the email on this job."
                  : quoteAccepted
                    ? "Your final quote is accepted. Request an invoice and we will send e-transfer, cheque, or phone-card instructions."
                    : latestQuote
                      ? "Review and accept the latest final quote before requesting an invoice."
                      : "Payment stays locked until design approval and final pricing are complete."}
              </div>
            )}
            {paymentReturn === "success" ? (
              <PaymentConfirmationPoller active={!alreadyPaid} />
            ) : null}
            {paymentReturn === "cancelled" ? (
              <p className="text-sm border border-border rounded-md p-sp-3">
                Payment cancelled. Nothing was charged — you can pay by card
                again or request an invoice.
              </p>
            ) : null}
            {quoteAccepted && !alreadyPaid ? (
              <>
                <PayNowButton
                  jobId={job.id}
                  amountLabel={
                    latestQuote ? money(latestQuote.amountMinor / 100) : undefined
                  }
                />
                <p className="text-xs text-text-secondary text-center mb-sp-2">
                  or
                </p>
                <InvoiceRequest
                  jobId={job.id}
                  alreadyRequested={Boolean(job.invoiceRequestedAt)}
                />
              </>
            ) : null}
          </aside>
        </div>
      </Container>
    </section>
  );
}
