"use client";

import { useActionState } from "react";
import { Button } from "@/components/shared/Button";
import {
  acceptFinalQuoteAction,
  type QuoteAcceptanceState,
} from "@/app/portal/jobs/actions";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

interface QuoteForReview {
  id: string;
  version: number;
  amountMinor: number;
  currency: string;
  note: string | null;
  acceptedAt: string | null;
  createdAt: string;
}

function LatestQuote({
  jobId,
  quote,
  canAccept,
}: {
  jobId: string;
  quote: QuoteForReview;
  canAccept: boolean;
}) {
  const [state, formAction, pending] = useActionState<
    QuoteAcceptanceState,
    FormData
  >(acceptFinalQuoteAction.bind(null, jobId, quote.id), {});

  return (
    <div className="border border-border rounded-md p-sp-3 bg-bg-raised">
      <div className="flex flex-wrap items-start justify-between gap-sp-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary mt-0 mb-1">
            Final quote · version {quote.version}
          </p>
          <p className="font-display font-bold text-2xl m-0">
            {moneyFromMinor(quote.amountMinor)} {quote.currency}
          </p>
        </div>
        <span className="bg-accent-tint text-accent px-3 py-1 rounded-full text-sm font-bold">
          {quote.acceptedAt ? "Accepted" : "Your response needed"}
        </span>
      </div>

      {quote.note && (
        <p className="text-sm text-text-secondary whitespace-pre-wrap mb-0">
          {quote.note}
        </p>
      )}

      {quote.acceptedAt ? (
        <p className="text-sm text-text-secondary mb-0">
          Accepted {new Date(quote.acceptedAt).toLocaleString("en-CA")}. You can
          now request the invoice from the next-action panel.
        </p>
      ) : canAccept ? (
        <form action={formAction} className="mt-sp-3">
          <p className="text-sm text-text-secondary">
            By accepting, you confirm this final amount and authorize us to
            prepare the invoice. Production still starts only after payment and
            the approved proof requirements are complete.
          </p>
          {state.error && (
            <p role="alert" className="text-sm text-error">
              {state.error}
            </p>
          )}
          <Button type="submit" disabled={pending}>
            {pending ? "Accepting…" : "Accept final quote"}
          </Button>
        </form>
      ) : (
        <p className="text-sm text-text-secondary mb-0">
          The quote becomes available to accept after the design is approved.
        </p>
      )}
    </div>
  );
}

export function FinalQuoteReview({
  jobId,
  status,
  quotes,
}: {
  jobId: string;
  status: string;
  quotes: QuoteForReview[];
}) {
  if (quotes.length === 0) {
    return (
      <p className="text-sm text-text-secondary m-0">
        No final quote yet. We will post it here after reviewing design,
        quantity and availability.
      </p>
    );
  }

  const sorted = [...quotes].sort((a, b) => b.version - a.version);
  const [latest, ...superseded] = sorted;
  if (!latest) return null;
  const canAccept = status === "approved" || status === "awaiting_payment";

  return (
    <div className="space-y-sp-3">
      <LatestQuote jobId={jobId} quote={latest} canAccept={canAccept} />
      {superseded.length > 0 && (
        <details>
          <summary className="text-sm cursor-pointer text-text-secondary">
            Earlier quote versions ({superseded.length})
          </summary>
          <ul className="mt-sp-2 mb-0 text-sm text-text-secondary">
            {superseded.map((quote) => (
              <li key={quote.id}>
                v{quote.version}: {moneyFromMinor(quote.amountMinor)}{" "}
                {quote.currency} · superseded
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
