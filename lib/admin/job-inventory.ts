import type { InventoryCheckLine } from "@gwg/contracts";
import type { AdminLineGroup } from "@/lib/admin/job-lines";

export type StockState = "ok" | "short" | "unknown";

export interface VariantStock {
  size: string | null;
  sku: string | null;
  requested: number;
  available: number | null;
  shortfall: number;
  state: StockState;
}

export interface GroupStock {
  groupKey: string;
  variants: VariantStock[];
  state: StockState;
  shortfallUnits: number;
  unknownCount: number;
}

export interface JobStock {
  byGroup: Record<string, GroupStock>;
  state: StockState;
  shortfallUnits: number;
  unknownCount: number;
  summary: string;
}

function summaryFor(state: StockState, shortfallUnits: number, unknownCount: number): string {
  if (state === "short") {
    const parts = [`⚠ ${shortfallUnits} unit${shortfallUnits === 1 ? "" : "s"} unavailable`];
    if (unknownCount > 0) {
      parts.push(`stock unknown for ${unknownCount} size${unknownCount === 1 ? "" : "s"}`);
    }
    return parts.join(", ");
  }
  if (state === "unknown") {
    return `Stock unknown for ${unknownCount} size${unknownCount === 1 ? "" : "s"}`;
  }
  return "✓ All items available";
}

/**
 * Joins the live inventory check (one row per raw job line, i.e. per size)
 * against the grouped Products view (one row per colour), so the "simple
 * summary that can expand" the client asked for (11-point admin note,
 * point 5) is possible at all — the two sections are keyed differently.
 *
 * `available` is the *current* catalogue quantity, looked up independently
 * for every raw line — so two raw lines for the same size (a colour added
 * twice before checkout produces two lines, not one with quantity 2) report
 * the *same* stock figure twice, not half each. Summing `available` across
 * them would silently double the real stock on the shelf; only `requested`
 * is additive. `available === null` means the catalogue has no quantity on
 * file for that item at all — that is never treated as a shortfall, only as
 * unknown, matching what the page has always said here.
 */
export function summarizeJobInventory(
  groups: readonly AdminLineGroup[],
  lines: readonly { id: string; size: string | null }[],
  inventory: readonly InventoryCheckLine[] | null,
): JobStock {
  const sizeByLineId = new Map(lines.map((l) => [l.id, l.size]));
  const invByLineId = new Map((inventory ?? []).map((i) => [i.lineId, i]));

  const byGroup: Record<string, GroupStock> = {};
  let jobShortfall = 0;
  let jobUnknown = 0;

  for (const group of groups) {
    const bySize = new Map<
      string,
      { size: string | null; sku: string | null; requested: number; available: number | null }
    >();

    for (const id of group.ids) {
      const inv = invByLineId.get(id);
      if (!inv) continue;
      const size = sizeByLineId.get(id) ?? null;
      // No size on the line at all is its own case, not "no size in
      // common" with another sizeless line from a different product.
      const dedupeKey = size ?? `__line:${id}`;
      const existing = bySize.get(dedupeKey);
      if (existing) {
        existing.requested += inv.requested;
      } else {
        bySize.set(dedupeKey, {
          size,
          sku: inv.sku ?? null,
          requested: inv.requested,
          available: inv.available,
        });
      }
    }

    const variants: VariantStock[] = [...bySize.values()].map((v) => {
      const shortfall = v.available === null ? 0 : Math.max(0, v.requested - v.available);
      const state: StockState = v.available === null ? "unknown" : shortfall > 0 ? "short" : "ok";
      return { size: v.size, sku: v.sku, requested: v.requested, available: v.available, shortfall, state };
    });

    const shortfallUnits = variants.reduce((sum, v) => sum + v.shortfall, 0);
    const unknownCount = variants.filter((v) => v.state === "unknown").length;
    const state: StockState = shortfallUnits > 0 ? "short" : unknownCount > 0 ? "unknown" : "ok";

    byGroup[group.key] = { groupKey: group.key, variants, state, shortfallUnits, unknownCount };
    jobShortfall += shortfallUnits;
    jobUnknown += unknownCount;
  }

  const state: StockState = jobShortfall > 0 ? "short" : jobUnknown > 0 ? "unknown" : "ok";

  return {
    byGroup,
    state,
    shortfallUnits: jobShortfall,
    unknownCount: jobUnknown,
    summary: summaryFor(state, jobShortfall, jobUnknown),
  };
}
