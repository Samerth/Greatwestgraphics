import Link from "next/link";
import { refreshCatalogProductAction } from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";
import { moneyFromMinor } from "@/lib/utils/quote-pricing";
import { ProductSettingsForm } from "@/components/admin/ProductSettingsForm";

export const dynamic = "force-dynamic";

function vendorLabel(vendor: string) {
  if (vendor === "ss_activewear") return "S&S Activewear";
  if (vendor === "sanmar") return "Sanmar / ATC";
  return vendor || "Unknown vendor";
}

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
  const colorways = (detail.colorways as Record<string, unknown>[]) || [];
  const assigned = (detail.categories as Record<string, unknown>[]) || [];
  const assignedIds = new Set(assigned.map((c) => String(c.id)));
  const vendor = String(product.vendor || "");
  const canRefresh = vendor === "sanmar" || vendor === "ss_activewear";
  const media = [
    { label: "Front", url: product.colorFrontImageUrl as string | null },
    { label: "Side", url: product.colorSideImageUrl as string | null },
    { label: "Back", url: product.colorBackImageUrl as string | null },
    { label: "Swatch", url: product.colorSwatchImageUrl as string | null },
  ].filter((m) => m.url);

  return (
    <div className="space-y-sp-4 max-w-4xl">
      <Link href="/admin/catalog" className="text-sm font-bold text-accent">
        ← Catalog
      </Link>

      <div className="flex flex-wrap justify-between gap-3 items-start">
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
            {vendorLabel(vendor)}
          </p>
          <h1 className="font-display font-bold text-3xl m-0">
            {String(style.brandName || "")} {String(style.styleName || "")}
          </h1>
          <p className="text-text-secondary mt-1 mb-0">
            {String(product.colorName || "")} · {String(product.slug || "")}
          </p>
          <p className="text-xs text-text-tertiary mt-1 mb-0">
            Style key:{" "}
            {String(style.externalKey || style.styleId || "—")}
            {style.partNumber
              ? ` · part ${String(style.partNumber)}`
              : ""}
          </p>
        </div>
        {canRefresh && (
          <form
            action={async () => {
              "use server";
              await refreshCatalogProductAction(id);
            }}
          >
            <button
              type="submit"
              className="border border-border rounded-sm px-3 py-2 text-sm font-bold"
            >
              Refresh from vendor
            </button>
          </form>
        )}
      </div>

      <ProductSettingsForm
        productId={id}
        storefrontVisible={product.storefrontVisible !== false}
        isDark={Boolean(product.isDark)}
        active={product.active !== false}
        categories={categories}
        assignedIds={assignedIds}
      />

      <section>
        <h2 className="font-display font-bold text-lg m-0 mb-2">Colorways</h2>
        <ul className="m-0 p-0 list-none space-y-2">
          {colorways.map((cw) => {
            const cwId = String(cw.id);
            const isCurrent = cwId === id;
            const visible = cw.storefrontVisible !== false;
            return (
              <li
                key={cwId}
                className="border border-border rounded-md px-3 py-2 flex flex-wrap justify-between gap-2 items-center"
              >
                {isCurrent ? (
                  <span className="font-semibold">
                    {String(cw.colorName || "")} (this)
                  </span>
                ) : (
                  <Link
                    href={`/admin/catalog/${cwId}`}
                    className="font-semibold text-accent"
                  >
                    {String(cw.colorName || "")}
                  </Link>
                )}
                <span
                  className={
                    visible
                      ? "text-xs font-bold text-green-700"
                      : "text-xs font-bold text-red-700"
                  }
                >
                  {visible ? "Visible" : "Hidden"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {media.length > 0 && (
        <section>
          <h2 className="font-display font-bold text-lg m-0 mb-2">Media</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {media.map((item) => (
              <div
                key={item.label}
                className="border border-border rounded-md p-3 space-y-2"
              >
                <p className="text-sm font-semibold m-0">{item.label}</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.url!}
                  alt={`${item.label} image`}
                  className="max-h-40 object-contain bg-bg-raised w-full"
                />
                <a
                  href={item.url!}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-accent break-all"
                >
                  {item.url}
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

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
