import { redirect } from "next/navigation";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import {
  CommerceApiError,
  createCommerceClient,
} from "@/lib/commerce/client";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { getCustomerSession } from "@/lib/auth/session";
import type { JobRequestListResponse } from "@gwg/contracts";

export const dynamic = "force-dynamic";

export default async function JobsPage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/account?next=/portal/jobs");
  }

  let jobs: JobRequestListResponse | undefined;
  let error: string | undefined;
  try {
    jobs = await (await createCommerceClient()).listJobRequests();
  } catch (caught) {
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : "The customer portal is not configured for this environment.";
  }

  // An account owner is served their whole team's orders; everyone else only
  // ever sees their own. Rather than ask the API a second question, read it
  // from the answer: someone else's order in the list means this is the team
  // view, and the page should stop calling the list "yours".
  const showingTeam = Boolean(
    jobs?.some((job) => job.customerPersonId !== session.personId),
  );

  return (
    <section className="py-sp-8">
      <Container>
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          Customer portal
        </p>
        <h1 className="font-display font-bold text-display-sm mb-sp-2">
          {showingTeam ? "Your Team's Jobs" : "Your Jobs"}
        </h1>
        <p className="text-text-secondary mb-sp-5 max-w-[60ch]">
          Signed in as {session.name || session.email}.
          {showingTeam &&
            " As the account owner you can see every job placed in your store."}
        </p>

        {error && (
          <div role="alert" className="border border-red-300 bg-red-50 text-red-800 rounded-md p-sp-4">
            <p className="m-0">{error}</p>
            <ButtonLink href="/portal/jobs" variant="secondary" size="sm" className="mt-sp-3">
              Retry
            </ButtonLink>
          </div>
        )}

        {!error && jobs?.length === 0 && (
          <div className="border border-border rounded-md p-sp-4 text-text-secondary flex flex-wrap items-center justify-between gap-3">
            <span>
              You haven&apos;t submitted any jobs yet. Once you do, proofs and
              status updates appear here.
            </span>
            <ButtonLink href="/quote" size="sm">
              Request a quote
            </ButtonLink>
          </div>
        )}

        <div className="space-y-sp-3">
          {jobs?.map((job) => {
            const presentation = jobStatusPresentation[job.status];
            return (
              <article key={job.id} className="border border-border rounded-md p-sp-4">
                <div className="flex flex-wrap items-start justify-between gap-sp-3">
                  <div>
                    <p className="font-display font-bold text-lg m-0">
                      {job.displayId}
                    </p>
                    <p className="text-sm text-text-tertiary mt-1 mb-0">
                      {showingTeam &&
                        `${
                          job.customerPersonId === session.personId
                            ? "You"
                            : job.customerName || "A teammate"
                        } · `}
                      Submitted{" "}
                      {job.submittedAt
                        ? new Date(job.submittedAt).toLocaleString("en-CA")
                        : "not yet"}
                    </p>
                  </div>
                  <span className="bg-accent-tint text-accent px-3 py-1 rounded-full text-sm font-bold">
                    {presentation.label}
                  </span>
                </div>
                <p className="text-text-secondary mt-sp-3 mb-sp-3">
                  {presentation.nextAction}
                </p>
                <ButtonLink href={`/portal/jobs/${job.id}`} size="sm">
                  View details
                </ButtonLink>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
