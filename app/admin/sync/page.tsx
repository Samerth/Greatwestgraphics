import {
  runCsvImportAction,
  runSyncAction,
} from "@/app/admin/actions";
import { adminClient, requireAdminToken } from "@/lib/admin/api";

export const dynamic = "force-dynamic";

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
          Sync S&amp;S, Sanmar, or any CSV-based vendor into the shared catalog.
          Each vendor is namespaced so SKUs never collide.
        </p>
      </div>

      {error && (
        <p className="border border-red-200 bg-red-50 text-red-800 rounded-md p-sp-3 m-0">
          {error}
        </p>
      )}

      <section className="space-y-3">
        <h2 className="font-display font-bold text-xl m-0">Vendors</h2>
        {vendors.map((vendor) => (
          <article
            key={vendor.key}
            className="border border-border rounded-md p-sp-3 bg-bg-raised space-y-3"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <div>
                <p className="font-semibold m-0">{vendor.displayName}</p>
                <p className="text-sm text-text-secondary m-0 mt-1">
                  {vendor.key}
                  {vendor.configured ? " · ready" : " · not configured"}
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
                      Full sync
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
                      className="border border-border font-bold px-3 py-1.5 rounded-sm text-sm"
                    >
                      Inventory
                    </button>
                  </form>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="font-display font-bold text-xl m-0">CSV / EDI import</h2>
        <p className="text-sm text-text-secondary m-0">
          Use the canonical GWG CSV headers, or paste Sanmar products.csv +
          skus.csv. For a future file-drop vendor, set a custom vendor key
          (e.g. <code>acme_blanks</code>) so their SKUs stay isolated.
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
                <option value="sanmar">Sanmar (EDI / CSV)</option>
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
                <option value="full">Catalog upsert</option>
                <option value="inventory">Inventory only</option>
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
