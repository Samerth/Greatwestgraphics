"use client";

import { useState } from "react";
import {
  CATALOG_COLUMNS,
  CATALOG_EXAMPLE_CSV,
  CSV_IMPORT_RULES,
  INVENTORY_COLUMNS,
  INVENTORY_EXAMPLE_CSV,
  type CsvColumnSpec,
} from "@/lib/admin/csv-template";

/**
 * The format reference, sitting next to the boxes it describes.
 *
 * Written for whoever runs this after handover rather than for whoever built
 * it: what must be present, what is optional, what the importer quietly
 * assumes, and a working example that can be loaded into the box with one
 * click and edited.
 */
export function CsvFormatHelp({
  onLoadCatalogExample,
  onLoadInventoryExample,
}: {
  onLoadCatalogExample: () => void;
  onLoadInventoryExample: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div
      data-admin="csv-format-help"
      className="border border-border rounded-md bg-bg"
    >
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-3 px-sp-3 py-2.5 text-left"
      >
        <span className="text-sm font-bold">
          CSV format — what the columns need to be
        </span>
        <span className="text-xs font-semibold text-text-tertiary">
          {open ? "Hide" : "Show"}
        </span>
      </button>

      {open && (
        <div className="border-t border-border px-sp-3 py-sp-3 space-y-sp-3">
          <section>
            <h3 className="m-0 mb-1 text-sm font-bold">
              Only two columns are compulsory
            </h3>
            <p className="m-0 mb-2 text-sm text-text-secondary">
              <code className="font-mono">style_key</code> and{" "}
              <code className="font-mono">sku_key</code>. Everything else is
              optional and falls back to a sensible default. A row missing
              either one is skipped without an error, so always check the row
              count on the run afterwards.
            </p>
          </section>

          <section>
            <h3 className="m-0 mb-1 text-sm font-bold">Worth knowing</h3>
            <ul className="m-0 pl-5 text-sm text-text-secondary space-y-1">
              {CSV_IMPORT_RULES.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </section>

          <ExampleBlock
            title="Full catalogue — example"
            body={CATALOG_EXAMPLE_CSV}
            onLoad={onLoadCatalogExample}
            caption="One style, two colours, three sizes. Notice style_key repeats — that is what groups them into a single product."
          />

          <ColumnTable title="Full catalogue columns" columns={CATALOG_COLUMNS} />

          <ExampleBlock
            title="Stock &amp; price only — example"
            body={INVENTORY_EXAMPLE_CSV}
            onLoad={onLoadInventoryExample}
            caption="Used with Mode set to “Stock & price from CSV only”. Updates existing SKUs; it does not create products."
          />

          <ColumnTable title="Stock & price columns" columns={INVENTORY_COLUMNS} />
        </div>
      )}
    </div>
  );
}

function ExampleBlock({
  title,
  body,
  caption,
  onLoad,
}: {
  title: string;
  body: string;
  caption: string;
  onLoad: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2_000);
    } catch {
      // Clipboard access can be refused (insecure origin, or the user has
      // blocked it). The example is on screen and selectable either way, so
      // there is nothing useful to report here.
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
        <h3 className="m-0 text-sm font-bold">{title}</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onLoad}
            className="rounded-sm border border-accent px-2.5 py-1 text-xs font-bold text-accent hover:bg-accent hover:text-white transition-colors"
          >
            Load into the box
          </button>
          <button
            type="button"
            onClick={() => void copy()}
            className="rounded-sm border border-border px-2.5 py-1 text-xs font-bold hover:border-accent hover:text-accent transition-colors"
          >
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>
      <pre className="m-0 overflow-x-auto rounded-sm border border-border bg-bg-raised p-2.5 font-mono text-[11px] leading-relaxed">
        {body}
      </pre>
      <p className="mt-1 mb-0 text-xs text-text-tertiary">{caption}</p>
    </section>
  );
}

function ColumnTable({
  title,
  columns,
}: {
  title: string;
  columns: CsvColumnSpec[];
}) {
  return (
    <section>
      <h3 className="m-0 mb-1 text-sm font-bold">{title}</h3>
      <div className="overflow-x-auto border border-border rounded-sm">
        <table className="w-full min-w-[520px] border-collapse text-xs">
          <thead>
            <tr className="bg-bg-raised">
              <th className="text-left font-semibold px-2.5 py-1.5 border-b border-border">
                Column
              </th>
              <th className="text-left font-semibold px-2.5 py-1.5 border-b border-border">
                Also accepted as
              </th>
              <th className="text-left font-semibold px-2.5 py-1.5 border-b border-border">
                What it does
              </th>
            </tr>
          </thead>
          <tbody>
            {columns.map((column) => (
              <tr key={column.name}>
                <td className="px-2.5 py-1.5 border-b border-border align-top font-mono whitespace-nowrap">
                  {column.name}
                  {column.required && (
                    <span className="ml-1.5 rounded-sm bg-accent px-1 py-0.5 text-[9px] font-bold uppercase text-white">
                      Required
                    </span>
                  )}
                </td>
                <td className="px-2.5 py-1.5 border-b border-border align-top font-mono text-text-tertiary">
                  {column.aliases?.join(", ") ?? "—"}
                </td>
                <td className="px-2.5 py-1.5 border-b border-border align-top text-text-secondary">
                  {column.note}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
