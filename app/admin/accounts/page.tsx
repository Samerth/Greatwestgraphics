import Link from "next/link";
import { setStoreStatusAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export default async function AdminAccountsPage() {
  let stores: Record<string, unknown>[] = [];
  let allStores: Record<string, unknown>[] = [];
  let error: string | undefined;
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
                  {String(store.slug)}.greatwestgraphics.com
                  {Boolean(store.tagline) ? ` · ${String(store.tagline)}` : ""}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <form
                action={async () => {
                  "use server";
                  await setStoreStatusAction(String(store.id), "active");
                }}
              >
                <button
                  type="submit"
                  className="text-sm font-bold px-3 py-1.5 rounded-sm bg-accent text-white"
                >
                  Approve
                </button>
              </form>
              <form
                action={async () => {
                  "use server";
                  await setStoreStatusAction(String(store.id), "suspended");
                }}
              >
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
                  {String(store.slug)}.greatwestgraphics.com
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
