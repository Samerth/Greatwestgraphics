import { describe, expect, it } from "vitest";
import type { CommerceDatabase } from "../../db/client.js";
import { CatalogWriter } from "./writer.js";

/**
 * Just enough of a Drizzle handle to see what `updateInventory` sets:
 * `update().set(patch).where().returning()` resolves one matched row, and the
 * product-quantity recompute (`execute`) is a no-op.
 */
function fakeDatabase() {
  const patches: Array<Record<string, unknown>> = [];
  const database = {
    update: () => ({
      set: (patch: Record<string, unknown>) => {
        patches.push(patch);
        return {
          where: () => ({ returning: async () => [{ id: "variant-1" }] }),
        };
      },
    }),
    execute: async () => undefined,
  };
  return { patches, writer: new CatalogWriter(database as unknown as CommerceDatabase) };
}

describe("CatalogWriter.updateInventory prices", () => {
  it("writes a real vendor price", async () => {
    const { writer, patches } = fakeDatabase();
    const result = await writer.updateInventory("tenant", "sanmar", [
      { skuKey: "17977-2", qty: 12, priceDollars: 89.5 },
    ]);
    expect(result.updated).toBe(1);
    expect(patches[0]).toMatchObject({ qty: 12, customerPriceMinor: 8950 });
  });

  it("keeps the price on file when the vendor feed says 0.00, but still refreshes stock", async () => {
    // 31 of the 20,583 SanMar Bulk parts on 1 Oct 2026 carried price 0.00.
    const { writer, patches } = fakeDatabase();
    const result = await writer.updateInventory("tenant", "sanmar", [
      { skuKey: "17977-1", qty: 7, priceDollars: 0 },
    ]);
    expect(result.updated).toBe(1);
    expect(patches[0]).toMatchObject({ qty: 7 });
    expect(patches[0]).not.toHaveProperty("customerPriceMinor");
  });

  it("leaves the price alone when the feed has none", async () => {
    const { writer, patches } = fakeDatabase();
    await writer.updateInventory("tenant", "sanmar", [
      { skuKey: "17977-3", qty: 1 },
    ]);
    expect(patches[0]).not.toHaveProperty("customerPriceMinor");
  });

  it("fills only a missing price when asked, leaving an existing one alone", async () => {
    // The SQL itself is Postgres's job; what is checked here is that the write
    // is conditional rather than a plain number, so it cannot overwrite.
    const { writer, patches } = fakeDatabase();
    await writer.updateInventory("tenant", "sanmar", [
      { skuKey: "28373-1", qty: 4, priceDollars: 18.99, priceOnlyIfMissing: true },
    ]);
    expect(patches[0]).toMatchObject({ qty: 4 });
    expect(typeof patches[0]?.customerPriceMinor).toBe("object");
  });

  it("ignores a negative or non-numeric price", async () => {
    const { writer, patches } = fakeDatabase();
    await writer.updateInventory("tenant", "sanmar", [
      { skuKey: "a", qty: 1, priceDollars: -4 },
      { skuKey: "b", qty: 1, priceDollars: Number.NaN },
    ]);
    expect(patches).toHaveLength(2);
    for (const patch of patches) {
      expect(patch).not.toHaveProperty("customerPriceMinor");
    }
  });
});
