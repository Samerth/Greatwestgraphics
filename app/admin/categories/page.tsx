import Link from "next/link";
import {
  createCategoryAction,
  deleteCategoryAction,
  reorderCategoryAction,
} from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  let categories: Record<string, unknown>[] = [];
  let error: string | undefined;
  try {
    categories = await adminClient().listCategories(requireAdminToken());
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Categories unavailable";
  }

  return (
    <div className="space-y-sp-4 max-w-4xl">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
            Taxonomy
          </p>
          <h1 className="font-display font-bold text-3xl m-0">Categories</h1>
        </div>
        <Link
          href="/admin/categories/mappings"
          className="text-sm font-bold text-accent"
        >
          S&S mappings →
        </Link>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      <form
        action={createCategoryAction}
        className="border border-border rounded-md p-sp-4 flex flex-wrap gap-3 items-end bg-bg-raised"
      >
        <label className="text-sm font-semibold">
          Name
          <input
            name="name"
            required
            className="block mt-1 border border-border rounded-sm px-3 py-2"
          />
        </label>
        <label className="text-sm font-semibold">
          Slug
          <input
            name="slug"
            required
            placeholder="t-shirts"
            className="block mt-1 border border-border rounded-sm px-3 py-2"
          />
        </label>
        <button
          type="submit"
          className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
        >
          Add category
        </button>
      </form>

      <ol className="space-y-2 m-0 p-0 list-none">
        {categories.map((cat, index) => (
          <li
            key={String(cat.id)}
            className="border border-border rounded-md p-sp-3 flex flex-wrap justify-between gap-3 items-center bg-bg-raised"
          >
            <div>
              <p className="font-semibold m-0">{String(cat.name)}</p>
              <p className="text-xs text-text-tertiary m-0 mt-1">
                /{String(cat.slug)} · sort {String(cat.sortOrder ?? index)}
              </p>
            </div>
            <div className="flex gap-2">
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
                  <button type="submit" className="text-sm font-bold px-2 py-1 border border-border rounded-sm">
                    ↑
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
                  <button type="submit" className="text-sm font-bold px-2 py-1 border border-border rounded-sm">
                    ↓
                  </button>
                </form>
              )}
              <form
                action={async () => {
                  "use server";
                  await deleteCategoryAction(String(cat.id));
                }}
              >
                <button
                  type="submit"
                  className="text-sm font-bold text-red-700 px-2 py-1"
                >
                  Delete
                </button>
              </form>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
