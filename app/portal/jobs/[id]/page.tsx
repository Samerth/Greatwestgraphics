import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CommerceApiError } from "@/lib/commerce/client";
import { loadPortalJob } from "@/lib/commerce/portal-client";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { money } from "@/lib/utils/quote-pricing";
import { getCustomerSession } from "@/lib/auth/session";
import { RosterTable, type RosterEntry } from "@/components/shared/RosterTable";
import { ProofReview } from "@/components/portal/ProofReview";
import { FinalQuoteReview } from "@/components/portal/FinalQuoteReview";
import { ChangesReply } from "@/components/portal/ChangesReply";
import { InvoiceRequest } from "@/components/portal/InvoiceRequest";
import { PayNowButton } from "@/components/portal/PayNowButton";
import { OrderHandoff } from "@/components/portal/OrderHandoff";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ payment?: string }>;
}) {
  const { id } = await params;
  // Stripe sends the customer back here. The banner is cosmetic only — the
  // job's real status comes from the webhook, never from this query string.
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

  return (
    <section className="py-sp-8">
      <Container>
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          Customer portal
        </p>
        <ButtonLink href="/portal/jobs" variant="secondary" size="sm">
          ← All jobs
        </ButtonLink>
        <div className="flex flex-wrap items-start justify-between gap-sp-3 mt-sp-4 mb-sp-5">
          <div>
            <h1 className="font-display font-bold text-display-sm mb-1">
              {job.displayId}
            </h1>
            <p className="text-sm text-text-secondary m-0">Job status</p>
          </div>
          <span className="bg-accent-tint text-accent px-3 py-1 rounded-full text-sm font-bold">
            {presentation.label}
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-sp-5 items-start">
          <div className="space-y-sp-5">
            <OrderHandoff contact={job.contact} fulfillment={job.fulfillment} />

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
              <div className="space-y-sp-3">
                {job.lines.map((line) => {
                  const roster = line.snapshot.configuration.roster as
                    | RosterEntry[]
                    | undefined;
                  const artworkProofUrl = line.snapshot.configuration
                    .artworkProofUrl as string | undefined;
                  const designProjectId = line.snapshot.configuration
                    .designProjectId as string | undefined;
                  return (
                    <article key={line.id} className="border-b border-fill-subtle pb-sp-3 last:border-0 last:pb-0">
                      <div className="flex justify-between gap-sp-3">
                        <div>
                          <b>{line.snapshot.description}</b>
                          <p className="text-sm text-text-secondary mt-1 mb-0">
                            Quantity {line.snapshot.quantity}
                            {typeof line.snapshot.configuration.color === "string"
                              ? ` · ${line.snapshot.configuration.color}`
                              : ""}
                          </p>
                        </div>
                        {line.snapshot.unitPriceEstimateMinor !== undefined && (
                          <span className="text-sm text-right whitespace-nowrap">
                            <span className="block text-text-secondary">
                              {money(line.snapshot.unitPriceEstimateMinor / 100)} each
                            </span>
                            <b className="block">
                              {money(
                                (line.snapshot.unitPriceEstimateMinor * line.snapshot.quantity) /
                                  100,
                              )}{" "}
                              total
                            </b>
                          </span>
                        )}
                      </div>
                      {(artworkProofUrl || designProjectId) && (
                        <div className="mt-sp-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
                            Artwork you sent
                          </p>
                          {artworkProofUrl && (
                            <a href={artworkProofUrl} target="_blank" rel="noreferrer">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={artworkProofUrl}
                                alt={`Artwork for ${line.snapshot.description}`}
                                className="h-28 w-auto border border-border rounded-sm bg-white"
                              />
                            </a>
                          )}
                          {designProjectId && (
                            <div className={artworkProofUrl ? "mt-2" : undefined}>
                              <ButtonLink
                                href={`/design?loadDesignId=${encodeURIComponent(designProjectId)}`}
                                variant="secondary"
                                size="sm"
                              >
                                Reopen in the studio
                              </ButtonLink>
                            </div>
                          )}
                        </div>
                      )}
                      {roster && roster.length > 0 && (
                        <div className="mt-sp-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
                            Team roster submitted
                          </p>
                          <RosterTable roster={roster} />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {job.customerNote && (
                <div className="mt-sp-3 border-t border-fill-subtle pt-sp-3">
                  <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
                    Your note to us
                  </p>
                  <p className="text-sm text-text-secondary m-0 whitespace-pre-wrap">
                    {job.customerNote}
                  </p>
                </div>
              )}
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
                Proofs &amp; approvals
              </h2>
              <ProofReview jobId={job.id} proofs={job.proofs} />
            </section>

            <section className="border border-border rounded-md p-sp-4">
              <h2 className="font-display font-bold text-lg mb-sp-3">Timeline</h2>
              <ol className="space-y-sp-3">
                {job.timeline.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-accent pl-sp-3">
                    <b>{jobStatusPresentation[entry.toStatus].label}</b>
                    <p className="text-sm text-text-tertiary mt-1 mb-0">
                      {new Date(entry.occurredAt).toLocaleString("en-CA")}
                      {entry.reason ? ` · ${entry.reason}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </section>
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
            {paymentReturn === "success" && !alreadyPaid ? (
              <p className="text-sm border border-border rounded-md p-sp-3 bg-fill-subtle-15">
                Thanks — your card payment is confirming. This page updates as
                soon as the bank settles it, usually within a minute.
              </p>
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
