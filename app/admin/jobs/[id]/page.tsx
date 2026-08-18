import Link from "next/link";
import {
  createFinalQuoteAction,
  createProofAction,
  decideProofAction,
  transitionJobAction,
} from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { jobStatusPresentation } from "@/lib/commerce/status";
import { validNextStatuses } from "@gwg/contracts";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export const dynamic = "force-dynamic";

function safeProofUrl(storageKey: string): string | null {
  if (storageKey.startsWith("/")) return storageKey;
  try {
    const url = new URL(storageKey);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

export default async function AdminJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let error: string | undefined;
  let detail: Awaited<
    ReturnType<Awaited<ReturnType<typeof adminClient>>["getJobRequest"]>
  > | null = null;

  try {
    detail = await (await adminClient()).getJobRequestAsStaff(
      id,
      requireAdminToken(),
    );
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
          <h1 className="font-display font-bold text-3xl m-0">
            {detail.displayId}
          </h1>
          <p className="text-sm text-text-tertiary mt-1 mb-0">Job detail</p>
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

      <section className="grid gap-sp-3 md:grid-cols-2">
        <div className="border border-border rounded-md p-sp-3 bg-bg-raised">
          <h2 className="font-display font-bold text-xl m-0 mb-2">
            Customer contact
          </h2>
          {detail.contact ? (
            <address className="not-italic text-sm space-y-1">
              <p className="font-semibold m-0">{detail.contact.fullName}</p>
              {detail.contact.company && (
                <p className="text-text-secondary m-0">
                  {detail.contact.company}
                </p>
              )}
              <p className="m-0">
                <a className="text-accent underline" href={`mailto:${detail.contact.email}`}>
                  {detail.contact.email}
                </a>
              </p>
              <p className="m-0">
                <a className="text-accent underline" href={`tel:${detail.contact.phone}`}>
                  {detail.contact.phone}
                </a>
              </p>
            </address>
          ) : (
            <p className="text-sm text-text-secondary m-0">
              Contact details are unavailable for this legacy job.
            </p>
          )}
        </div>

        <div className="border border-border rounded-md p-sp-3 bg-bg-raised">
          <h2 className="font-display font-bold text-xl m-0 mb-2">
            Fulfilment
          </h2>
          {detail.fulfillment ? (
            <div className="text-sm">
              <p className="font-semibold capitalize mt-0 mb-1">
                {detail.fulfillment.method.replace("_", " ")}
              </p>
              <address className="not-italic text-text-secondary">
                {detail.fulfillment.address.address1}
                <br />
                {detail.fulfillment.address.address2 && (
                  <>
                    {detail.fulfillment.address.address2}
                    <br />
                  </>
                )}
                {detail.fulfillment.address.city},{" "}
                {detail.fulfillment.address.region}{" "}
                {detail.fulfillment.address.postalCode}
                <br />
                {detail.fulfillment.address.country}
              </address>
              {detail.fulfillment.deliveryNotes && (
                <p className="border-t border-fill-subtle mt-2 pt-2 mb-0 whitespace-pre-wrap">
                  Delivery note: {detail.fulfillment.deliveryNotes}
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-text-secondary m-0">
              Fulfilment details are unavailable for this legacy job.
            </p>
          )}
        </div>
      </section>

      {/* Checkout tells the customer their notes and payment preference reach
          the studio. The note was stored on the job row and then dropped from
          every read, so nobody working the job here could see it. */}
      {detail.customerNote ? (
        <section className="border border-border rounded-md p-sp-3 bg-bg-raised">
          <h2 className="font-display font-bold text-xl m-0 mb-2">
            Customer note
          </h2>
          <p className="text-sm whitespace-pre-wrap m-0">
            {detail.customerNote}
          </p>
        </section>
      ) : null}

      <section className="space-y-sp-3">
        <h2 className="font-display font-bold text-xl m-0">Lines</h2>
        {detail.lines.map((line) => {
          const configuration = line.snapshot.configuration as {
            pricing?: {
              // v1 keeps the total at the top of the breakdown, v2 nests it
              // under totals.
              breakdown?: {
                totalMinor?: number;
                totals?: { totalMinor?: number };
              };
            };
            artworkProofUrl?: string;
            designProjectId?: string;
            roster?: { size: string; name: string; number?: string }[];
            color?: string;
            size?: string;
            storefrontProductId?: string;
            productMetadata?: string;
          };
          const snapshotTotalMinor =
            configuration?.pricing?.breakdown?.totals?.totalMinor ??
            configuration?.pricing?.breakdown?.totalMinor;
          const artworkProofUrl = configuration?.artworkProofUrl;
          const designProjectId = configuration?.designProjectId;
          const roster = configuration?.roster;
          const catalogHint =
            configuration?.productMetadata ||
            configuration?.storefrontProductId ||
            null;
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
                {snapshotTotalMinor != null
                  ? ` · snapshot total ${moneyFromMinor(snapshotTotalMinor)}`
                  : ""}
              </p>
              {catalogHint && (
                <p className="text-xs text-text-tertiary mt-1 mb-0">
                  {catalogHint}
                </p>
              )}
              {(artworkProofUrl || designProjectId) && (
                <div className="flex flex-wrap items-start gap-3 mt-3">
                  {artworkProofUrl && (
                    <a href={artworkProofUrl} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={artworkProofUrl}
                        alt={`Artwork proof for ${line.snapshot.description}`}
                        className="h-24 w-auto border border-border rounded-sm bg-white"
                      />
                    </a>
                  )}
                  {designProjectId && (
                    <Link
                      href={`/admin/designs/${designProjectId}/edit`}
                      className="text-sm underline"
                    >
                      Open this design in the studio
                    </Link>
                  )}
                </div>
              )}
              {roster && roster.length > 0 && (
                <details className="mt-3">
                  <summary className="text-sm cursor-pointer">
                    Roster · {roster.length} name
                    {roster.length === 1 ? "" : "s"}
                  </summary>
                  <ul className="text-sm text-text-secondary mt-2 mb-0 pl-4">
                    {roster.map((entry, index) => (
                      <li key={`${entry.name}-${index}`}>
                        {entry.size} · {entry.name}
                        {entry.number ? ` · #${entry.number}` : ""}
                      </li>
                    ))}
                  </ul>
                </details>
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
                  {quote.acceptedAt
                    ? ` · accepted ${new Date(quote.acceptedAt).toLocaleString("en-CA")}`
                    : " · awaiting customer acceptance"}
                  {quote.note && (
                    <span className="block text-text-secondary">
                      {quote.note}
                    </span>
                  )}
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
              Approve job and open quote for customer acceptance
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
          <h2 className="font-display font-bold text-xl m-0">Proofs</h2>
          {(detail.proofs ?? []).length > 0 ? (
            <ul className="m-0 p-0 list-none space-y-3 text-sm">
              {[...(detail.proofs ?? [])]
                .sort((a, b) => b.version - a.version)
                .map((proof) => {
                  const undecided =
                    !proof.decision || proof.decision === "pending";
                  const oursToDecide =
                    undecided && proof.awaitingDecisionFrom === "staff";
                  const proofUrl = safeProofUrl(proof.storageKey);
                  const imageLike =
                    Boolean(proofUrl) &&
                    (/\.(avif|gif|jpe?g|png|webp)(?:[?#]|$)/i.test(
                      proofUrl!,
                    ) ||
                      proofUrl!.includes("/api/uploads/"));
                  return (
                    <li
                      key={proof.id}
                      className="border border-border rounded-sm p-2"
                    >
                      <div className="flex flex-wrap justify-between gap-2">
                        <b>v{proof.version}</b>
                        <span className="text-xs font-bold uppercase tracking-wide text-text-tertiary">
                          {undecided
                            ? oursToDecide
                              ? "Needs your review"
                              : "With the customer"
                            : proof.decision === "approved"
                              ? "Approved"
                              : "Changes requested"}
                        </span>
                      </div>
                      {proofUrl ? (
                        <a
                          href={proofUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-block mt-2 text-xs font-bold text-accent"
                        >
                          {imageLike && (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={proofUrl}
                              alt={`Proof version ${proof.version}`}
                              className="max-h-56 max-w-full object-contain border border-border rounded-sm bg-white mb-1"
                            />
                          )}
                          Open proof file ↗
                        </a>
                      ) : (
                        <p role="alert" className="text-xs text-error mt-1 mb-0">
                          Proof file is unavailable; upload a replacement.
                        </p>
                      )}
                      {proof.note && (
                        <p className="text-xs text-text-secondary mt-1 mb-0">
                          Note: {proof.note}
                        </p>
                      )}
                      {proof.decisionNote && (
                        <p className="text-xs text-text-secondary mt-1 mb-0">
                          Response: “{proof.decisionNote}”
                        </p>
                      )}
                      {oursToDecide && (
                        <form
                          action={decideProofAction}
                          className="mt-2 space-y-2"
                        >
                          <input type="hidden" name="jobId" value={detail.id} />
                          <input
                            type="hidden"
                            name="proofId"
                            value={proof.id}
                          />
                          <input
                            name="note"
                            placeholder="Note (required to request changes)"
                            className="block w-full border border-border rounded-sm px-2 py-1"
                          />
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="submit"
                              name="decision"
                              value="approved"
                              className="bg-accent text-white font-bold px-3 py-1 rounded-sm"
                            >
                              Approve
                            </button>
                            <button
                              type="submit"
                              name="decision"
                              value="changes_requested"
                              className="border border-border font-bold px-3 py-1 rounded-sm"
                            >
                              Request changes
                            </button>
                          </div>
                        </form>
                      )}
                    </li>
                  );
                })}
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
