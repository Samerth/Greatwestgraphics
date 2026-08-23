import { parsePage, queryHref, textMatchesQuery } from "./paged-list";

export const MAPPING_PAGE_SIZE = 20;
export const CATEGORY_PAGE_SIZE = 25;

export type MappingTab = "review" | "mapped";

export type MappingRow = {
  key: string;
  label: string;
  styleCount: number;
  categoryIds: string[];
};

export function parseMappingTab(raw?: string | null): MappingTab {
  return raw === "mapped" ? "mapped" : "review";
}

export function mappingMatchesQuery(
  row: Pick<MappingRow, "key" | "label">,
  q: string,
): boolean {
  return textMatchesQuery([row.key, row.label], q);
}

export function mappingListHref(opts: {
  tab?: MappingTab | string | null;
  q?: string | null;
  page?: number | string | null;
}): string {
  const tab = parseMappingTab(opts.tab);
  return queryHref(
    "/admin/categories/mappings",
    {
      tab,
      q: opts.q ?? "",
      page: parsePage(opts.page == null ? undefined : String(opts.page)),
    },
    { tab: "review", page: "1" },
  );
}

export function categoryListHref(opts: {
  q?: string | null;
  page?: number | string | null;
}): string {
  return queryHref(
    "/admin/categories",
    {
      q: opts.q ?? "",
      page: parsePage(opts.page == null ? undefined : String(opts.page)),
    },
    { page: "1" },
  );
}

export function groupMappings(
  mappings: Record<string, unknown>[],
): { mapsByKey: Map<string, string[]>; labelByKey: Map<string, string> } {
  const mapsByKey = new Map<string, string[]>();
  const labelByKey = new Map<string, string>();
  for (const row of mappings) {
    const key = String(row.ssCategoryKey ?? "");
    if (!key) continue;
    const list = mapsByKey.get(key) ?? [];
    list.push(String(row.categoryId));
    mapsByKey.set(key, list);
    if (row.ssCategoryLabel) {
      labelByKey.set(key, String(row.ssCategoryLabel));
    }
  }
  return { mapsByKey, labelByKey };
}

export function unmappedRows(
  unmapped: Record<string, unknown>[],
  mapsByKey: Map<string, string[]>,
): MappingRow[] {
  return unmapped.map((item) => {
    const key = String(item.ssCategoryKey ?? "");
    const label = String(item.ssCategoryLabel || key);
    return {
      key,
      label,
      styleCount: Number(item.styleCount ?? 0),
      categoryIds: mapsByKey.get(key) ?? [],
    };
  });
}

export function mappedRows(
  mapsByKey: Map<string, string[]>,
  labelByKey: Map<string, string>,
): MappingRow[] {
  return [...mapsByKey.entries()].map(([key, categoryIds]) => ({
    key,
    label: labelByKey.get(key) || key,
    styleCount: 0,
    categoryIds,
  }));
}
