import Link from "next/link";
import { transitionJobAction } from "@/app/admin/actions";
import { adminClient } from "@/lib/admin/api";
import { jobStatusPresentation } from "@/lib/commerce/status";
import type { JobRequestStatus } from "@gwg/contracts";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export const dynamic = "force-dynamic";

const STAFF_TRANSITIONS: JobRequestStatus[] = [
  "under_review",
  "changes_requested",
  "rejected",
  "approved",
  "awaiting_payment",
  "paid",
  "ready_for_production",
];

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
            {STAFF_TRANSITIONS.map((status) => (
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

      <section className="space-y-sp-3">
        <h2 className="font-display font-bold text-xl m-0">Lines</h2>
        {detail.lines.map((line) => {
          const pricing = (
            line.snapshot.configuration as {
              pricing?: { breakdown?: { totalMinor?: number } };
            }
          )?.pricing;
          return (
            <article
              key={line.id}
              className="border border-border rounded-md p-sp-3"
            >
              <p className="font-semibold m-0">{line.snapshot.description}</p>
              <p className="text-sm text-text-secondary mt-1 mb-0">
                Qty {line.snapshot.quantity}
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
            </article>
          );
        })}
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
