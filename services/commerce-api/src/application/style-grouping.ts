/**
 * Shop tiles are one garment (style), not one colourway.
 *
 * The vendor feeds store style + color + size. `ss_products` is style+color,
 * so listing those rows raw makes Navy / Black / White look like three
 * products. Sizes stay on `ss_variants` and are never listed.
 *
 * Grouping key is `styleUuid` (the `ss_styles` row), not the title — titles
 * often include the colour, and two real styles can share a marketing name.
 */

export type StyleGroupableColorway = {
  id: string;
  styleUuid: string;
  colorName: string;
  slug: string;
  qty: number;
  active: boolean;
  colorFrontImageUrl: string | null;
};

export function parseSearchTerms(search?: string): string[] {
  return (search ?? "")
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesSearch(row: StyleGroupableColorway, searchTerms: string[]): boolean {
  if (searchTerms.length === 0) return false;
  const color = row.colorName.toLowerCase();
  const slug = row.slug.toLowerCase();
  return searchTerms.every((term) => color.includes(term) || slug.includes(term));
}

/** Lower rank wins. Search hits, then in-stock, then a real photo. */
export function compareRepresentativeColorways(
  a: StyleGroupableColorway,
  b: StyleGroupableColorway,
  searchTerms: string[],
): number {
  const rank = (row: StyleGroupableColorway): [number, number, number] => [
    matchesSearch(row, searchTerms) ? 0 : 1,
    row.qty > 0 && row.active ? 0 : 1,
    row.colorFrontImageUrl ? 0 : 1,
  ];
  const left = rank(a);
  const right = rank(b);
  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return left[i]! - right[i]!;
  }
  const byColor = a.colorName.localeCompare(b.colorName, "en");
  if (byColor !== 0) return byColor;
  return a.id.localeCompare(b.id);
}

export function pickRepresentativeByStyle<T>(
  rows: readonly T[],
  getColorway: (row: T) => StyleGroupableColorway,
  options?: { search?: string },
): { representative: T; colorwayCount: number }[] {
  const searchTerms = parseSearchTerms(options?.search);
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = getColorway(row).styleUuid;
    const list = groups.get(key);
    if (list) list.push(row);
    else groups.set(key, [row]);
  }

  const picked: { representative: T; colorwayCount: number }[] = [];
  for (const list of groups.values()) {
    const representative = [...list].sort((left, right) =>
      compareRepresentativeColorways(
        getColorway(left),
        getColorway(right),
        searchTerms,
      ),
    )[0]!;
    picked.push({ representative, colorwayCount: list.length });
  }
  return picked;
}
