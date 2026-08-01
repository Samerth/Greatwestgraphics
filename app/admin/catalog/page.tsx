import Link from "next/link";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export const dynamic = "force-dynamic";

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  let products: Record<string, unknown>[] = [];
  let error: string | undefined;
  try {
    ({ products } = await (await adminClient()).listCatalogProducts(
      { search: q, limit: 100 },
      requireAdminToken(),
    ));
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Catalog unavailable";
  }

  return (
    <div className="space-y-sp-4 max-w-6xl">
      <div className="flex flex-wrap justify-between gap-3 items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
            S&S Activewear
          </p>
          <h1 className="font-display font-bold text-3xl m-0">Catalog</h1>
        </div>
        <form className="flex gap-2">
          <input
            name="q"
            defaultValue={q || ""}
            placeholder="Search brand, style, color…"
            className="border border-border rounded-sm px-3 py-2 text-sm min-w-[240px]"
          />
          <button
            type="submit"
            className="bg-accent text-white font-bold px-4 py-2 rounded-sm text-sm"
          >
            Search
          </button>
        </form>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      {!error && products.length === 0 && (
        <p className="border border-border rounded-md p-sp-4 text-text-secondary m-0">
          No products yet. Run a sync from{" "}
          <Link href="/admin/sync" className="text-accent font-bold">
            Sync
          </Link>
          .
        </p>
      )}

      <div className="overflow-x-auto border border-border rounded-md">
        <table className="w-full text-sm">
          <thead className="bg-bg-raised text-left">
            <tr>
              <th className="p-3">Product</th>
              <th className="p-3">Color</th>
              <th className="p-3">Cost</th>
              <th className="p-3">Retail</th>
              <th className="p-3">Stock</th>
              <th className="p-3">Flags</th>
            </tr>
          </thead>
          <tbody>
            {products.map((row) => {
              const id = String(row.id);
              const available = Boolean(row.available);
              return (
                <tr key={id} className="border-t border-border">
                  <td className="p-3">
                    <Link
                      href={`/admin/catalog/${id}`}
                      className="font-semibold text-accent"
                    >
                      {String(row.brandName || "")}{" "}
                      {String(row.styleName || row.title || "")}
                    </Link>
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
                        Unavailable
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-xs">
                    {row.isDark ? "dark" : "light"}
                    {!row.active ? " · inactive" : ""}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
