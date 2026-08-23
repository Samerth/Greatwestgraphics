import Link from "next/link";
import { setStoreStatusAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { storeFrontPath } from "@/lib/commerce/store-approved-email";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ notice?: string; mailed?: string; slug?: string; error?: string }>;
}) {
  const { notice, mailed, slug, error: actionError } = await searchParams;
  let stores: Record<string, unknown>[] = [];
  let allStores: Record<string, unknown>[] = [];
  let error: string | undefined = actionError;
  try {
    const client = await adminClient();
    const token = requireAdminToken();
    [stores, allStores] = await Promise.all([
      client.listPendingStores(token),
      client.listAllStores(token),
    ]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Pending stores unavailable";
  }

  const storeLink = slug ? storeFrontPath(slug) : null;

  return (
    <div className="space-y-sp-4 max-w-4xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Corporate accounts
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Pending stores</h1>
        <p className="text-text-secondary mt-2 mb-0">
          New self-serve branded stores wait here until approved. Nothing goes
          live for a client until you say so.
        </p>
      </div>

      {notice === "approved" && (
        <p className="border border-green-200 bg-green-50 text-green-900 rounded-md p-sp-3 m-0">
          Store approved
          {storeLink ? (
            <>
              {" "}
              — it is live at{" "}
              <a href={storeLink} className="font-bold underline" target="_blank" rel="noreferrer">
                {storeLink}
              </a>
            </>
          ) : null}
          .{" "}
          {mailed === "1"
            ? "The owner was emailed that link."
            : "We could not email the owner. Send them the link above."}
        </p>
      )}
      {notice === "rejected" && (
        <p className="border border-border bg-fill-subtle-15 rounded-md p-sp-3 m-0">
          Store rejected. It will not appear on the shop until you approve it.
        </p>
      )}

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {stores.length === 0 && !error && (
        <p className="text-text-secondary">No stores waiting for review.</p>
      )}

      <ul className="space-y-2 m-0 p-0 list-none">
        {stores.map((store) => (
          <li
            key={String(store.id)}
            className="border border-border rounded-md p-sp-3 flex flex-wrap justify-between gap-3 items-center bg-bg-raised"
          >
            <div className="flex items-center gap-3">
              {Boolean(store.logoUrl) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={String(store.logoUrl)}
                  alt=""
                  className="w-10 h-10 rounded-sm object-cover border border-border"
                />
              )}
              <div>
                <p className="font-semibold m-0">{String(store.name)}</p>
                <p className="text-xs text-text-tertiary m-0 mt-1">
                  {storeFrontPath(String(store.slug))}
                  {Boolean(store.tagline) ? ` · ${String(store.tagline)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <form action={setStoreStatusAction.bind(null, String(store.id), "active")}>
                <button
                  type="submit"
                  className="text-sm font-bold px-3 py-1.5 rounded-sm bg-accent text-white"
                >
                  Approve
                </button>
              </form>
              <form action={setStoreStatusAction.bind(null, String(store.id), "suspended")}>
                <button
                  type="submit"
                  className="text-sm font-bold px-3 py-1.5 rounded-sm border border-border"
                >
                  Reject
                </button>
              </form>
            </div>
          </li>
        ))}
      </ul>

      <div className="pt-sp-4 border-t border-border">
        <h2 className="font-display font-bold text-xl m-0">All stores</h2>
        <p className="text-text-secondary mt-1 mb-sp-3">
          Curate which categories a store can see and set a negotiated
          storewide pricing adjustment.
        </p>
        {allStores.length === 0 && !error && (
          <p className="text-text-secondary">No stores yet.</p>
        )}
        <ul className="space-y-2 m-0 p-0 list-none">
          {allStores.map((store) => (
            <li
              key={String(store.id)}
              className="border border-border rounded-md p-sp-3 flex flex-wrap justify-between gap-3 items-center bg-bg-raised"
            >
              <div>
                <p className="font-semibold m-0">
                  {String(store.name)}{" "}
                  <span className="text-xs font-normal text-text-tertiary">
                    · {String(store.status)}
                  </span>
                </p>
                <p className="text-xs text-text-tertiary m-0 mt-1">
                  {storeFrontPath(String(store.slug))}
                </p>
              </div>
              <Link
                href={`/admin/accounts/${String(store.id)}`}
                className="text-sm font-bold px-3 py-1.5 rounded-sm border border-border hover:border-accent hover:text-accent"
              >
                Manage
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
