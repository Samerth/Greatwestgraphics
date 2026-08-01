import Link from "next/link";
import { patchProductAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";

export const dynamic = "force-dynamic";

export default async function AdminCatalogProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const token = requireAdminToken();
  let error: string | undefined;
  let detail: Record<string, unknown> | null = null;
  let categories: Record<string, unknown>[] = [];

  try {
    [detail, categories] = await Promise.all([
      (await adminClient()).getCatalogProduct(id, token),
      (await adminClient()).listCategories(token),
    ]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Product unavailable";
  }

  if (error || !detail) {
    return (
      <div>
        <Link href="/admin/catalog" className="text-sm font-bold text-accent">
          ← Catalog
        </Link>
        <p className="mt-3 border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3">
          {error || "Not found"}
        </p>
      </div>
    );
  }

  const product = detail.product as Record<string, unknown>;
  const style = detail.style as Record<string, unknown>;
  const variants = (detail.variants as Record<string, unknown>[]) || [];
  const assigned = (detail.categories as Record<string, unknown>[]) || [];
  const assignedIds = new Set(assigned.map((c) => String(c.id)));

  return (
    <div className="space-y-sp-4 max-w-4xl">
      <Link href="/admin/catalog" className="text-sm font-bold text-accent">
        ← Catalog
      </Link>
      <div>
        <h1 className="font-display font-bold text-3xl m-0">
          {String(style.brandName || "")} {String(style.styleName || "")}
        </h1>
        <p className="text-text-secondary mt-1 mb-0">
          {String(product.colorName || "")} · {String(product.slug || "")}
        </p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          await patchProductAction(id, formData);
        }}
        className="border border-border rounded-md p-sp-4 space-y-sp-3 bg-bg-raised"
      >
        <h2 className="font-display font-bold text-lg m-0">Overrides</h2>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="active"
            defaultChecked={Boolean(product.active)}
          />
          Active
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            name="isDark"
            defaultChecked={Boolean(product.isDark)}
          />
          Dark garment (pricing premium)
        </label>
        <fieldset>
          <legend className="text-sm font-semibold mb-2">
            Category override (wins over map)
          </legend>
          <div className="grid sm:grid-cols-2 gap-2 max-h-48 overflow-auto">
            {categories.map((cat) => (
              <label
                key={String(cat.id)}
                className="flex items-center gap-2 text-sm"
              >
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={String(cat.id)}
                  defaultChecked={assignedIds.has(String(cat.id))}
                />
                {String(cat.name)}
              </label>
            ))}
          </div>
        </fieldset>
        <button
          type="submit"
          className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
        >
          Save
        </button>
      </form>

      <section>
        <h2 className="font-display font-bold text-lg m-0 mb-2">Sizes</h2>
        <div className="overflow-x-auto border border-border rounded-md">
          <table className="w-full text-sm">
            <thead className="bg-bg-raised text-left">
              <tr>
                <th className="p-2">Size</th>
                <th className="p-2">SKU</th>
                <th className="p-2">Cost</th>
                <th className="p-2">MAP</th>
                <th className="p-2">Retail</th>
                <th className="p-2">Qty</th>
              </tr>
            </thead>
            <tbody>
              {variants.map((v) => (
                <tr key={String(v.id)} className="border-t border-border">
                  <td className="p-2">{String(v.sizeName || "")}</td>
                  <td className="p-2 font-mono text-xs">{String(v.sku || "")}</td>
                  <td className="p-2">
                    {moneyFromMinor(Number(v.customerPriceMinor || 0))}
                  </td>
                  <td className="p-2">
                    {v.mapPriceMinor != null
                      ? moneyFromMinor(Number(v.mapPriceMinor))
                      : "—"}
                  </td>
                  <td className="p-2">
                    {moneyFromMinor(Number(v.retailMinor || 0))}
                  </td>
                  <td className="p-2">
                    {Number(v.qty || 0) > 0 && v.active !== false ? (
                      String(v.qty)
                    ) : (
                      <span className="text-amber-700 font-semibold">
                        Unavailable
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
