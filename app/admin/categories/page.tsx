import Link from "next/link";
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoryAction,
  updateCategoryAction,
} from "@/app/admin/actions";
import { CategoryNameFields } from "@/components/admin/CategoryNameFields";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  let categories: Record<string, unknown>[] = [];
  let error: string | undefined;
  try {
    categories = await (await adminClient()).listCategories(requireAdminToken());
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Categories unavailable";
  }

  const isEmpty = !error && categories.length === 0;

  return (
    <div className="space-y-sp-5 max-w-4xl">
      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div className="max-w-2xl">
          <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
            Storefront browse
          </p>
          <h1 className="font-display font-bold text-3xl m-0">Categories</h1>
          <p className="text-text-secondary mt-2 mb-0">
            Categories are the browse buckets shoppers see on the Great West
            Graphics website — like “T-Shirts” or “Hoodies”. They are{" "}
            <em>your</em> labels, not the vendor’s. After you create categories,
            use{" "}
            <Link
              href="/admin/categories/mappings"
              className="font-bold text-accent"
            >
              Vendor mappings
            </Link>{" "}
            to connect S&amp;S / Sanmar labels so products land in the right
            place.
          </p>
        </div>
        <Link
          href="/admin/categories/mappings"
          className="text-sm font-bold text-accent shrink-0 border border-border rounded-sm px-3 py-2 bg-bg-raised hover:bg-fill-subtle-15"
        >
          Connect vendor labels →
        </Link>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {isEmpty && (
        <section className="border border-border rounded-md p-sp-4 bg-bg-raised space-y-sp-3">
          <h2 className="font-display font-bold text-xl m-0">
            Getting started
          </h2>
          <ol className="m-0 pl-5 space-y-2 text-sm text-text-secondary">
            <li>
              <strong className="text-text-primary">Add a category</strong> —
              type a shopper-friendly name below (for example “T-Shirts”). The
              website URL name is filled in for you.
            </li>
            <li>
              <strong className="text-text-primary">Reorder the list</strong> —
              use Move up / Move down so the order matches how you want them
              shown on the site.
            </li>
            <li>
              <strong className="text-text-primary">
                Connect vendor labels
              </strong>{" "}
              — open Vendor mappings and match S&amp;S / Sanmar labels to these
              categories so catalog products show up in the right bucket.
            </li>
          </ol>
        </section>
      )}

      <section
        id="add-category"
        className="border border-border rounded-md p-sp-4 bg-bg-raised space-y-sp-3"
      >
        <div>
          <h2 className="font-display font-bold text-xl m-0">
            Add a category
          </h2>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            Enter the name customers should see. You only need a name — the URL
            name is created automatically. Open “Advanced” only if you must set
            a custom URL.
          </p>
        </div>
        <form action={createCategoryAction} className="space-y-sp-3">
          <CategoryNameFields mode="create" nameId="new-category-name" />
          <button
            type="submit"
            className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
          >
            Add a category
          </button>
        </form>
      </section>

      <section className="space-y-sp-3">
        <div>
          <h2 className="font-display font-bold text-xl m-0">
            Your categories ({categories.length})
          </h2>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            Edit a name and click Save changes. Use Move up / Move down to set
            storefront order (top of the list appears first). Delete only if
            you’re sure — products mapped only to that category may need a new
            home.
          </p>
        </div>

        {categories.length === 0 && !error && (
          <p className="text-sm text-text-secondary border border-dashed border-border rounded-md p-sp-4 m-0">
            No categories yet. Add your first one above.
          </p>
        )}

        <ol className="space-y-2 m-0 p-0 list-none">
          {categories.map((cat, index) => (
            <li
              key={String(cat.id)}
              className="border border-border rounded-md p-sp-3 space-y-3 bg-bg-raised"
            >
              <div className="flex flex-wrap justify-between gap-2 items-center">
                <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
                  Position {index + 1} of {categories.length}
                </p>
                <div className="flex flex-wrap gap-2">
                  {index > 0 && (
                    <form
                      action={async () => {
                        "use server";
                        const ids = categories.map((c) => String(c.id));
                        const next = [...ids];
                        const tmp = next[index - 1]!;
                        next[index - 1] = next[index]!;
                        next[index] = tmp;
                        await reorderCategoryAction(next);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm font-bold px-3 py-1.5 border border-border rounded-sm hover:bg-fill-subtle-15"
                        title="Move earlier in the storefront list"
                      >
                        ↑ Move up
                      </button>
                    </form>
                  )}
                  {index < categories.length - 1 && (
                    <form
                      action={async () => {
                        "use server";
                        const ids = categories.map((c) => String(c.id));
                        const next = [...ids];
                        const tmp = next[index + 1]!;
                        next[index + 1] = next[index]!;
                        next[index] = tmp;
                        await reorderCategoryAction(next);
                      }}
                    >
                      <button
                        type="submit"
                        className="text-sm font-bold px-3 py-1.5 border border-border rounded-sm hover:bg-fill-subtle-15"
                        title="Move later in the storefront list"
                      >
                        ↓ Move down
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <form
                action={async (formData) => {
                  "use server";
                  await updateCategoryAction(String(cat.id), formData);
                }}
                className="space-y-sp-3"
              >
                <CategoryNameFields
                  mode="edit"
                  defaultName={String(cat.name || "")}
                  defaultSlug={String(cat.slug || "")}
                />
                <div className="flex flex-wrap gap-3 items-center">
                  <button
                    type="submit"
                    className="text-sm font-bold text-accent px-3 py-2 border border-border rounded-sm hover:bg-fill-subtle-15"
                  >
                    Save changes
                  </button>
                  <p className="text-xs text-text-tertiary m-0">
                    Tip: rename for shoppers anytime; only touch the URL name if
                    an old link must stay the same.
                  </p>
                </div>
              </form>

              <div className="border-t border-border pt-3 flex flex-wrap justify-between gap-2 items-center">
                <p className="text-xs text-text-tertiary m-0">
                  Website path uses:{" "}
                  <span className="font-mono">{String(cat.slug || "—")}</span>
                </p>
                <form
                  action={async () => {
                    "use server";
                    await deleteCategoryAction(String(cat.id));
                  }}
                >
                  <button
                    type="submit"
                    className="text-sm font-bold text-red-700 px-2 py-1 hover:underline"
                  >
                    Delete category
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {!isEmpty && (
        <aside className="border border-border rounded-md p-sp-4 bg-fill-subtle-15 space-y-2">
          <h2 className="font-display font-bold text-lg m-0">Next step</h2>
          <p className="text-sm text-text-secondary m-0">
            Categories alone don’t pull in vendor products. Connect S&amp;S and
            Sanmar labels on the mappings page so styles appear under the right
            browse bucket.
          </p>
          <Link
            href="/admin/categories/mappings"
            className="inline-block text-sm font-bold text-accent"
          >
            Go to vendor mappings →
          </Link>
        </aside>
      )}
    </div>
  );
}
