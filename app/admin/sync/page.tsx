import { runSyncAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  let runs: Record<string, unknown>[] = [];
  let error: string | undefined;
  try {
    runs = await (await adminClient()).listSyncRuns(requireAdminToken());
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Sync history unavailable";
  }

  return (
    <div className="space-y-sp-4 max-w-4xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          S&S Canada
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Catalog sync</h1>
        <p className="text-text-secondary mt-2 mb-0">
          Full sync pulls styles, products, images, and category assignment.
          Inventory refresh updates quantities only.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <form
          action={async () => {
            "use server";
            await runSyncAction("full");
          }}
        >
          <button
            type="submit"
            className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
          >
            Run full sync
          </button>
        </form>
        <form
          action={async () => {
            "use server";
            await runSyncAction("inventory");
          }}
        >
          <button
            type="submit"
            className="border border-border font-bold px-4 py-2 rounded-sm"
          >
            Inventory refresh
          </button>
        </form>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-display font-bold text-xl m-0">Recent runs</h2>
        {runs.length === 0 && (
          <p className="text-sm text-text-secondary m-0">No runs logged yet.</p>
        )}
        {runs.map((run) => (
          <article
            key={String(run.id)}
            className="border border-border rounded-md p-sp-3 text-sm bg-bg-raised"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold m-0">
                {String(run.type)} · {String(run.status)}
              </p>
              <p className="text-text-tertiary m-0">
                {run.startedAt
                  ? new Date(String(run.startedAt)).toLocaleString("en-CA")
                  : ""}
              </p>
            </div>
            <p className="mt-2 mb-0 text-text-secondary">
              styles {String(run.stylesProcessed ?? "—")} · skus{" "}
              {String(run.skusUpserted ?? "—")} · images{" "}
              {String(run.imagesDownloaded ?? "—")}
              {run.rateLimitRemaining != null
                ? ` · rate-limit ${String(run.rateLimitRemaining)}`
                : ""}
            </p>
            {run.errorSummary ? (
              <pre className="mt-2 mb-0 text-xs whitespace-pre-wrap text-red-800">
                {typeof run.errorSummary === "string"
                  ? run.errorSummary
                  : JSON.stringify(run.errorSummary, null, 2)}
              </pre>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
