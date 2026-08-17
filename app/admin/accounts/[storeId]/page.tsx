import Link from "next/link";
import { notFound } from "next/navigation";
import {
  setStoreCategoryVisibilityAction,
  setStorePricingAdjustmentAction,
} from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export default async function AdminStoreDetailPage({
  params,
}: {
  params: Promise<{ storeId: string }>;
}) {
  const { storeId } = await params;
  const client = await adminClient();
  const token = requireAdminToken();

  let store: Record<string, unknown> | null = null;
  let categories: Record<string, unknown>[] = [];
  let visibleCategoryIds: string[] | null = null;
  let error: string | undefined;
  try {
    [store, categories] = await Promise.all([
      client.getStore(storeId, token),
      client.listCategories(token),
    ]);
    const visibility = await client.getStoreCategoryVisibility(storeId, token);
    visibleCategoryIds = visibility.categoryIds;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Store unavailable";
  }

  if (!store && !error) notFound();

  const currentAdjustment =
    store && typeof store.pricingAdjustmentPercent === "number"
      ? (store.pricingAdjustmentPercent * 100).toFixed(1)
      : "";
  const visibleSet = new Set(visibleCategoryIds ?? []);

  return (
    <div className="space-y-sp-4 max-w-2xl">
      <div>
        <Link href="/admin/accounts" className="text-sm text-accent font-bold">
          ← All stores
        </Link>
        <h1 className="font-display font-bold text-3xl m-0 mt-2">
          {store ? String(store.name) : "Store"}
        </h1>
        {store && (
          <p className="text-text-secondary mt-1 mb-0">
            {/* The address this store can actually be opened at today. It used
                to advertise a subdomain that has no DNS behind it, so the one
                thing staff would copy to a customer was the one thing that
                did not work. */}
            <a
              href={`/s/${String(store.slug)}`}
              className="underline"
              target="_blank"
              rel="noreferrer"
            >
              /s/{String(store.slug)}
            </a>{" "}
            · {String(store.status)}
          </p>
        )}
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {store && (
        <>
          <section className="border border-border rounded-md p-sp-4 bg-bg-raised space-y-sp-3">
            <div>
              <h2 className="font-display font-bold text-lg m-0">
                Storewide pricing adjustment
              </h2>
              <p className="text-text-secondary text-sm mt-1 mb-0">
                A negotiated discount or markup applied on top of the
                published pricing config, e.g. <code>-10</code> for 10% off,{" "}
                <code>5</code> for a 5% markup. Applies to garment and
                decoration markup only, not flat setup/packing fees. Leave
                blank for no adjustment.
              </p>
            </div>
            <form
              action={async (formData) => {
                "use server";
                await setStorePricingAdjustmentAction(storeId, formData);
              }}
              className="flex items-end gap-3"
            >
              <label className="text-sm font-bold">
                Adjustment %
                <input
                  type="number"
                  step="0.1"
                  min={-90}
                  max={200}
                  name="percent"
                  defaultValue={currentAdjustment}
                  placeholder="0"
                  className="block mt-1.5 w-32 rounded-md border border-border bg-bg-page px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </label>
              <button
                type="submit"
                className="text-sm font-bold px-3 py-2 rounded-sm bg-accent text-white"
              >
                Save
              </button>
            </form>
          </section>

          <section className="border border-border rounded-md p-sp-4 bg-bg-raised space-y-sp-3">
            <div>
              <h2 className="font-display font-bold text-lg m-0">
                Curated catalog
              </h2>
              <p className="text-text-secondary text-sm mt-1 mb-0">
                Select categories to restrict this store to. Select nothing
                to show the full catalog (default).
              </p>
            </div>
            <form
              action={async (formData) => {
                "use server";
                await setStoreCategoryVisibilityAction(storeId, formData);
              }}
              className="space-y-sp-3"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {categories.map((category) => (
                  <label
                    key={String(category.id)}
                    className="flex items-center gap-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      name="categoryIds"
                      value={String(category.id)}
                      defaultChecked={visibleSet.has(String(category.id))}
                    />
                    {String(category.name)}
                  </label>
                ))}
              </div>
              {categories.length === 0 && (
                <p className="text-text-secondary text-sm">
                  No categories configured yet.
                </p>
              )}
              <button
                type="submit"
                className="text-sm font-bold px-3 py-2 rounded-sm bg-accent text-white"
              >
                Save catalog
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
