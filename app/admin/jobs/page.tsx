import Link from "next/link";
import { transitionJobAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { jobStatusPresentation } from "@/lib/commerce/status";
import {
  isStaffOpenJob,
  validNextStatuses,
  type JobRequestStatus,
} from "@gwg/contracts";

export const dynamic = "force-dynamic";

const QUEUES = [
  { id: "open", label: "Open" },
  { id: "submitted", label: "Submitted" },
  { id: "under_review", label: "Review" },
  { id: "changes_requested", label: "Changes" },
  { id: "payment", label: "Payment" },
  { id: "production", label: "Production" },
  { id: "fulfillment", label: "Ship / pickup" },
  { id: "closed", label: "Closed" },
  { id: "all", label: "All" },
] as const;

type QueueId = (typeof QUEUES)[number]["id"];

const PAYMENT_STATUSES = new Set<JobRequestStatus>([
  "awaiting_payment",
  "payment_pending",
  "payment_failed",
]);
const PRODUCTION_STATUSES = new Set<JobRequestStatus>([
  "paid",
  "ready_for_production",
  "in_production",
]);
const FULFILLMENT_STATUSES = new Set<JobRequestStatus>([
  "ready_for_pickup",
  "shipped",
]);
const CLOSED_STATUSES = new Set<JobRequestStatus>([
  "draft",
  "rejected",
  "completed",
  "cancelled",
]);

function matchesQueue(
  status: JobRequestStatus,
  invoiceRequested: boolean,
  queue: QueueId,
): boolean {
  if (queue === "all") return true;
  if (queue === "open") return isStaffOpenJob(status);
  if (queue === "payment") {
    return PAYMENT_STATUSES.has(status) || invoiceRequested;
  }
  if (queue === "production") return PRODUCTION_STATUSES.has(status);
  if (queue === "fulfillment") return FULFILLMENT_STATUSES.has(status);
  if (queue === "closed") return CLOSED_STATUSES.has(status);
  return status === queue;
}

export default async function AdminJobsPage({
  searchParams,
}: {
  searchParams: Promise<{ queue?: string }>;
}) {
  const { queue: rawQueue } = await searchParams;
  const queue = QUEUES.some((item) => item.id === rawQueue)
    ? (rawQueue as QueueId)
    : "open";

  let jobs: Awaited<
    ReturnType<Awaited<ReturnType<typeof adminClient>>["listJobRequests"]>
  > = [];
  let storeNames = new Map<string, string>();
  let error: string | undefined;
  try {
    const client = await adminClient();
    const token = requireAdminToken();
    const [rows, stores] = await Promise.all([
      client.listJobRequestsAsStaff(token),
      client.listAllStores(token).catch(() => []),
    ]);
    jobs = rows;
    storeNames = new Map(
      stores
        .filter((store) => typeof store.id === "string")
        .map((store) => [String(store.id), String(store.name ?? store.slug)]),
    );
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Jobs unavailable";
  }

  const filtered = jobs.filter((job) =>
    matchesQueue(job.status, Boolean(job.invoiceRequestedAt), queue),
  );

  return (
    <div className="space-y-sp-4 max-w-5xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Staff inbox
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Jobs</h1>
        <p className="text-text-secondary mt-2 mb-0">
          Open hides drafts and closed jobs. Payment includes invoice requests.
        </p>
      </div>

      <nav className="flex flex-wrap gap-2" aria-label="Job queues">
        {QUEUES.map((item) => {
          const count = jobs.filter((job) =>
            matchesQueue(job.status, Boolean(job.invoiceRequestedAt), item.id),
          ).length;
          const active = item.id === queue;
          return (
            <Link
              key={item.id}
              href={item.id === "open" ? "/admin/jobs" : `/admin/jobs?queue=${item.id}`}
              className={`text-sm font-bold px-3 py-1 rounded-full border ${
                active
                  ? "bg-accent text-white border-accent"
                  : "border-border text-text-secondary hover:border-accent"
              }`}
            >
              {item.label} {count}
            </Link>
          );
        })}
      </nav>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {!error && filtered.length === 0 && (
        <p className="border border-border rounded-md p-sp-4 text-text-secondary m-0">
          No jobs in this queue.
        </p>
      )}

      <div className="space-y-sp-3">
        {filtered.map((job) => {
          const presentation = jobStatusPresentation[job.status];
          const nextStatuses = validNextStatuses(job.status);
          return (
            <article
              key={job.id}
              className="border border-border rounded-md p-sp-4 bg-bg-raised"
            >
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <p className="font-display font-bold text-lg m-0">
                    {job.displayId}
                  </p>
                  <p className="text-xs text-text-tertiary mt-1 mb-0">
                    {job.customerName || "Customer"} ·{" "}
                    {storeNames.get(job.context.storeId) ?? "Main store"} ·{" "}
                    {job.submittedAt
                      ? new Date(job.submittedAt).toLocaleString("en-CA")
                      : "Not submitted"}
                    {job.invoiceRequestedAt ? " · Invoice requested" : ""}
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
                {nextStatuses.length > 0 ? (
                  <form
                    action={async (formData) => {
                      "use server";
                      const toStatus = String(formData.get("toStatus") || "");
                      const reason =
                        String(formData.get("reason") || "") || undefined;
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
                      {nextStatuses.map((status) => (
                        <option key={status} value={status}>
                          {jobStatusPresentation[status].label}
                        </option>
                      ))}
                    </select>
                    <input
                      name="reason"
                      placeholder="Reason (required to cancel)"
                      className="border border-border rounded-sm px-2 py-1 text-sm"
                    />
                    <button
                      type="submit"
                      className="bg-accent text-white text-sm font-bold px-3 py-1 rounded-sm"
                    >
                      Apply
                    </button>
                  </form>
                ) : (
                  <span className="text-xs text-text-tertiary">
                    No further transitions
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
