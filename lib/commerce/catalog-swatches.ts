/** Visible colour dots on a catalogue card before paging. */
export const CATALOG_SWATCH_WINDOW = 7;

export function catalogSwatchWindowStart(
  total: number,
  start: number,
  visible = CATALOG_SWATCH_WINDOW,
): number {
  if (total <= visible) return 0;
  const lastPageStart = Math.floor((total - 1) / visible) * visible;
  return Math.min(Math.max(0, start), lastPageStart);
}

export function catalogSwatchWindow(
  total: number,
  start: number,
  visible = CATALOG_SWATCH_WINDOW,
): {
  start: number;
  end: number;
  remaining: number;
  canPrev: boolean;
  canNext: boolean;
} {
  const windowStart = catalogSwatchWindowStart(total, start, visible);
  const end = Math.min(total, windowStart + visible);
  return {
    start: windowStart,
    end,
    remaining: Math.max(0, total - end),
    canPrev: windowStart > 0,
    canNext: end < total,
  };
}

export function nextCatalogSwatchStart(
  total: number,
  start: number,
  visible = CATALOG_SWATCH_WINDOW,
): number {
  return catalogSwatchWindowStart(total, start + visible, visible);
}

export function prevCatalogSwatchStart(
  total: number,
  start: number,
  visible = CATALOG_SWATCH_WINDOW,
): number {
  return catalogSwatchWindowStart(total, start - visible, visible);
}
