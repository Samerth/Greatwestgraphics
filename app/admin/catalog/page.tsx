import Link from "next/link";
import { bulkCatalogVisibilityAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

function vendorLabel(vendor: string) {
  if (vendor === "ss_activewear") return "S&S";
  if (vendor === "sanmar") return "Sanmar";
  return vendor || "—";
}

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    vendor?: string;
    visibility?: string;
    stock?: string;
    categoryId?: string;
    brand?: string;
    sort?: string;
    page?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = sp.q || "";
  const vendor = sp.vendor || "";
  const visibility =
    sp.visibility === "visible" ||
    sp.visibility === "hidden" ||
    sp.visibility === "all"
      ? sp.visibility
      : "all";
  const stock =
    sp.stock === "in" || sp.stock === "oos" || sp.stock === "any"
      ? sp.stock
      : "any";
  const categoryId = sp.categoryId || "";
  const brand = sp.brand || "";
  const sort =
    sp.sort === "style" ||
    sp.sort === "stock" ||
    sp.sort === "updated" ||
    sp.sort === "brand"
      ? sp.sort
      : "brand";
  const page = Math.max(1, Number(sp.page || "1") || 1);
  const offset = (page - 1) * PAGE_SIZE;

  let products: Record<string, unknown>[] = [];
  let total = 0;
  let categories: Record<string, unknown>[] = [];
  let error: string | undefined;

  try {
    const token = requireAdminToken();
    const client = await adminClient();
    const [catalog, cats] = await Promise.all([
      client.listCatalogProducts(
        {
          search: q || undefined,
          vendor: vendor || undefined,
          visibility,
          stock,
          categoryId: categoryId || undefined,
          brands: brand ? [brand] : undefined,
          sort,
          limit: PAGE_SIZE,
          offset,
        },
        token,
      ),
      client.listCategories(token),
    ]);
    products = catalog.products;
    total = catalog.total;
    categories = cats;
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Catalog unavailable";
  }

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const brands = [
    ...new Set(
      products
        .map((row) => String(row.brandName || "").trim())
        .filter(Boolean),
    ),
  ].sort();

  function hrefFor(next: Record<string, string | undefined>) {
    const params = new URLSearchParams();
    const merged = {
      q,
      vendor,
      visibility,
      stock,
      categoryId,
      brand,
      sort,
      page: String(page),
      ...next,
    };
    for (const [key, value] of Object.entries(merged)) {
      if (!value || (key === "visibility" && value === "all")) continue;
      if (key === "stock" && value === "any") continue;
      if (key === "sort" && value === "brand") continue;
      if (key === "page" && value === "1") continue;
      params.set(key, value);
    }
    const qs = params.toString();
    return `/admin/catalog${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-sp-4 max-w-6xl">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
            Multi-vendor
          </p>
          <h1 className="font-display font-bold text-3xl m-0">Catalog</h1>
          <p className="text-sm text-text-secondary mt-1 mb-0">
            Soft-hide colorways from the storefront without breaking vendor sync.
          </p>
        </div>
      </div>

      <form className="border border-border rounded-md p-sp-3 bg-bg-raised grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-semibold sm:col-span-2">
          Search
          <input
            name="q"
            defaultValue={q}
            placeholder="Brand, style, color, SKU…"
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Vendor
          <select
            name="vendor"
            defaultValue={vendor}
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
          >
            <option value="">All vendors</option>
            <option value="ss_activewear">S&amp;S</option>
            <option value="sanmar">Sanmar</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Visibility
          <select
            name="visibility"
            defaultValue={visibility}
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
          >
            <option value="all">All</option>
            <option value="visible">Visible on storefront</option>
            <option value="hidden">Hidden</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Stock
          <select
            name="stock"
            defaultValue={stock}
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
          >
            <option value="any">Any</option>
            <option value="in">In stock</option>
            <option value="oos">Out of stock</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Category
          <select
            name="categoryId"
            defaultValue={categoryId}
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
          >
            <option value="">All categories</option>
            {categories.map((cat) => (
              <option key={String(cat.id)} value={String(cat.id)}>
                {String(cat.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Brand
          <input
            name="brand"
            defaultValue={brand}
            list="catalog-brands"
            placeholder="Brand name"
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
          />
          <datalist id="catalog-brands">
            {brands.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
        </label>
        <label className="text-sm font-semibold">
          Sort
          <select
            name="sort"
            defaultValue={sort}
            className="block mt-1 w-full border border-border rounded-sm px-3 py-2 text-sm font-normal"
          >
            <option value="brand">Brand</option>
            <option value="style">Style</option>
            <option value="stock">Stock</option>
            <option value="updated">Recently updated</option>
          </select>
        </label>
        <div className="flex items-end">
          <button
            type="submit"
            className="bg-accent text-white font-bold px-4 py-2 rounded-sm text-sm"
          >
            Apply filters
          </button>
        </div>
      </form>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {!error && products.length === 0 && (
        <p className="border border-border rounded-md p-sp-4 text-text-secondary m-0">
          No products match. Run a sync from{" "}
          <Link href="/admin/sync" className="text-accent font-bold">
            Sync
          </Link>{" "}
          or clear filters.
        </p>
      )}

      {!error && products.length > 0 && (
        <form action={bulkCatalogVisibilityAction} className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-secondary m-0">
              {total.toLocaleString()} product{total === 1 ? "" : "s"}
              {pageCount > 1 ? ` · page ${page} of ${pageCount}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                name="storefrontVisible"
                value="false"
                className="border border-border rounded-sm px-3 py-1.5 text-sm font-bold"
              >
                Hide selected
              </button>
              <button
                type="submit"
                name="storefrontVisible"
                value="true"
                className="bg-accent text-white font-bold px-3 py-1.5 rounded-sm text-sm"
              >
                Unhide selected
              </button>
            </div>
          </div>

          <div className="overflow-x-auto border border-border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-bg-raised text-left">
                <tr>
                  <th className="p-3 w-10">
                    <span className="sr-only">Select</span>
                  </th>
                  <th className="p-3">Product</th>
                  <th className="p-3">Vendor</th>
                  <th className="p-3">Color</th>
                  <th className="p-3">Cost</th>
                  <th className="p-3">Retail</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">Storefront</th>
                </tr>
              </thead>
              <tbody>
                {products.map((row) => {
                  const id = String(row.id);
                  const available = Boolean(row.available);
                  const visible = row.storefrontVisible !== false;
                  return (
                    <tr key={id} className="border-t border-border">
                      <td className="p-3">
                        <input type="checkbox" name="productIds" value={id} />
                      </td>
                      <td className="p-3">
                        <Link
                          href={`/admin/catalog/${id}`}
                          className="font-semibold text-accent"
                        >
                          {String(row.brandName || "")}{" "}
                          {String(row.styleName || row.title || "")}
                        </Link>
                        <p className="text-xs text-text-tertiary m-0 mt-0.5">
                          {String(row.externalKey || row.partNumber || "")}
                        </p>
                      </td>
                      <td className="p-3">
                        <span className="inline-block text-xs font-bold uppercase tracking-wide border border-border rounded-sm px-1.5 py-0.5">
                          {vendorLabel(String(row.vendor || ""))}
                        </span>
                      </td>
                      <td className="p-3">{String(row.colorName || "")}</td>
                      <td className="p-3">
                        {moneyFromMinor(Number(row.costMinor || 0))}
                      </td>
                      <td className="p-3">
                        {moneyFromMinor(Number(row.retailMinor || 0))}
                      </td>
                      <td className="p-3">
                        {available ? (
                          <span className="text-green-700 font-semibold">
                            {String(row.qty ?? 0)}
                          </span>
                        ) : (
                          <span className="text-amber-700 font-semibold">
                            OOS
                          </span>
                        )}
                      </td>
                      <td className="p-3">
                        {visible ? (
                          <span className="text-green-700 font-semibold text-xs">
                            Visible
                          </span>
                        ) : (
                          <span className="text-red-700 font-semibold text-xs">
                            Hidden
                          </span>
                        )}
                        {row.active === false ? (
                          <span className="text-xs text-text-tertiary">
                            {" "}
                            · discontinued
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </form>
      )}

      {pageCount > 1 && (
        <div className="flex flex-wrap gap-3 items-center">
          {page > 1 ? (
            <Link
              href={hrefFor({ page: String(page - 1) })}
              className="text-sm font-bold text-accent"
            >
              ← Previous
            </Link>
          ) : (
            <span className="text-sm text-text-tertiary">← Previous</span>
          )}
          <span className="text-sm text-text-secondary">
            Page {page} / {pageCount}
          </span>
          {page < pageCount ? (
            <Link
              href={hrefFor({ page: String(page + 1) })}
              className="text-sm font-bold text-accent"
            >
              Next →
            </Link>
          ) : (
            <span className="text-sm text-text-tertiary">Next →</span>
          )}
        </div>
      )}
    </div>
  );
}
