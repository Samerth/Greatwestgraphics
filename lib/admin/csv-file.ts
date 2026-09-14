/**
 * Helpers for picking a .csv off disk in the admin importer, instead of
 * opening it, selecting all and pasting it in (client call, 10 September).
 *
 * The file is read in the browser and dropped into the box that was already
 * there, so the import itself is untouched — the server action still receives
 * exactly the same text it always did, and every existing validation, error
 * and progress path behaves identically. The paste box stays, both because
 * pasting a few rows is still the fastest way to test something and because
 * the loaded text stays visible and editable before anyone commits to it.
 */

/** Refuse anything big enough to lock up the page rendering it into a box. */
export const MAX_CSV_BYTES = 5 * 1024 * 1024;

export const CSV_FILE_ACCEPT = ".csv,text/csv,text/plain";

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Data rows, i.e. not counting the header. Blank lines are ignored because a
 * file exported from a spreadsheet almost always ends with one, and reporting
 * "13 rows" for twelve products makes the admin doubt the import.
 */
export function csvRowCount(text: string): number {
  const lines = text.split(/\r?\n/).filter((line) => line.trim().length > 0);
  return Math.max(0, lines.length - 1);
}

/** The header names a file declares, normalised the way the importer reads
 *  them — used only to tell the admin what was picked up. */
export function csvHeaderColumns(text: string): string[] {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!firstLine) return [];
  return firstLine
    .split(",")
    .map((column) => column.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

export type CsvFileRejection = { ok: false; error: string };
export type CsvFileAccepted = {
  ok: true;
  summary: string;
  rows: number;
  columns: string[];
};
export type CsvFileCheck = CsvFileAccepted | CsvFileRejection;

/**
 * Decides whether a chosen file is worth handing to the importer, and
 * describes it back to the admin so a wrong file is obvious before it runs
 * rather than after.
 */
export function checkCsvFile(
  name: string,
  size: number,
  text: string,
): CsvFileCheck {
  if (size > MAX_CSV_BYTES) {
    return {
      ok: false,
      error: `${name} is ${formatBytes(size)}. The limit is ${formatBytes(MAX_CSV_BYTES)} — split it, or paste the rows you need.`,
    };
  }
  if (!text.trim()) {
    return { ok: false, error: `${name} is empty.` };
  }
  const rows = csvRowCount(text);
  if (rows === 0) {
    return {
      ok: false,
      error: `${name} has a header but no rows under it.`,
    };
  }
  const columns = csvHeaderColumns(text);
  return {
    ok: true,
    rows,
    columns,
    summary: `${name} · ${rows.toLocaleString("en-CA")} ${rows === 1 ? "row" : "rows"} · ${columns.length} columns`,
  };
}
