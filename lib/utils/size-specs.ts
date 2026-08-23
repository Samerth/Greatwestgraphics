export type SizeSpecChart = {
  sizes: string[];
  specNames: string[];
  cells: Record<string, Record<string, string>>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value);
}

function parseSizeOrder(raw: string | null | undefined): number {
  if (!raw) return 0;
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return 0;
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseSizeSpecRows(raw: unknown): Array<{
  sizeName: string;
  sizeOrder: string | null;
  specName: string;
  value: string;
}> {
  if (!Array.isArray(raw)) return [];
  const rows: Array<{
    sizeName: string;
    sizeOrder: string | null;
    specName: string;
    value: string;
  }> = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const sizeName =
      typeof item.sizeName === "string" ? item.sizeName.trim() : "";
    const specName =
      typeof item.specName === "string" ? item.specName.trim() : "";
    if (!sizeName || !specName) continue;
    rows.push({
      sizeName,
      sizeOrder:
        typeof item.sizeOrder === "string" && item.sizeOrder.trim()
          ? item.sizeOrder.trim()
          : null,
      specName,
      value: item.value == null ? "" : String(item.value).trim(),
    });
  }
  return rows;
}

export function mapSizeSpecRowsToChart(raw: unknown): SizeSpecChart | null {
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

export function parseSizeSpecChart(raw: unknown): SizeSpecChart | null {
  if (!isRecord(raw)) return null;
  const sizes = Array.isArray(raw.sizes)
    ? raw.sizes.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const specNames = Array.isArray(raw.specNames)
    ? raw.specNames.filter(
        (item): item is string => typeof item === "string" && item.length > 0,
      )
    : [];
  if (sizes.length === 0 || specNames.length === 0) return null;
  if (!isRecord(raw.cells)) return null;
  const cells: Record<string, Record<string, string>> = {};
  for (const specName of specNames) {
    const bySize = raw.cells[specName];
    if (!isRecord(bySize)) continue;
    const row: Record<string, string> = {};
    for (const size of sizes) {
      const value = bySize[size];
      if (typeof value === "string") row[size] = value;
    }
    cells[specName] = row;
  }
  return { sizes, specNames, cells };
}

/**
 * Read the S&S measurement chart from a catalog product-detail payload.
 * Prefers the pivoted `sizeSpecs` field; falls back to raw `style.sizeSpecs`.
 */
export function readProductSizeChart(detail: unknown): SizeSpecChart | null {
  if (!isRecord(detail)) return null;
  const fromChart = parseSizeSpecChart(detail.sizeSpecs);
  if (fromChart) return fromChart;
  if (isRecord(detail.style)) {
    return mapSizeSpecRowsToChart(detail.style.sizeSpecs);
  }
  return null;
}
