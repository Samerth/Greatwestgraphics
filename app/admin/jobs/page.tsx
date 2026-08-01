import Link from "next/link";
import { transitionJobAction } from "@/app/admin/actions";
import { adminClient } from "@/lib/admin/api";
import { jobStatusPresentation } from "@/lib/commerce/status";
import type { JobRequestStatus } from "@gwg/contracts";

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

export default async function AdminJobsPage() {
  let jobs: Awaited<
    ReturnType<Awaited<ReturnType<typeof adminClient>>["listJobRequests"]>
  > = [];
  let error: string | undefined;
  try {
    jobs = await (await adminClient()).listJobRequests();
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Jobs unavailable";
  }

  return (
    <div className="space-y-sp-4 max-w-5xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Staff inbox
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Jobs</h1>
        <p className="text-text-secondary mt-2 mb-0">
          Review submitted storefront requests and advance status. Customer view
          remains at{" "}
          <Link href="/portal/jobs" className="text-accent font-bold">
            /portal/jobs
          </Link>
          .
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {!error && jobs.length === 0 && (
        <p className="border border-border rounded-md p-sp-4 text-text-secondary m-0">
          No jobs yet.
        </p>
      )}

      <div className="space-y-sp-3">
        {jobs.map((job) => {
          const presentation = jobStatusPresentation[job.status];
          return (
            <article
              key={job.id}
              className="border border-border rounded-md p-sp-4 bg-bg-raised"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-mono text-sm m-0">{job.id}</p>
                  <p className="text-xs text-text-tertiary mt-1 mb-0">
                    {job.submittedAt
                      ? new Date(job.submittedAt).toLocaleString("en-CA")
                      : "Not submitted"}
                  </p>
                </div>
                <span className="text-sm font-bold bg-accent-tint text-accent px-3 py-1 rounded-full">
                  {presentation.label}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-2 mb-3">
                {presentation.nextAction}
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <Link
                  href={`/admin/jobs/${job.id}`}
                  className="text-sm font-bold text-accent"
                >
                  Open
                </Link>
                <form
                  action={async (formData) => {
                    "use server";
                    const toStatus = String(formData.get("toStatus") || "");
                    const reason = String(formData.get("reason") || "") || undefined;
                    await transitionJobAction(job.id, toStatus, reason);
                  }}
                  className="flex flex-wrap gap-2 items-center"
                >
                  <select
                    name="toStatus"
                    className="border border-border rounded-sm px-2 py-1 text-sm"
                    defaultValue=""
                    required
                  >
                    <option value="" disabled>
                      Transition to…
                    </option>
                    {STAFF_TRANSITIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                  <input
                    name="reason"
                    placeholder="Reason (optional)"
                    className="border border-border rounded-sm px-2 py-1 text-sm"
                  />
                  <button
                    type="submit"
                    className="bg-accent text-white text-sm font-bold px-3 py-1 rounded-sm"
                  >
                    Apply
                  </button>
                </form>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
