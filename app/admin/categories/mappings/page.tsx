import Link from "next/link";
import { saveMappingAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export default async function AdminCategoryMappingsPage() {
  const token = requireAdminToken();
  let mappings: Record<string, unknown>[] = [];
  let unmapped: Record<string, unknown>[] = [];
  let categories: Record<string, unknown>[] = [];
  let error: string | undefined;

  try {
    const [mapPayload, cats] = await Promise.all([
      (await adminClient()).getCategoryMappings(token),
      (await adminClient()).listCategories(token),
    ]);
    mappings = mapPayload.mappings;
    unmapped = mapPayload.unmapped;
    categories = cats;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Mappings unavailable";
  }

  const mapsByKey = new Map<string, string[]>();
  const labelByKey = new Map<string, string>();
  for (const row of mappings) {
    const key = String(row.ssCategoryKey);
    const list = mapsByKey.get(key) ?? [];
    list.push(String(row.categoryId));
    mapsByKey.set(key, list);
    if (row.ssCategoryLabel) {
      labelByKey.set(key, String(row.ssCategoryLabel));
    }
  }

  const hasCategories = categories.length > 0;
  const needsReview = unmapped.length > 0;

  return (
    <div className="space-y-sp-5 max-w-5xl">
      <div>
        <Link href="/admin/categories" className="text-sm font-bold text-accent">
          ← Back to categories
        </Link>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0 mt-3">
          Connect vendors
        </p>
        <h1 className="font-display font-bold text-3xl m-0 mt-1">
          Vendor category mappings
        </h1>
        <p className="text-text-secondary mt-2 mb-0 max-w-2xl">
          Vendors (S&amp;S Activewear, Sanmar, and CSV imports) use their own
          category labels. This page connects those vendor labels to{" "}
          <strong>your</strong> Great West Graphics categories so products land
          in the right browse bucket on the website.
        </p>
        <p className="text-sm text-text-tertiary mt-2 mb-0 max-w-2xl">
          Note: if a product is assigned to categories by hand in Catalog, that
          choice wins over these mappings when you re-sync.
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {!hasCategories && !error && (
        <section className="border border-amber-200 bg-amber-50/50 rounded-md p-sp-4 space-y-2">
          <h2 className="font-display font-bold text-lg m-0">
            Create categories first
          </h2>
          <p className="text-sm text-text-secondary m-0">
            You don’t have any GWG categories yet. Add at least one (for example
            “T-Shirts”) before you can connect vendor labels.
          </p>
          <Link
            href="/admin/categories#add-category"
            className="inline-block text-sm font-bold text-accent"
          >
            Add a category →
          </Link>
        </section>
      )}

      {hasCategories && needsReview && (
        <section className="border border-border rounded-md p-sp-4 bg-bg-raised space-y-sp-2">
          <h2 className="font-display font-bold text-lg m-0">
            How to clear the “Needs review” list
          </h2>
          <ol className="m-0 pl-5 space-y-1.5 text-sm text-text-secondary">
            <li>
              Read the vendor label (what S&amp;S / Sanmar called it) and how
              many styles are waiting.
            </li>
            <li>
              Check one or more of <em>your</em> GWG categories that should
              include those products (you can pick more than one).
            </li>
            <li>
              Click <strong>Save mapping</strong>. Those styles will use that
              category on the next sync / catalog refresh.
            </li>
          </ol>
        </section>
      )}

      <section className="space-y-sp-3">
        <div>
          <h2 className="font-display font-bold text-xl m-0">
            Needs review ({unmapped.length})
          </h2>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            These vendor labels are not connected yet. Products under them won’t
            show in the right storefront category until you map them.
          </p>
        </div>

        {unmapped.length === 0 && (
          <p className="text-sm text-text-secondary border border-border rounded-md p-sp-4 m-0 bg-bg-raised">
            All caught up — nothing waiting for a mapping right now.
          </p>
        )}

        {unmapped.map((item) => {
          const key = String(item.ssCategoryKey);
          const label = String(item.ssCategoryLabel || key);
          const selected = new Set(mapsByKey.get(key) ?? []);
          const styleCount = Number(item.styleCount ?? 0);
          return (
            <form
              key={key}
              action={saveMappingAction}
              className="border border-amber-200 bg-amber-50/40 rounded-md p-sp-4 space-y-sp-3"
            >
              <input type="hidden" name="ssCategoryKey" value={key} />
              <input type="hidden" name="ssCategoryLabel" value={label} />
              <div className="flex flex-wrap justify-between gap-2 items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-800/80 m-0">
                    Vendor label
                  </p>
                  <p className="font-semibold m-0 mt-1 text-lg">{label}</p>
                  {label !== key && (
                    <p className="text-xs text-text-tertiary m-0 mt-1 font-mono">
                      Vendor key: {key}
                    </p>
                  )}
                  <p className="text-sm text-text-secondary m-0 mt-2">
                    {styleCount} style{styleCount === 1 ? "" : "s"} waiting —
                    choose where they should appear on your site.
                  </p>
                </div>
                <button
                  type="submit"
                  className="bg-accent text-white font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-50"
                  disabled={!hasCategories}
                >
                  Save mapping
                </button>
              </div>
              {hasCategories ? (
                <fieldset className="m-0 p-0 border-0">
                  <legend className="text-sm font-semibold mb-2">
                    Put these products in…
                  </legend>
                  <div className="grid sm:grid-cols-2 gap-2">
                    {categories.map((cat) => (
                      <label
                        key={String(cat.id)}
                        className="flex items-center gap-2 text-sm border border-border/70 rounded-sm px-3 py-2 bg-bg"
                      >
                        <input
                          type="checkbox"
                          name="categoryIds"
                          value={String(cat.id)}
                          defaultChecked={selected.has(String(cat.id))}
                        />
                        {String(cat.name)}
                      </label>
                    ))}
                  </div>
                </fieldset>
              ) : (
                <p className="text-sm text-text-secondary m-0">
                  Add a GWG category first, then return here to map this label.
                </p>
              )}
            </form>
          );
        })}
      </section>

      <section className="space-y-sp-3">
        <div>
          <h2 className="font-display font-bold text-xl m-0">
            Already mapped ({mapsByKey.size})
          </h2>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            Change checkboxes and click Update if a vendor label should point
            somewhere else.
          </p>
        </div>

        {mapsByKey.size === 0 && (
          <p className="text-sm text-text-secondary border border-dashed border-border rounded-md p-sp-4 m-0">
            No mappings saved yet. When vendor labels show up under Needs review,
            connect them here.
          </p>
        )}

        {[...mapsByKey.entries()].map(([key, catIds]) => {
          const label = labelByKey.get(key) || key;
          return (
            <form
              key={key}
              action={saveMappingAction}
              className="border border-border rounded-md p-sp-4 space-y-sp-3 bg-bg-raised"
            >
              <input type="hidden" name="ssCategoryKey" value={key} />
              <input type="hidden" name="ssCategoryLabel" value={label} />
              <div className="flex flex-wrap justify-between gap-2 items-start">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
                    Vendor label
                  </p>
                  <p className="font-semibold m-0 mt-1">{label}</p>
                  {label !== key && (
                    <p className="text-xs text-text-tertiary m-0 mt-1 font-mono">
                      Vendor key: {key}
                    </p>
                  )}
                </div>
                <button
                  type="submit"
                  className="text-sm font-bold text-accent px-3 py-1.5 border border-border rounded-sm hover:bg-fill-subtle-15"
                >
                  Update mapping
                </button>
              </div>
              <fieldset className="m-0 p-0 border-0">
                <legend className="text-sm font-semibold mb-2">
                  Appears under…
                </legend>
                <div className="grid sm:grid-cols-2 gap-2">
                  {categories.map((cat) => (
                    <label
                      key={String(cat.id)}
                      className="flex items-center gap-2 text-sm border border-border/70 rounded-sm px-3 py-2 bg-bg"
                    >
                      <input
                        type="checkbox"
                        name="categoryIds"
                        value={String(cat.id)}
                        defaultChecked={catIds.includes(String(cat.id))}
                      />
                      {String(cat.name)}
                    </label>
                  ))}
                </div>
              </fieldset>
            </form>
          );
        })}
      </section>
    </div>
  );
}
