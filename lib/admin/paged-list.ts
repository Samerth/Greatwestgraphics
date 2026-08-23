/** Shared paging helpers for admin lists that must not render every row. */

export function parsePage(raw?: string | null, fallback = 1): number {
  const n = Number(raw ?? fallback);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.floor(n);
}

export function textMatchesQuery(haystacks: string[], q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return haystacks.some((value) => value.toLowerCase().includes(needle));
}

export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): {
  page: number;
  pageCount: number;
  pageSize: number;
  total: number;
  start: number;
  end: number;
  items: T[];
} {
  const size = Math.max(1, Math.floor(pageSize));
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / size));
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), pageCount);
  const offset = (safePage - 1) * size;
  const sliced = items.slice(offset, offset + size);
  return {
    page: safePage,
    pageCount,
    pageSize: size,
    total,
    start: total === 0 ? 0 : offset + 1,
    end: offset + sliced.length,
    items: sliced,
  };
}

export function queryHref(
  path: string,
  params: Record<string, string | number | undefined>,
  omitDefaults: Record<string, string> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const str = String(value).trim();
    if (!str) continue;
    if (omitDefaults[key] === str) continue;
    search.set(key, str);
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}
