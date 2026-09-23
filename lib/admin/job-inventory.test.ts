import { describe, expect, it } from "vitest";
import { summarizeJobInventory } from "@/lib/admin/job-inventory";
import type { AdminLineGroup } from "@/lib/admin/job-lines";

function group(overrides: Partial<AdminLineGroup> = {}): AdminLineGroup {
  return {
    key: "product-a||Matcha Green||",
    ids: ["line-1"],
    description: "Allmade Unisex Organic Cotton Tee",
    color: "Matcha Green",
    placement: null,
    sizes: [{ size: "XL", quantity: 24 }],
    quantity: 24,
    totalMinor: 50064,
    unitPriceEstimateMinor: 2086,
    ...overrides,
  };
}

describe("summarizeJobInventory", () => {
  it("reads ok when every ordered size has enough stock", () => {
    const result = summarizeJobInventory(
      [group()],
      [{ id: "line-1", size: "XL" }],
      [{ lineId: "line-1", description: "…", requested: 24, available: 418, sku: "39816-5" }],
    );
    expect(result.state).toBe("ok");
    expect(result.summary).toBe("✓ All items available");
    expect(result.shortfallUnits).toBe(0);
  });

  it("flags a real shortfall with the unit count", () => {
    const result = summarizeJobInventory(
      [group()],
      [{ id: "line-1", size: "XL" }],
      [{ lineId: "line-1", description: "…", requested: 24, available: 10, sku: "39816-5" }],
    );
    expect(result.state).toBe("short");
    expect(result.shortfallUnits).toBe(14);
    expect(result.summary).toBe("⚠ 14 units unavailable");
  });

  it("treats a null catalogue quantity as unknown, never as a shortfall", () => {
    const result = summarizeJobInventory(
      [group()],
      [{ id: "line-1", size: "XL" }],
      [{ lineId: "line-1", description: "…", requested: 24, available: null, sku: "39816-5" }],
    );
    expect(result.state).toBe("unknown");
    expect(result.shortfallUnits).toBe(0);
    expect(result.unknownCount).toBe(1);
    expect(result.summary).toBe("Stock unknown for 1 size");
  });

  it("takes the size label from the line, not from the inventory row's description", () => {
    // InventoryCheckLine.description is the *product* name, not the size —
    // this is exactly why the join can't just render the inventory array.
    const result = summarizeJobInventory(
      [group({ ids: ["line-1"] })],
      [{ id: "line-1", size: "XL" }],
      [
        {
          lineId: "line-1",
          description: "Allmade Unisex Organic Cotton Tee",
          requested: 24,
          available: 418,
          sku: "39816-5",
        },
      ],
    );
    expect(result.byGroup[group().key]?.variants[0]?.size).toBe("XL");
  });

  it("sums requested but does not double-count available stock for a duplicate size", () => {
    // Two raw lines for the same size (a colour added twice before
    // checkout) — the catalogue reports the same 418-in-stock figure
    // independently on each; summing it would read as 836 available.
    const result = summarizeJobInventory(
      [group({ ids: ["line-1", "line-2"], quantity: 30, sizes: [{ size: "XL", quantity: 30 }] })],
      [
        { id: "line-1", size: "XL" },
        { id: "line-2", size: "XL" },
      ],
      [
        { lineId: "line-1", description: "…", requested: 24, available: 25, sku: "39816-5" },
        { lineId: "line-2", description: "…", requested: 6, available: 25, sku: "39816-5" },
      ],
    );
    const variant = result.byGroup[group().key]?.variants[0];
    expect(variant?.requested).toBe(30);
    expect(variant?.available).toBe(25);
    expect(variant?.shortfall).toBe(5);
    expect(result.state).toBe("short");
  });

  it("combines a real shortfall with an unknown size in the summary", () => {
    const shortGroup = group({
      key: "a",
      ids: ["line-1"],
      sizes: [{ size: "M", quantity: 24 }],
    });
    const unknownGroup = group({
      key: "b",
      ids: ["line-2"],
      color: "Deep Black",
      sizes: [{ size: "S", quantity: 15 }],
    });
    const result = summarizeJobInventory(
      [shortGroup, unknownGroup],
      [
        { id: "line-1", size: "M" },
        { id: "line-2", size: "S" },
      ],
      [
        { lineId: "line-1", description: "…", requested: 24, available: 10, sku: "sku-m" },
        { lineId: "line-2", description: "…", requested: 15, available: null, sku: "sku-s" },
      ],
    );
    expect(result.state).toBe("short");
    expect(result.shortfallUnits).toBe(14);
    expect(result.unknownCount).toBe(1);
    expect(result.summary).toBe("⚠ 14 units unavailable, stock unknown for 1 size");
  });

  it("handles a job with no inventory check at all", () => {
    const result = summarizeJobInventory([group()], [{ id: "line-1", size: "XL" }], null);
    expect(result.state).toBe("ok");
    expect(result.byGroup[group().key]?.variants).toHaveLength(0);
  });
});
