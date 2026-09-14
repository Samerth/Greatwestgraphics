"use client";

import { useActionState, useState } from "react";
import { runCsvImportAction, type CsvImportState } from "@/app/admin/actions";
import { AdminPendingSubmit } from "@/components/admin/AdminPendingSubmit";
import { CsvFileField } from "@/components/admin/CsvFileField";
import { CsvFormatHelp } from "@/components/admin/CsvFormatHelp";
import {
  CATALOG_EXAMPLE_CSV,
  INVENTORY_EXAMPLE_CSV,
  SANMAR_PRODUCTS_EXAMPLE_CSV,
  SANMAR_SKUS_EXAMPLE_CSV,
} from "@/lib/admin/csv-template";

const initialState: CsvImportState = {};

export function CsvImportForm() {
  const [state, formAction] = useActionState(runCsvImportAction, initialState);
  // Held here so a file picked on disk and text typed by hand end up in the
  // same place — the server action still receives one string per field and
  // has not changed at all.
  const [csvContent, setCsvContent] = useState("");
  const [csvProducts, setCsvProducts] = useState("");
  const [csvSkus, setCsvSkus] = useState("");

  return (
    <form
      action={formAction}
      className="space-y-3 border border-border rounded-md p-sp-3 bg-bg-raised"
    >
      <CsvFormatHelp
        onLoadCatalogExample={() => setCsvContent(CATALOG_EXAMPLE_CSV)}
        onLoadInventoryExample={() => setCsvContent(INVENTORY_EXAMPLE_CSV)}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm block">
          <span className="font-semibold">Vendor</span>
          <select
            name="vendor"
            defaultValue="csv"
            className="mt-1 w-full border border-border rounded-sm px-2 py-1.5 bg-white"
          >
            <option value="csv">Generic CSV</option>
            <option value="sanmar">Sanmar (products + skus pair)</option>
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

      <CsvFileField
        name="csvContent"
        label="Canonical CSV (or inventory CSV)"
        placeholder="style_key,brand_name,style_name,color_name,size_name,sku_key,sku,qty,price"
        value={csvContent}
        onChange={setCsvContent}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <CsvFileField
          name="csvProducts"
          label="Sanmar products.csv (optional)"
          placeholder={SANMAR_PRODUCTS_EXAMPLE_CSV}
          rows={4}
          value={csvProducts}
          onChange={setCsvProducts}
        />
        <CsvFileField
          name="csvSkus"
          label="Sanmar skus.csv (optional)"
          placeholder={SANMAR_SKUS_EXAMPLE_CSV}
          rows={4}
          value={csvSkus}
          onChange={setCsvSkus}
        />
      </div>

      <AdminPendingSubmit
        idleLabel="Import CSV"
        pendingLabel="Importing…"
        className="bg-accent text-white font-bold px-4 py-2 rounded-sm disabled:opacity-60"
      />
      {state.error && (
        <p
          role="alert"
          className="text-sm text-red-800 bg-red-50 border border-red-200 rounded-sm px-3 py-2 m-0"
        >
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
