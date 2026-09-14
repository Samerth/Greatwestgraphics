import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  MAX_CSV_BYTES,
  checkCsvFile,
  csvHeaderColumns,
  csvRowCount,
  formatBytes,
} from "./csv-file";
import {
  CATALOG_COLUMNS,
  CATALOG_EXAMPLE_CSV,
  CATALOG_REQUIRED_COLUMNS,
  CSV_IMPORT_RULES,
  INVENTORY_COLUMNS,
  INVENTORY_EXAMPLE_CSV,
  requiredColumnSummary,
} from "./csv-template";

const read = (p: string) => readFileSync(resolve(process.cwd(), p), "utf8");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const form = stripComments(read("components/admin/CsvImportForm.tsx"));
const fileField = stripComments(read("components/admin/CsvFileField.tsx"));
const help = stripComments(read("components/admin/CsvFormatHelp.tsx"));

/** The importer itself — the only authority on what a column may be called. */
const parser = read(
  "services/commerce-api/src/adapters/catalog/csv-parser.ts",
);

/**
 * Client call, 10 September: "Add a file upload option alongside the existing
 * paste box, so a .csv file can be selected directly instead of its contents
 * being copied in."
 */
describe("a CSV can be chosen from disk", () => {
  it("offers a file picker on every CSV box", () => {
    expect(fileField).toContain('data-admin="csv-choose-file"');
    // All three inputs go through the same field component.
    expect(form.match(/<CsvFileField/g)).toHaveLength(3);
  });

  it("keeps the paste box, which is still the fastest way to test a few rows", () => {
    expect(fileField).toContain("<textarea");
    expect(form).toContain('name="csvContent"');
    expect(form).toContain('name="csvProducts"');
    expect(form).toContain('name="csvSkus"');
  });

  it("changes nothing about how the import is submitted", () => {
    // The file is read in the browser into the field that already existed, so
    // the server action still receives one string per box.
    expect(form).toContain("runCsvImportAction");
    expect(fileField).toContain("file.text()");
  });
});

describe("a chosen file is checked before it is accepted", () => {
  const csv = "style_key,sku_key\nA,A-1\nA,A-2\n";

  it("accepts a normal file and describes what was loaded", () => {
    const result = checkCsvFile("catalog.csv", csv.length, csv);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.rows).toBe(2);
    expect(result.columns).toEqual(["style_key", "sku_key"]);
    expect(result.summary).toContain("catalog.csv");
    expect(result.summary).toContain("2 rows");
  });

  it("rejects an empty file", () => {
    const result = checkCsvFile("empty.csv", 0, "");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("empty");
  });

  it("rejects a header with no rows under it", () => {
    const result = checkCsvFile("headers.csv", 20, "style_key,sku_key\n");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("no rows");
  });

  it("rejects a file too large to render into the box", () => {
    const result = checkCsvFile("huge.csv", MAX_CSV_BYTES + 1, csv);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toContain("limit");
  });

  it("does not count the trailing blank line a spreadsheet leaves behind", () => {
    // Reporting 3 rows for 2 products makes the admin distrust the import.
    expect(csvRowCount("a,b\n1,2\n3,4\n")).toBe(2);
    expect(csvRowCount("a,b\r\n1,2\r\n")).toBe(1);
  });

  it("reads headers regardless of quoting or spacing", () => {
    expect(csvHeaderColumns(` "style_key" , sku_key ,qty\n`)).toEqual([
      "style_key",
      "sku_key",
      "qty",
    ]);
  });

  it("reports sizes in units a person reads", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 * 1024)).toBe("3.0 MB");
  });
});

/**
 * The format guide added alongside it, so whoever runs this after handover
 * knows what the columns have to be.
 */
describe("the format guide is shown where the importing happens", () => {
  it("is on the import form", () => {
    expect(form).toContain("CsvFormatHelp");
    expect(help).toContain('data-admin="csv-format-help"');
  });

  it("leads with the two columns that actually matter", () => {
    expect(requiredColumnSummary(CATALOG_COLUMNS)).toBe("style_key and sku_key");
    expect(help).toContain("Only two columns are compulsory");
  });

  it("can load a working example straight into the box", () => {
    expect(form).toContain("CATALOG_EXAMPLE_CSV");
    expect(form).toContain("INVENTORY_EXAMPLE_CSV");
    expect(help).toContain("Load into the box");
  });

  it("warns that a bad row is skipped rather than reported", () => {
    // The single most confusing behaviour of this importer.
    expect(help).toContain("CSV_IMPORT_RULES");
    expect(CSV_IMPORT_RULES.join(" ")).toMatch(/skipped silently/);
  });

  it("tells the operator column order does not matter", () => {
    expect(CSV_IMPORT_RULES.join(" ")).toMatch(/order does not matter/i);
  });
});

describe("the examples in the guide are actually importable", () => {
  it("carries both required columns in the catalogue example", () => {
    const columns = csvHeaderColumns(CATALOG_EXAMPLE_CSV);
    for (const required of CATALOG_REQUIRED_COLUMNS) {
      expect(columns).toContain(required);
    }
  });

  it("gives every example row the same column count as its header", () => {
    for (const example of [CATALOG_EXAMPLE_CSV, INVENTORY_EXAMPLE_CSV]) {
      const [header, ...rows] = example.split(/\r?\n/).filter(Boolean);
      const width = header!.split(",").length;
      for (const row of rows) {
        expect(row.split(",")).toHaveLength(width);
      }
    }
  });

  it("shows one style repeated across colours and sizes", () => {
    // This is the bit people get wrong: style_key groups the rows.
    const rows = CATALOG_EXAMPLE_CSV.split(/\r?\n/).slice(1);
    expect(rows).toHaveLength(3);
    expect(rows.every((row) => row.startsWith("GWGT100,"))).toBe(true);
    expect(new Set(rows.map((row) => row.split(",")[5])).size).toBe(3);
  });
});

/**
 * The guide is only worth having if it stays true. Every column and alias it
 * documents is checked against the importer's own source.
 */
describe("the guide has not drifted from the importer", () => {
  it("documents only columns the parser actually reads", () => {
    for (const column of [...CATALOG_COLUMNS, ...INVENTORY_COLUMNS]) {
      expect(
        parser.includes(`"${column.name}"`),
        `parser has no column "${column.name}"`,
      ).toBe(true);
    }
  });

  it("documents only aliases the parser actually accepts", () => {
    for (const column of [...CATALOG_COLUMNS, ...INVENTORY_COLUMNS]) {
      for (const alias of column.aliases ?? []) {
        const bare = alias.replace(/_/g, "");
        expect(
          parser.includes(`${alias}:`) || parser.includes(`${bare}:`),
          `parser has no alias "${alias}"`,
        ).toBe(true);
      }
    }
  });

  it("still describes style_key and sku_key as the two required columns", () => {
    // If the parser's guard changes, this guide is lying to the operator.
    expect(parser).toMatch(/if \(!styleKey \|\| !skuKey\) continue;/);
  });
});
