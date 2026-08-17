import { notFound, redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { money } from "@/lib/utils/quote-pricing";
import { getCustomerSession } from "@/lib/auth/session";
import { RosterTable, type RosterEntry } from "@/components/shared/RosterTable";
import { ProofReview } from "@/components/portal/ProofReview";

export const dynamic = "force-dynamic";

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await getCustomerSession();
  if (!session) {
    redirect(`/account?next=/portal/jobs/${id}`);
  }

  let job;
  let error: string | undefined;
  try {
    job = await (await createCommerceClient()).getJobRequest(id);
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
                          <span className="text-sm whitespace-nowrap">
                            Est. {money(line.snapshot.unitPriceEstimateMinor / 100)} each
                          </span>
                        )}
                      </div>
                      {artworkProofUrl && (
                        <div className="mt-sp-3">
                          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mb-1.5">
                            Artwork you sent
                          </p>
                          <a href={artworkProofUrl} target="_blank" rel="noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={artworkProofUrl}
                              alt={`Artwork for ${line.snapshot.description}`}
                              className="h-28 w-auto border border-border rounded-sm bg-white"
                            />
                          </a>
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
            <div className="bg-fill-subtle-15 border border-border rounded-md p-sp-3 text-sm mb-sp-3">
              {presentation.paymentReady
                ? "This job is approved and ready to invoice. Online card payment is not connected yet, so we will send an invoice you can pay by e-transfer, cheque or card over the phone."
                : "Payment stays locked until design approval and final pricing are complete."}
            </div>
            {/* This was a permanently disabled "Pay approved amount (coming
                soon)" button. Honest about Stripe, but it left a customer with
                an approved job and nothing to click. Until online payment is
                connected, point at the humans who can actually take it. */}
            {presentation.paymentReady ? (
              <ButtonLink
                href="/contact"
                variant="primary"
                className="w-full text-center"
              >
                Request an invoice
              </ButtonLink>
            ) : null}
          </aside>
        </div>
      </Container>
    </section>
  );
}
