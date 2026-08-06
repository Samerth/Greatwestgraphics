import Link from "next/link";
import {
  createFinalQuoteAction,
  createProofAction,
  transitionJobAction,
} from "@/app/admin/actions";
import { adminClient } from "@/lib/admin/api";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { validNextStatuses } from "@gwg/contracts";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export const dynamic = "force-dynamic";

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let error: string | undefined;
  let detail: Awaited<
    ReturnType<ReturnType<typeof adminClient>["getJobRequest"]>
  > | null = null;

  try {
    detail = await adminClient().getJobRequest(id);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Job unavailable";
  }

  if (error || !detail) {
    return (
      <div className="space-y-sp-3">
        <Link href="/admin/jobs" className="text-sm font-bold text-accent">
          ← Jobs
        </Link>
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3">
          {error || "Not found"}
        </p>
      </div>
    );
  }

  const presentation = jobStatusPresentation[detail.status];
  const nextStatuses = validNextStatuses(detail.status);

  return (
    <div className="space-y-sp-4 max-w-4xl">
      <Link href="/admin/jobs" className="text-sm font-bold text-accent">
        ← Jobs
      </Link>
      <div className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-3xl m-0">Job detail</h1>
          <p className="font-mono text-sm text-text-tertiary mt-1 mb-0">
            {detail.id}
          </p>
        </div>
        <span className="text-sm font-bold bg-accent-tint text-accent px-3 py-1 rounded-full h-fit">
          {presentation.label}
        </span>
      </div>

      {nextStatuses.length > 0 ? (
        <form
          action={async (formData) => {
            "use server";
            await transitionJobAction(
              detail!.id,
              String(formData.get("toStatus") || ""),
              String(formData.get("reason") || "") || undefined,
            );
          }}
          className="flex flex-wrap gap-2 items-end border border-border rounded-md p-sp-3 bg-bg-raised"
        >
          <label className="text-sm font-semibold">
            Transition
            <select
              name="toStatus"
              className="block mt-1 border border-border rounded-sm px-2 py-1"
              required
              defaultValue=""
            >
              <option value="" disabled>
                Select status
              </option>
              {nextStatuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Reason
            <input
              name="reason"
              className="block mt-1 border border-border rounded-sm px-2 py-1"
            />
          </label>
          <button
            type="submit"
            className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
          >
            Apply
          </button>
        </form>
      ) : (
        <p className="border border-border rounded-md p-sp-3 text-sm text-text-secondary m-0">
          This job is in a terminal status. No further staff transitions are available.
        </p>
      )}

      <section className="space-y-sp-3">
        <h2 className="font-display font-bold text-xl m-0">Lines</h2>
        {detail.lines.map((line) => {
          const configuration = line.snapshot.configuration as {
            pricing?: { breakdown?: { totalMinor?: number } };
            designProofs?: { front?: string; back?: string };
            color?: string;
            size?: string;
          };
          const pricing = configuration?.pricing;
          const designProofs = configuration?.designProofs;
          return (
            <article
              key={line.id}
              className="border border-border rounded-md p-sp-3"
            >
              <p className="font-semibold m-0">{line.snapshot.description}</p>
              <p className="text-sm text-text-secondary mt-1 mb-0">
                Qty {line.snapshot.quantity}
                {configuration?.color ? ` · ${configuration.color}` : ""}
                {configuration?.size ? ` · ${configuration.size}` : ""}
                {line.snapshot.unitPriceEstimateMinor != null
                  ? ` · est. ${moneyFromMinor(line.snapshot.unitPriceEstimateMinor)} / unit`
                  : ""}
                {pricing?.breakdown?.totalMinor != null
                  ? ` · snapshot total ${moneyFromMinor(pricing.breakdown.totalMinor)}`
                  : ""}
              </p>
              {(line.snapshot.productId || line.snapshot.variantId) && (
                <p className="text-xs text-text-tertiary mt-1 mb-0">
                  Catalog: {line.snapshot.productId || "—"} /{" "}
                  {line.snapshot.variantId || "—"}
                </p>
              )}
              {(designProofs?.front || designProofs?.back) && (
                <div className="flex flex-wrap gap-3 mt-3">
                  {designProofs.front && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={designProofs.front}
                      alt="Front artwork proof"
                      className="h-24 w-auto border border-border rounded-sm bg-white"
                    />
                  )}
                  {designProofs.back && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={designProofs.back}
                      alt="Back artwork proof"
                      className="h-24 w-auto border border-border rounded-sm bg-white"
                    />
                  )}
                </div>
              )}
            </article>
          );
        })}
      </section>

      <section className="grid gap-sp-3 md:grid-cols-2">
        <div className="border border-border rounded-md p-sp-3 bg-bg-raised space-y-3">
          <h2 className="font-display font-bold text-xl m-0">Final quote</h2>
          {(detail.finalQuotes ?? []).length > 0 ? (
            <ul className="m-0 p-0 list-none space-y-1 text-sm">
              {(detail.finalQuotes ?? []).map((quote) => (
                <li key={quote.id}>
                  v{quote.version}: {moneyFromMinor(quote.amountMinor)}{" "}
                  {quote.currency}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary m-0">No final quote yet.</p>
          )}
          <form action={createFinalQuoteAction} className="space-y-2">
            <input type="hidden" name="jobId" value={detail.id} />
            <label className="block text-sm font-semibold">
              Amount (CAD)
              <input
                name="amountDollars"
                type="number"
                min="0.01"
                step="0.01"
                required
                className="block mt-1 w-full border border-border rounded-sm px-2 py-1"
              />
            </label>
            <label className="block text-sm font-semibold">
              Note
              <input
                name="note"
                className="block mt-1 w-full border border-border rounded-sm px-2 py-1"
              />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" name="markAwaitingPayment" value="1" />
              Mark awaiting payment
            </label>
            <button
              type="submit"
              className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
            >
              Issue final quote
            </button>
          </form>
        </div>

        <div className="border border-border rounded-md p-sp-3 bg-bg-raised space-y-3">
          <h2 className="font-display font-bold text-xl m-0">Staff proofs</h2>
          {(detail.proofs ?? []).length > 0 ? (
            <ul className="m-0 p-0 list-none space-y-1 text-sm">
              {(detail.proofs ?? []).map((proof) => (
                <li key={proof.id} className="break-all">
                  v{proof.version}: {proof.storageKey}
                  {proof.decision ? ` · ${proof.decision}` : ""}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-secondary m-0">No proofs yet.</p>
          )}
          <form action={createProofAction} className="space-y-2">
            <input type="hidden" name="jobId" value={detail.id} />
            <label className="block text-sm font-semibold">
              Storage key / URL
              <input
                name="storageKey"
                required
                placeholder="local://proofs/job-v1.png or https://…"
                className="block mt-1 w-full border border-border rounded-sm px-2 py-1"
              />
            </label>
            <label className="block text-sm font-semibold">
              Note
              <input
                name="note"
                className="block mt-1 w-full border border-border rounded-sm px-2 py-1"
              />
            </label>
            <button
              type="submit"
              className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
            >
              Attach proof
            </button>
          </form>
        </div>
      </section>

      <section>
        <h2 className="font-display font-bold text-xl m-0 mb-2">Timeline</h2>
        <ul className="space-y-2 m-0 p-0 list-none">
          {detail.timeline.map((entry) => (
            <li
              key={entry.id}
              className="text-sm border-l-2 border-border pl-3"
            >
              <span className="font-semibold">{entry.toStatus}</span>
              {entry.reason ? ` — ${entry.reason}` : ""}
              <span className="text-text-tertiary">
                {" "}
                · {new Date(entry.occurredAt).toLocaleString("en-CA")}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
