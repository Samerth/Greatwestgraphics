import {
  runCsvImportAction,
  runSyncAction,
} from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

function vendorGuidance(key: string): {
  fullWhen: string;
  stockWhen: string;
  fullLabel: string;
  stockLabel: string;
} {
  if (key === "sanmar") {
    return {
      fullLabel: "Full sync",
      stockLabel: "Update stock & price",
      fullWhen:
        "Use once when first connecting SanMar, or after SanMar adds many new styles. Imports the sellable catalog, then refreshes stock and cost. Can take several minutes.",
      stockWhen:
        "Use daily (or when prices/stock look wrong). Refreshes qty and CUSTOMER cost only — does not re-import the whole catalog. SanMar Bulk Data is limited to about 1 call per day.",
    };
  }
  if (key === "ss_activewear") {
    return {
      fullLabel: "Full sync",
      stockLabel: "Update stock & price",
      fullWhen:
        "Use for a full S&S catalog refresh (styles, colours, sizes). Prefer when products are missing or look stale.",
      stockWhen:
        "Use for a quicker stock/price pass when the catalog already looks complete.",
    };
  }
  return {
    fullLabel: "Full sync",
    stockLabel: "Update stock & price",
    fullWhen: "Import or refresh this vendor’s full catalog.",
    stockWhen: "Refresh stock and price without a full re-import.",
  };
}

export default async function AdminSyncPage() {
  let runs: Record<string, unknown>[] = [];
  let vendors: Array<{
    key: string;
    displayName: string;
    capabilities: {
      fullSync: boolean;
      inventorySync: boolean;
      csvImport: boolean;
    };
    configured: boolean;
    notes?: string;
  }> = [];
  let error: string | undefined;
  try {
    const client = await adminClient();
    const token = requireAdminToken();
    [runs, vendors] = await Promise.all([
      client.listSyncRuns(token),
      client.listCatalogVendors(token),
    ]);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Sync history unavailable";
  }

  return (
    <div className="space-y-sp-4 max-w-4xl">
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-accent m-0">
          Multi-vendor
        </p>
        <h1 className="font-display font-bold text-3xl m-0">Catalog sync</h1>
        <p className="text-text-secondary mt-2 mb-0">
          Staff-only tools to pull blank goods from vendors into the shared
          catalog. Shoppers never see this page — they only see products after
          you sync and (optionally) hide colourways in Catalog.
        </p>
      </div>

      <section className="border border-border rounded-md p-sp-3 bg-bg-raised space-y-2">
        <h2 className="font-display font-bold text-lg m-0">How to update the catalog</h2>
        <ol className="text-sm text-text-secondary m-0 list-decimal list-inside space-y-2">
          <li>
            <b>First time / big catalog changes</b> — click{" "}
            <b>Full sync</b> on the vendor below. Wait for a completed run in
            Recent runs.
          </li>
          <li>
            <b>Day-to-day</b> — click <b>Update stock &amp; price</b> so
            storefront qty and cost stay current without re-downloading every
            style.
          </li>
          <li>
            <b>After a good run</b> — open{" "}
            <a href="/admin/catalog" className="text-accent font-bold">
              Catalog
            </a>
            , filter by vendor, and confirm stock/cost look right. Soft-hide
            anything you do not want on the storefront.
          </li>
        </ol>
        <p className="text-sm text-text-secondary m-0 pt-1">
          Quick check after sync: SanMar rows should no longer be all{" "}
          <b>OOS / $0.00</b>. If they are, re-run <b>Update stock &amp; price</b>{" "}
          and check Recent runs for errors.
        </p>
      </section>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-display font-bold text-xl m-0">Vendors</h2>
        {vendors.map((vendor) => {
          const guidance = vendorGuidance(vendor.key);
          return (
            <article
              key={vendor.key}
              className="border border-border rounded-md p-sp-3 bg-bg-raised space-y-3"
            >
              <div className="flex flex-wrap justify-between gap-2">
                <div>
                  <p className="font-semibold m-0">{vendor.displayName}</p>
                  <p className="text-sm text-text-secondary m-0 mt-1">
                    {vendor.configured ? "Ready to sync" : "Not configured"}
                    {vendor.notes ? ` · ${vendor.notes}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {vendor.capabilities.fullSync && (
                    <form
                      action={async () => {
                        "use server";
                        await runSyncAction("full", vendor.key);
                      }}
                    >
                      <button
                        type="submit"
                        className="bg-accent text-white font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-50"
                        disabled={!vendor.configured && vendor.key !== "csv"}
                      >
                        {guidance.fullLabel}
                      </button>
                    </form>
                  )}
                  {vendor.capabilities.inventorySync && (
                    <form
                      action={async () => {
                        "use server";
                        await runSyncAction("inventory", vendor.key);
                      }}
                    >
                      <button
                        type="submit"
                        className="border border-border font-bold px-3 py-1.5 rounded-sm text-sm disabled:opacity-50"
                        disabled={!vendor.configured && vendor.key !== "csv"}
                      >
                        {guidance.stockLabel}
                      </button>
                    </form>
                  )}
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2 text-sm text-text-secondary">
                {vendor.capabilities.fullSync && (
                  <p className="m-0">
                    <span className="font-semibold text-text-primary">
                      {guidance.fullLabel}:
                    </span>{" "}
                    {guidance.fullWhen}
                  </p>
                )}
                {vendor.capabilities.inventorySync && (
                  <p className="m-0">
                    <span className="font-semibold text-text-primary">
                      {guidance.stockLabel}:
                    </span>{" "}
                    {guidance.stockWhen}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-bold text-xl m-0">
          CSV fallback (optional)
        </h2>
        <p className="text-sm text-text-secondary m-0">
          Only needed when live API sync is unavailable or you have a vendor
          file drop. Prefer the vendor buttons above for SanMar and S&amp;S.
          Paste a GWG canonical CSV, or SanMar <code>products.csv</code> +{" "}
          <code>skus.csv</code>. Use a custom vendor key (e.g.{" "}
          <code>acme_blanks</code>) so a future partner stays namespaced.
        </p>
        <form action={runCsvImportAction} className="space-y-3 border border-border rounded-md p-sp-3 bg-bg-raised">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="text-sm block">
              <span className="font-semibold">Vendor</span>
              <select
                name="vendor"
                defaultValue="csv"
                className="mt-1 w-full border border-border rounded-sm px-2 py-1.5 bg-white"
              >
                <option value="csv">Generic CSV</option>
                <option value="sanmar">Sanmar (file paste)</option>
              </select>
            </label>
            <label className="text-sm block">
              <span className="font-semibold">Custom vendor key</span>
              <input
                name="vendorKey"
                placeholder="optional, e.g. acme_blanks"
                className="mt-1 w-full border border-border rounded-sm px-2 py-1.5"
              />
            </label>
            <label className="text-sm block">
              <span className="font-semibold">Mode</span>
              <select
                name="mode"
                defaultValue="full"
                className="mt-1 w-full border border-border rounded-sm px-2 py-1.5 bg-white"
              >
                <option value="full">Full catalog from CSV</option>
                <option value="inventory">Stock &amp; price from CSV only</option>
              </select>
            </label>
          </div>
          <label className="text-sm block">
            <span className="font-semibold">Canonical CSV (or inventory CSV)</span>
            <textarea
              name="csvContent"
              rows={6}
              placeholder="style_key,brand_name,style_name,color_name,size_name,sku_key,sku,qty,price"
              className="mt-1 w-full border border-border rounded-sm px-2 py-1.5 font-mono text-xs"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm block">
              <span className="font-semibold">Sanmar products.csv (optional)</span>
              <textarea
                name="csvProducts"
                rows={4}
                placeholder="productId,productName,brandName,category,price,imageUrl"
                className="mt-1 w-full border border-border rounded-sm px-2 py-1.5 font-mono text-xs"
              />
            </label>
            <label className="text-sm block">
              <span className="font-semibold">Sanmar skus.csv (optional)</span>
              <textarea
                name="csvSkus"
                rows={4}
                placeholder="skuId,productId,sku,colorName,sizeName,quantity,price,imageUrl"
                className="mt-1 w-full border border-border rounded-sm px-2 py-1.5 font-mono text-xs"
              />
            </label>
          </div>
          <button
            type="submit"
            className="bg-accent text-white font-bold px-4 py-2 rounded-sm"
          >
            Import CSV
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="font-display font-bold text-xl m-0">Recent runs</h2>
        <p className="text-sm text-text-secondary m-0">
          Wait for <b>completed</b> (or read errors if{" "}
          <b>completed_with_errors</b>). Then verify results in{" "}
          <a href="/admin/catalog" className="text-accent font-bold">
            Catalog
          </a>
          .
        </p>
        {runs.length === 0 && (
          <p className="text-sm text-text-secondary m-0">No runs logged yet.</p>
        )}
        {runs.map((run) => (
          <article
            key={String(run.id)}
            className="border border-border rounded-md p-sp-3 text-sm bg-bg-raised"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <p className="font-semibold m-0">
                {run.vendor ? `${String(run.vendor)} · ` : ""}
                {String(run.type)} · {String(run.status)}
              </p>
              <p className="text-text-tertiary m-0">
                {run.startedAt
                  ? new Date(String(run.startedAt)).toLocaleString("en-CA")
                  : ""}
              </p>
            </div>
            <p className="mt-2 mb-0 text-text-secondary">
              styles {String(run.stylesProcessed ?? "—")} · skus{" "}
              {String(run.skusUpserted ?? "—")} · images{" "}
              {String(run.imagesDownloaded ?? "—")}
              {run.rateLimitRemaining != null
                ? ` · rate-limit ${String(run.rateLimitRemaining)}`
                : ""}
            </p>
            {run.errorSummary ? (
              <pre className="mt-2 mb-0 text-xs whitespace-pre-wrap text-red-800">
                {typeof run.errorSummary === "string"
                  ? run.errorSummary
                  : JSON.stringify(run.errorSummary, null, 2)}
              </pre>
            ) : null}
          </article>
        ))}
      </section>
    </div>
  );
}
