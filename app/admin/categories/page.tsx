import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteCategoryAction, reorderCategoryAction } from "@/app/admin/actions";
import { AddCategoryForm } from "@/components/admin/AddCategoryForm";
import { AdminPager } from "@/components/admin/AdminPager";
import { EditCategoryForm } from "@/components/admin/EditCategoryForm";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import {
  CATEGORY_PAGE_SIZE,
  categoryListHref,
} from "@/lib/admin/mapping-list";
import { paginate, parsePage, textMatchesQuery } from "@/lib/admin/paged-list";
import { loadPublishedPricingV2 } from "@/lib/commerce/published-pricing";
import { LOCATIONS } from "@/lib/utils/shop-quote";

export const dynamic = "force-dynamic";

type AdminCategory = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  /** `null`/absent means unrestricted. */
  allowedDecorationMethods: string[] | null;
  allowedDecorationLocations: string[] | null;
};

function toStringArrayOrNull(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  return value.map((entry) => String(entry));
}

function toAdminCategory(row: Record<string, unknown>): AdminCategory {
  return {
    id: String(row.id ?? ""),
    name: String(row.name ?? ""),
    slug: String(row.slug ?? ""),
    parentId: row.parentId ? String(row.parentId) : null,
    sortOrder: Number(row.sortOrder ?? 0),
    allowedDecorationMethods: toStringArrayOrNull(row.allowedDecorationMethods),
    allowedDecorationLocations: toStringArrayOrNull(row.allowedDecorationLocations),
  };
}

function categoryMatches(cat: AdminCategory, q: string) {
  return textMatchesQuery([cat.name, cat.slug], q);
}

export default async function AdminCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    page?: string;
    error?: string;
    notice?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q || "").trim();
  const requestedPage = parsePage(sp.page);
  // Delete and move-up/down still fail by throwing (they have no form
  // fields to preserve, so there is nothing `useActionState` would buy
  // them) — a caught failure travels back here as `?error=` instead, which
  // is what this reads. Kept separate from `loadError` below: one is "the
  // page could not load," the other is "your last action did not save."
  const mutationError = sp.error;
  const mutationNotice = sp.notice;

  let categories: AdminCategory[] = [];
  let loadError: string | undefined;
  try {
    const raw = await (await adminClient()).listCategories(requireAdminToken());
    categories = raw.map(toAdminCategory);
  } catch (caught) {
    loadError =
      caught instanceof Error ? caught.message : "Categories unavailable";
  }

  // Method checkboxes offer exactly the methods the storefront currently
  // publishes — an admin restricting a category can only pick from methods
  // that actually exist, never a stale/removed key.
  const pricingConfig = await loadPublishedPricingV2();
  const methodOptions = pricingConfig.methods
    .filter((m) => m.enabled)
    .map((m) => ({ key: m.key, label: m.label }));
  const locationOptions = LOCATIONS.map((l) => ({ key: l.id, label: l.label }));

  const totalCount = categories.length;
  const isEmpty = !loadError && totalCount === 0;

  // Only top-level categories can be picked as a parent — keeps the taxonomy
  // to two levels (category → subcategory) rather than infinite nesting.
  const topLevelCategories = categories
    .filter((cat) => !cat.parentId)
    .map((cat) => ({ id: cat.id, name: cat.name }));

  const parentCategories = categories.filter((cat) => !cat.parentId);
  const childrenByParent = new Map<string, AdminCategory[]>();
  for (const cat of categories) {
    if (!cat.parentId) continue;
    const key = cat.parentId;
    const existing = childrenByParent.get(key) ?? [];
    existing.push(cat);
    childrenByParent.set(key, existing);
  }

  // Search matches a parent directly, or matches through one of its
  // children — a subcategory hit still needs its parent's row for context.
  const visibleParents = q
    ? parentCategories.filter((parent) => {
        if (categoryMatches(parent, q)) return true;
        const kids = childrenByParent.get(parent.id) ?? [];
        return kids.some((child) => categoryMatches(child, q));
      })
    : parentCategories;

  // Pagination runs over parents only, so a parent's children are never
  // split across pages — the whole group always renders together.
  const paged = paginate(visibleParents, requestedPage, CATEGORY_PAGE_SIZE);

  function childrenFor(parent: AdminCategory): AdminCategory[] {
    const kids = childrenByParent.get(parent.id) ?? [];
    if (!q) return kids;
    // If the parent itself matched, show all its children for full context.
    // Otherwise only the children that actually matched brought it here.
    if (categoryMatches(parent, q)) return kids;
    return kids.filter((child) => categoryMatches(child, q));
  }

  // Rebuilds the full id order (parents with their children nested beneath,
  // in display order) after a same-level swap, so reorderCategoryAction gets
  // a single consistent ordering for the whole category set.
  function buildFullOrder(reorderedParents: AdminCategory[]): string[] {
    return reorderedParents.flatMap((parent) => [
      parent.id,
      ...(childrenByParent.get(parent.id) ?? []).map((child) => child.id),
    ]);
  }

  function buildFullOrderWithChildren(
    parentId: string,
    reorderedChildren: AdminCategory[],
  ): string[] {
    return parentCategories.flatMap((parent) => [
      parent.id,
      ...(parent.id === parentId
        ? reorderedChildren
        : childrenByParent.get(parent.id) ?? []
      ).map((child) => child.id),
    ]);
  }

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

      {loadError && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {loadError}
        </p>
      )}
      {mutationError && (
        <p role="alert" className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {mutationError}
        </p>
      )}
      {mutationNotice && (
        <p className="border border-green-200 bg-green-50 text-green-800 rounded-md p-sp-3 m-0">
          {mutationNotice === "moved"
            ? "Moved."
            : mutationNotice === "deleted"
              ? "Category deleted."
              : mutationNotice}
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
        <AddCategoryForm parentOptions={topLevelCategories} />
      </section>

      <section className="space-y-sp-3">
        <div>
          <h2 className="font-display font-bold text-xl m-0">
            Your categories ({totalCount})
          </h2>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            Edit a name and click Save changes. Use Move up / Move down to set
            storefront order (top of the list appears first). Delete only if
            you’re sure — products mapped only to that category may need a new
            home. Showing {CATEGORY_PAGE_SIZE} at a time so this page stays
            usable as the list grows.
          </p>
        </div>

        {totalCount > 0 && (
          <form
            className="border border-border rounded-md p-sp-3 bg-bg-raised flex flex-wrap gap-3 items-end"
            action="/admin/categories"
          >
            <label className="text-sm font-semibold flex-1 min-w-[16rem]">
              Search categories
              <input
                name="q"
                defaultValue={q}
                placeholder="Name or URL…"
                className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
              />
            </label>
            <button
              type="submit"
              className="bg-accent text-white font-bold px-4 py-2 rounded-sm text-sm"
            >
              Search
            </button>
          </form>
        )}

        {(paged.total > 0 || q || (!loadError && totalCount === 0)) && (
          <p className="text-sm text-text-tertiary m-0">
            {paged.total === 0
              ? q
                ? `No categories match “${q}”.`
                : "No categories yet. Add your first one above."
              : `Showing ${paged.start}–${paged.end} of ${paged.total.toLocaleString()} top-level categories${
                  q ? ` matching “${q}”` : ""
                }.`}
          </p>
        )}

        <ol className="space-y-2 m-0 p-0 list-none">
          {paged.items.map((parent, parentIndex) => {
            const kids = childrenFor(parent);
            return (
              <li key={parent.id} className="space-y-2">
                <div className="border border-border rounded-md p-sp-3 space-y-3 bg-bg-raised">
                  <div className="flex flex-wrap justify-between gap-2 items-center">
                    <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
                      Category · Position {parentIndex + 1} of {paged.total}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {parentIndex > 0 && (
                        <form
                          action={async () => {
                            "use server";
                            const globalIndex = parentCategories.findIndex(
                              (c) => c.id === parent.id,
                            );
                            if (globalIndex <= 0) return;
                            const next = [...parentCategories];
                            const tmp = next[globalIndex - 1]!;
                            next[globalIndex - 1] = next[globalIndex]!;
                            next[globalIndex] = tmp;
                            // reorderCategoryAction still throws rather than
                            // returning a state — it has no fields to keep,
                            // so catching here and redirecting with the
                            // reason is enough; useActionState would add a
                            // client component for no real benefit.
                            try {
                              await reorderCategoryAction(buildFullOrder(next));
                            } catch (caught) {
                              redirect(
                                categoryListHref({
                                  q,
                                  page: requestedPage,
                                  error:
                                    caught instanceof Error
                                      ? caught.message
                                      : "Could not move this category.",
                                }),
                              );
                            }
                            redirect(
                              categoryListHref({
                                q,
                                page: requestedPage,
                                notice: "moved",
                              }),
                            );
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
                      {parentIndex < paged.items.length - 1 && (
                        <form
                          action={async () => {
                            "use server";
                            const globalIndex = parentCategories.findIndex(
                              (c) => c.id === parent.id,
                            );
                            if (
                              globalIndex < 0 ||
                              globalIndex >= parentCategories.length - 1
                            )
                              return;
                            const next = [...parentCategories];
                            const tmp = next[globalIndex + 1]!;
                            next[globalIndex + 1] = next[globalIndex]!;
                            next[globalIndex] = tmp;
                            try {
                              await reorderCategoryAction(buildFullOrder(next));
                            } catch (caught) {
                              redirect(
                                categoryListHref({
                                  q,
                                  page: requestedPage,
                                  error:
                                    caught instanceof Error
                                      ? caught.message
                                      : "Could not move this category.",
                                }),
                              );
                            }
                            redirect(
                              categoryListHref({
                                q,
                                page: requestedPage,
                                notice: "moved",
                              }),
                            );
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

                  <EditCategoryForm
                    categoryId={parent.id}
                    defaultName={parent.name}
                    defaultSlug={parent.slug}
                    parentOptions={topLevelCategories.filter(
                      (opt) => opt.id !== parent.id,
                    )}
                    methodOptions={methodOptions}
                    locationOptions={locationOptions}
                    defaultAllowedDecorationMethods={parent.allowedDecorationMethods}
                    defaultAllowedDecorationLocations={parent.allowedDecorationLocations}
                  />

                  <div className="border-t border-border pt-3 flex flex-wrap justify-between gap-2 items-center">
                    <p className="text-xs text-text-tertiary m-0">
                      Website path uses:{" "}
                      <span className="font-mono">{parent.slug || "—"}</span>
                    </p>
                    <form
                      action={async () => {
                        "use server";
                        try {
                          await deleteCategoryAction(parent.id);
                        } catch (caught) {
                          redirect(
                            categoryListHref({
                              q,
                              page: requestedPage,
                              error:
                                caught instanceof Error
                                  ? caught.message
                                  : "Could not delete this category.",
                            }),
                          );
                        }
                        redirect(
                          categoryListHref({
                            q,
                            page: requestedPage,
                            notice: "deleted",
                          }),
                        );
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
                </div>

                {kids.map((child, childIndex) => {
                  const siblings = childrenByParent.get(parent.id) ?? [];
                  return (
                    <div
                      key={child.id}
                      className="border border-border rounded-md p-sp-3 space-y-3 bg-bg-raised ml-6 sm:ml-10"
                    >
                      <div className="flex flex-wrap justify-between gap-2 items-center">
                        <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary m-0">
                          Subcategory · Position {childIndex + 1} of{" "}
                          {siblings.length}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {childIndex > 0 && (
                            <form
                              action={async () => {
                                "use server";
                                const next = [...siblings];
                                const tmp = next[childIndex - 1]!;
                                next[childIndex - 1] = next[childIndex]!;
                                next[childIndex] = tmp;
                                try {
                                  await reorderCategoryAction(
                                    buildFullOrderWithChildren(parent.id, next),
                                  );
                                } catch (caught) {
                                  redirect(
                                    categoryListHref({
                                      q,
                                      page: requestedPage,
                                      error:
                                        caught instanceof Error
                                          ? caught.message
                                          : "Could not move this category.",
                                    }),
                                  );
                                }
                                redirect(
                                  categoryListHref({
                                    q,
                                    page: requestedPage,
                                    notice: "moved",
                                  }),
                                );
                              }}
                            >
                              <button
                                type="submit"
                                className="text-sm font-bold px-3 py-1.5 border border-border rounded-sm hover:bg-fill-subtle-15"
                                title="Move earlier among subcategories"
                              >
                                ↑ Move up
                              </button>
                            </form>
                          )}
                          {childIndex < siblings.length - 1 && (
                            <form
                              action={async () => {
                                "use server";
                                const next = [...siblings];
                                const tmp = next[childIndex + 1]!;
                                next[childIndex + 1] = next[childIndex]!;
                                next[childIndex] = tmp;
                                try {
                                  await reorderCategoryAction(
                                    buildFullOrderWithChildren(parent.id, next),
                                  );
                                } catch (caught) {
                                  redirect(
                                    categoryListHref({
                                      q,
                                      page: requestedPage,
                                      error:
                                        caught instanceof Error
                                          ? caught.message
                                          : "Could not move this category.",
                                    }),
                                  );
                                }
                                redirect(
                                  categoryListHref({
                                    q,
                                    page: requestedPage,
                                    notice: "moved",
                                  }),
                                );
                              }}
                            >
                              <button
                                type="submit"
                                className="text-sm font-bold px-3 py-1.5 border border-border rounded-sm hover:bg-fill-subtle-15"
                                title="Move later among subcategories"
                              >
                                ↓ Move down
                              </button>
                            </form>
                          )}
                        </div>
                      </div>

                      <EditCategoryForm
                        categoryId={child.id}
                        defaultName={child.name}
                        defaultSlug={child.slug}
                        parentOptions={topLevelCategories.filter(
                          (opt) => opt.id !== child.id,
                        )}
                        methodOptions={methodOptions}
                        locationOptions={locationOptions}
                        defaultAllowedDecorationMethods={child.allowedDecorationMethods}
                        defaultAllowedDecorationLocations={child.allowedDecorationLocations}
                      />

                      <div className="border-t border-border pt-3 flex flex-wrap justify-between gap-2 items-center">
                        <p className="text-xs text-text-tertiary m-0">
                          Website path uses:{" "}
                          <span className="font-mono">{child.slug || "—"}</span>
                        </p>
                        <form
                          action={async () => {
                            "use server";
                            try {
                              await deleteCategoryAction(child.id);
                            } catch (caught) {
                              redirect(
                                categoryListHref({
                                  q,
                                  page: requestedPage,
                                  error:
                                    caught instanceof Error
                                      ? caught.message
                                      : "Could not delete this category.",
                                }),
                              );
                            }
                            redirect(
                              categoryListHref({
                                q,
                                page: requestedPage,
                                notice: "deleted",
                              }),
                            );
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
                    </div>
                  );
                })}
              </li>
            );
          })}
        </ol>

        <AdminPager
          page={paged.page}
          pageCount={paged.pageCount}
          hrefFor={(nextPage) => categoryListHref({ q, page: nextPage })}
        />
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