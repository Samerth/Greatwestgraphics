import { redirect } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/shared/Container";
import { ButtonLink } from "@/components/shared/Button";
import { CommerceApiError } from "@/lib/commerce/client";
import { resolvePortalScope } from "@/lib/commerce/portal-client";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { getCustomerSession } from "@/lib/auth/session";
import type { JobRequestListResponse } from "@gwg/contracts";
import { SHOW_PUBLIC_QUOTE_CALCULATOR } from "@/lib/features";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Customer portal",
  robots: { index: false, follow: false },
};

/** Statuses where the job is parked on the customer, not on our studio. */
const NEEDS_CUSTOMER = new Set([
  "draft",
  "changes_requested",
  "approved",
  "awaiting_payment",
  "payment_failed",
]);

export default async function PortalHomePage() {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/account?next=/portal");
  }

  let jobs: JobRequestListResponse = [];
  let error: string | undefined;
  try {
    jobs = await (await resolvePortalScope()).client.listJobRequests();
  } catch (caught) {
    error =
      caught instanceof CommerceApiError
        ? caught.message
        : "We couldn't load your jobs just now.";
  }

  const waitingOnYou = jobs.filter((job) => NEEDS_CUSTOMER.has(job.status));
  const inProgress = jobs.filter((job) => !NEEDS_CUSTOMER.has(job.status));

  return (
    <section className="py-sp-8">
      <Container>
        <p className="text-xs font-bold uppercase tracking-wider text-accent">
          Customer portal
        </p>
        <h1 className="font-display font-bold text-display-sm mb-sp-2">
          Welcome back{session.name ? `, ${session.name.split(" ")[0]}` : ""}.
        </h1>
        <p className="text-text-secondary mb-sp-6 max-w-[60ch]">
          Track proofs and quotes, reopen saved artwork, and start your next
          run — all from here.
        </p>

        {error ? (
          <div
            role="alert"
            className="border border-red-300 bg-red-50 text-red-800 rounded-md p-sp-4 mb-sp-6"
          >
            <p className="m-0">{error}</p>
            <ButtonLink
              href="/portal"
              variant="secondary"
              size="sm"
              className="mt-sp-3"
            >
              Retry
            </ButtonLink>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-sp-3 mb-sp-6">
            <SummaryCard
              count={waitingOnYou.length}
              label="Waiting on you"
              detail={
                waitingOnYou.length > 0
                  ? "A proof, a quote or a payment needs your decision."
                  : "Nothing needs your sign-off right now."
              }
              emphasised={waitingOnYou.length > 0}
            />
            <SummaryCard
              count={inProgress.length}
              label="With our studio"
              detail={
                inProgress.length > 0
                  ? "We're reviewing, proofing or producing these."
                  : "No jobs in production yet."
              }
            />
          </div>
        )}

        {waitingOnYou.length > 0 && (
          <div className="mb-sp-6">
            <h2 className="font-display font-bold text-lg mb-sp-3">
              Needs your attention
            </h2>
            <div className="space-y-sp-2">
              {waitingOnYou.slice(0, 3).map((job) => (
                <Link
                  key={job.id}
                  href={`/portal/jobs/${job.id}`}
                  className="flex flex-wrap items-center justify-between gap-3 border border-border rounded-md px-sp-4 py-sp-3 hover:border-text-tertiary hover:bg-fill-subtle-15 transition-colors"
                >
                  <span className="font-bold">{job.displayId}</span>
                  <span className="text-sm text-text-secondary">
                    {jobStatusPresentation[job.status].nextAction}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-sp-3">
          <SectionCard
            href="/portal/jobs"
            title="Your jobs"
            body="Every quote and order you've submitted, with its current status, proofs and history."
            cta="View jobs"
          />
          <SectionCard
            href="/portal/designs"
            title="My designs"
            body="Artwork saved from the AI Design Studio. Reopen it to keep editing or apply it to a different garment."
            cta="View designs"
          />
        </div>

        <div className="mt-sp-6 rounded-lg border border-border bg-bg-raised p-sp-5 flex flex-wrap items-center justify-between gap-sp-3">
          <div>
            <h2 className="font-display font-bold text-lg m-0">
              Starting something new?
            </h2>
            <p className="text-sm text-text-secondary mt-1 mb-0 max-w-[52ch]">
              Design it yourself, browse blanks, or send us the details and
              we&apos;ll quote it.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink href="/design" size="sm">
              Open Design Studio
            </ButtonLink>
            <ButtonLink href="/products" variant="secondary" size="sm">
              Browse products
            </ButtonLink>
            {SHOW_PUBLIC_QUOTE_CALCULATOR ? (
              <ButtonLink href="/quote" variant="secondary" size="sm">
                Request a quote
              </ButtonLink>
            ) : null}
          </div>
        </div>
      </Container>
    </section>
  );
}

function SummaryCard({
  count,
  label,
  detail,
  emphasised = false,
}: {
  count: number;
  label: string;
  detail: string;
  emphasised?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-sp-4 ${
        emphasised ? "border-accent bg-accent-tint" : "border-border bg-bg-raised"
      }`}
    >
      <p
        className={`font-display font-bold text-3xl m-0 ${
          emphasised ? "text-accent" : "text-text-primary"
        }`}
      >
        {count}
      </p>
      <p className="font-bold text-sm mt-1 mb-0">{label}</p>
      <p className="text-sm text-text-secondary mt-1 mb-0">{detail}</p>
    </div>
  );
}

function SectionCard({
  href,
  title,
  body,
  cta,
}: {
  href: string;
  title: string;
  body: string;
  cta: string;
}) {
  return (
    <article className="rounded-lg border border-border p-sp-5 flex flex-col">
      <h2 className="font-display font-bold text-xl m-0">{title}</h2>
      <p className="text-sm text-text-secondary mt-sp-2 mb-sp-4 flex-1">
        {body}
      </p>
      <ButtonLink href={href} variant="secondary" size="sm" className="self-start">
        {cta}
      </ButtonLink>
    </article>
  );
}
