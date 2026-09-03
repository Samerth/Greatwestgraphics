import Link from "next/link";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { lineSnapshotTotalMinor, moneyFromMinor } from "@/lib/utils/quote-pricing";

export const dynamic = "force-dynamic";

export default async function AdminQuotesPage() {
  let jobs: Awaited<
    ReturnType<Awaited<ReturnType<typeof adminClient>>["listJobRequests"]>
  > = [];
  let error: string | undefined;
  try {
    jobs = await (await adminClient()).listJobRequestsAsStaff(
      requireAdminToken(),
    );
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Quotes unavailable";
  }

  const rows: Array<{
    jobId: string;
    displayId: string;
    lineId: string;
    description: string;
    quantity: number;
    totalMinor?: number;
    needsArtworkReview?: boolean;
    unitCostMinor?: number;
  }> = [];

  if (!error) {
    // One request per job, run together rather than one-at-a-time — this
    // page hung for 15s+ / never finished loading with even 22 jobs before
    // (found during a live audit), since each detail fetch is a full
    // staff-authed round trip and they were previously awaited in sequence.
    // Same per-job try/catch as before: one bad detail fetch is skipped,
    // not fatal to the rest of the page.
    const client = await adminClient();
    const token = requireAdminToken();
    const details = await Promise.all(
      jobs.slice(0, 40).map(async (job) => {
        try {
          return { job, detail: await client.getJobRequestAsStaff(job.id, token) };
        } catch {
          return null;
        }
      }),
    );
    for (const entry of details) {
      if (!entry) continue;
      const { job, detail } = entry;
      for (const line of detail.lines) {
        const pricing = (
          line.snapshot.configuration as {
            pricing?: {
              breakdown?: {
                totalMinor?: number;
                totals?: { totalMinor?: number };
              };
              input?: {
                garment?: { unitCostMinor?: number };
                needsArtworkReview?: boolean;
              };
            };
          }
        )?.pricing;
        rows.push({
          jobId: job.id,
          displayId: job.displayId,
          lineId: line.id,
          description: line.snapshot.description,
          quantity: line.snapshot.quantity,
          totalMinor: lineSnapshotTotalMinor(pricing),
          needsArtworkReview: pricing?.input?.needsArtworkReview,
          unitCostMinor: pricing?.input?.garment?.unitCostMinor,
        });
      }
    }
  }

  return (
    <div className="space-y-sp-4 max-w-5xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Pricing snapshots
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Quotes</h1>
        <p className="text-text-secondary mt-2 mb-0">
          Job lines with stored pricing snapshots and artwork-review flags.
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-bg-raised text-left">
            <tr>
              <th className="p-3">Job</th>
              <th className="p-3">Line</th>
              <th className="p-3">Qty</th>
              <th className="p-3">Cost</th>
              <th className="p-3">Total</th>
              <th className="p-3">Review</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.lineId} className="border-t border-border">
                <td className="p-3">
                  <Link
                    href={`/admin/jobs/${row.jobId}`}
                    className="font-bold text-accent"
                  >
                    {row.displayId}
                  </Link>
                </td>
                <td className="p-3">{row.description}</td>
                <td className="p-3">{row.quantity}</td>
                <td className="p-3">
                  {row.unitCostMinor != null
                    ? moneyFromMinor(row.unitCostMinor)
                    : "—"}
                </td>
                <td className="p-3">
                  {row.totalMinor != null
                    ? moneyFromMinor(row.totalMinor)
                    : "—"}
                </td>
                <td className="p-3">
                  {row.needsArtworkReview ? (
                    <span className="text-amber-700 font-semibold">
                      needs artwork
                    </span>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!error && rows.length === 0 && (
        <p className="text-sm text-text-secondary m-0">No quote lines yet.</p>
      )}
    </div>
  );
}
