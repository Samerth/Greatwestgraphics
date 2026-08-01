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
  for (const row of mappings) {
    const key = String(row.ssCategoryKey);
    const list = mapsByKey.get(key) ?? [];
    list.push(String(row.categoryId));
    mapsByKey.set(key, list);
  }

  return (
    <div className="space-y-sp-5 max-w-5xl">
      <div>
        <Link href="/admin/categories" className="text-sm font-bold text-accent">
          ← Categories
        </Link>
        <h1 className="font-display font-bold text-3xl m-0 mt-2">
          Category mappings
        </h1>
        <p className="text-text-secondary mt-2 mb-0">
          Map S&S category keys to website categories. Product overrides always
          win on re-sync.
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      <section className="space-y-sp-3">
        <h2 className="font-display font-bold text-xl m-0">
          Needs review ({unmapped.length})
        </h2>
        {unmapped.length === 0 && (
          <p className="text-sm text-text-secondary m-0">
            No unmapped S&S categories in the queue.
          </p>
        )}
        {unmapped.map((item) => {
          const key = String(item.ssCategoryKey);
          const selected = new Set(mapsByKey.get(key) ?? []);
          return (
            <form
              key={key}
              action={saveMappingAction}
              className="border border-amber-200 bg-amber-50/40 rounded-md p-sp-4 space-y-sp-2"
            >
              <input type="hidden" name="ssCategoryKey" value={key} />
              <input
                type="hidden"
                name="ssCategoryLabel"
                value={String(item.ssCategoryLabel || key)}
              />
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold m-0">{key}</p>
                  <p className="text-xs text-text-tertiary m-0 mt-1">
                    {String(item.styleCount ?? 0)} styles
                  </p>
                </div>
                <button
                  type="submit"
                  className="bg-accent text-white font-bold px-3 py-1.5 rounded-sm text-sm"
                >
                  Save mapping
                </button>
              </div>
              <div className="grid sm:grid-cols-2 gap-2">
                {categories.map((cat) => (
                  <label
                    key={String(cat.id)}
                    className="flex items-center gap-2 text-sm"
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
            </form>
          );
        })}
      </section>

      <section className="space-y-sp-3">
        <h2 className="font-display font-bold text-xl m-0">Existing maps</h2>
        {[...mapsByKey.entries()].map(([key, catIds]) => (
          <form
            key={key}
            action={saveMappingAction}
            className="border border-border rounded-md p-sp-4 space-y-sp-2 bg-bg-raised"
          >
            <input type="hidden" name="ssCategoryKey" value={key} />
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold m-0">{key}</p>
              <button
                type="submit"
                className="text-sm font-bold text-accent"
              >
                Update
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {categories.map((cat) => (
                <label
                  key={String(cat.id)}
                  className="flex items-center gap-2 text-sm"
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
          </form>
        ))}
      </section>
    </div>
  );
}
