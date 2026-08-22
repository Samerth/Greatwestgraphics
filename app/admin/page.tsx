import Link from "next/link";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  let dash: Record<string, unknown> | null = null;
  let error: string | undefined;
  try {
    dash = await (await adminClient()).getAdminDashboard(requireAdminToken());
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Dashboard unavailable";
  }

  const cards = [
    {
      label: "Open jobs",
      value: String(dash?.openJobs ?? "—"),
      href: "/admin/jobs",
    },
    {
      label: "Catalog products",
      value: String(dash?.productCount ?? "—"),
      href: "/admin/catalog",
    },
    {
      label: "Unmapped supplier categories",
      hint: "S&S categories with no storefront mapping — not a product count",
      value: String(dash?.unmappedCount ?? "—"),
      href: "/admin/categories/mappings",
    },
  ];

  const lastSync = dash?.lastSync as
    | {
        status?: string;
        type?: string;
        finishedAt?: string;
        startedAt?: string;
        errorSummary?: string | null;
        error_summary?: string | null;
      }
    | null
    | undefined;
  const syncError =
    lastSync?.errorSummary || lastSync?.error_summary || null;

  return (
    <div className="space-y-sp-5 max-w-5xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Overview
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Dashboard</h1>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      <div className="grid sm:grid-cols-3 gap-sp-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="border border-border rounded-md bg-bg-raised p-sp-4 hover:border-accent"
          >
            <p className="text-xs font-bold uppercase text-text-tertiary m-0">
              {card.label}
            </p>
            <p className="font-display font-bold text-3xl m-0 mt-2">
              {card.value}
            </p>
            {"hint" in card && card.hint ? (
              <p className="text-xs text-text-tertiary m-0 mt-2">{card.hint}</p>
            ) : null}
          </Link>
        ))}
      </div>

      <section className="border border-border rounded-md p-sp-4 bg-bg-raised">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-bold text-xl m-0">Last sync</h2>
          <Link href="/admin/sync" className="text-sm font-bold text-accent">
            Open sync
          </Link>
        </div>
        {lastSync ? (
          <div className="mt-2">
            <p className="text-sm text-text-secondary m-0">
              {lastSync.type} · {lastSync.status}
              {lastSync.finishedAt || lastSync.startedAt
                ? ` · ${new Date(
                    lastSync.finishedAt || lastSync.startedAt || "",
                  ).toLocaleString("en-CA")}`
                : ""}
            </p>
            {lastSync.status === "completed_with_errors" && (
              <p className="text-sm text-text-secondary m-0 mt-2">
                The run finished, but some styles or prices did not update.
                Open Sync for the full log
                {syncError ? " — the latest error is below." : "."}
              </p>
            )}
            {syncError ? (
              <pre className="mt-2 mb-0 max-h-40 overflow-auto whitespace-pre-wrap rounded-sm border border-border bg-bg p-sp-3 text-xs text-text-secondary">
                {syncError}
              </pre>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-text-secondary mt-2 mb-0">
            No sync runs yet. Configure S&S credentials and run a full sync.
          </p>
        )}
      </section>
    </div>
  );
}
