"use client";

import { useActionState } from "react";
import { runCsvImportAction, type CsvImportState } from "@/app/admin/actions";
import { AdminPendingSubmit } from "@/components/admin/AdminPendingSubmit";

const initialState: CsvImportState = {};

export function CsvImportForm() {
  const [state, formAction] = useActionState(runCsvImportAction, initialState);

  return (
    <form action={formAction} className="space-y-3 border border-border rounded-md p-sp-3 bg-bg-raised">
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
      <AdminPendingSubmit
        idleLabel="Import CSV"
        pendingLabel="Importing…"
        className="bg-accent text-white font-bold px-4 py-2 rounded-sm disabled:opacity-60"
      />
      {state.error && (
        <p role="alert" className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0">
          {state.error}
        </p>
      )}
      {!state.error && state.savedAt && (
        <p className="text-sm text-green-800 bg-green-50 border border-green-200 rounded-sm px-3 py-2 m-0">
          CSV import started. Check Recent runs below for progress.
        </p>
      )}
    </form>
  );
}