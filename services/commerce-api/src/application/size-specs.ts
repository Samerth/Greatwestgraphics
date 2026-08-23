import type { SizeSpecChart, SizeSpecRow } from "@gwg/contracts";
import { parseSizeOrder } from "../adapters/ss-activewear/client.js";

export function parseSizeSpecRow(raw: unknown): SizeSpecRow | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const sizeName =
    typeof row.sizeName === "string" ? row.sizeName.trim() : "";
  const specName =
    typeof row.specName === "string" ? row.specName.trim() : "";
  if (!sizeName || !specName) return null;
  const specIdRaw = row.specId;
  const specId =
    typeof specIdRaw === "number" && Number.isFinite(specIdRaw)
      ? specIdRaw
      : typeof specIdRaw === "string" && Number.isFinite(Number(specIdRaw))
        ? Number(specIdRaw)
        : 0;
  const sizeOrder =
    typeof row.sizeOrder === "string" && row.sizeOrder.trim()
      ? row.sizeOrder.trim()
      : null;
  const value = row.value == null ? "" : String(row.value).trim();
  return { specId, sizeName, sizeOrder, specName, value };
}

export function parseSizeSpecRows(raw: unknown): SizeSpecRow[] {
  if (!Array.isArray(raw)) return [];
  const rows: SizeSpecRow[] = [];
  for (const item of raw) {
    const row = parseSizeSpecRow(item);
    if (row) rows.push(row);
  }
  return rows;
}

/**
 * Pivot persisted S&S spec rows into a spec-name × size table.
 * Returns null when there is nothing to show (SanMar / missing / empty).
 */
export function mapSizeSpecsToChart(raw: unknown): SizeSpecChart | null {
  const rows = parseSizeSpecRows(raw);
  if (rows.length === 0) return null;

  const sizeMeta = new Map<string, { name: string; order: number }>();
  const specNames: string[] = [];
  const seenSpecs = new Set<string>();
  const cells: Record<string, Record<string, string>> = {};

  for (const row of rows) {
    if (!sizeMeta.has(row.sizeName)) {
      sizeMeta.set(row.sizeName, {
        name: row.sizeName,
        order: parseSizeOrder(row.sizeOrder),
      });
    }
    if (!seenSpecs.has(row.specName)) {
      seenSpecs.add(row.specName);
      specNames.push(row.specName);
    }
    const bySize = cells[row.specName] ?? {};
    bySize[row.sizeName] = row.value;
    cells[row.specName] = bySize;
  }

  const sizes = [...sizeMeta.values()]
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.name.localeCompare(b.name);
    })
    .map((item) => item.name);

  if (sizes.length === 0 || specNames.length === 0) return null;
  return { sizes, specNames, cells };
}
