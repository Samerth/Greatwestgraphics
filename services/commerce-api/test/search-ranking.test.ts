import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { CatalogService } from "../src/application/catalog-service.js";
import type { CommerceDatabase } from "../src/db/client.js";

/**
 * "Gildan 5000 can't be found by searching 5000" (15 Sep). It could - it
 * was the 40th result, behind every SKU and slug that happened to contain
 * 5000, because search results came back in brand order. Results are now
 * ranked: exact style number first, prefix next, then brand, title, and a
 * SKU-only match last.
 *
 * The ranking is a SQL expression, so these render it through the Postgres
 * dialect and check its shape and its bound values rather than run it.
 */
const dialect = new PgDialect();
const render = (expression: SQL) => dialect.sqlToQuery(expression);

// The service touches the database only when a method runs a query; the
// ranking helpers build SQL without one.
const service = new CatalogService(
  new Proxy({}, { get: (_t, p) => { throw new Error(`db touched via ${String(p)}`); } }) as unknown as CommerceDatabase,
);
const internals = service as unknown as {
  searchRelevance(terms: readonly string[]): SQL | null;
  searchTermsOf(search: string | undefined): string[];
  productOrderBy(sort?: string, search?: string): SQL[];
};

describe("search words", () => {
  it("are split on whitespace and never empty", () => {
    expect(internals.searchTermsOf("  gildan   5000 ")).toEqual(["gildan", "5000"]);
    expect(internals.searchTermsOf(undefined)).toEqual([]);
    expect(internals.searchTermsOf("   ")).toEqual([]);
  });
});

describe("search relevance", () => {
  it("is nothing when there is nothing to rank by", () => {
    expect(internals.searchRelevance([])).toBeNull();
  });

  it("scores an exact style number above a prefix, brand, title and SKU match", () => {
    const { sql, params } = render(internals.searchRelevance(["5000"])!);
    // One CASE per word, tiers in descending order of weight.
    expect(sql.match(/CASE/g)).toHaveLength(1);
    const tiers = [...sql.matchAll(/THEN (\d+)/g)].map((m) => Number(m[1]));
    expect(tiers).toEqual([100, 60, 50, 40, 30, 20, 10]);
    // Exact, prefix and anywhere patterns are all bound, lower-cased.
    expect(params).toContain("5000");
    expect(params).toContain("5000%");
    expect(params).toContain("%5000%");
  });

  it("adds the words up, so 'gildan 5000' outranks the 5000B and 5000L", () => {
    const { sql, params } = render(internals.searchRelevance(["Gildan", "5000"])!);
    expect(sql.match(/CASE/g)).toHaveLength(2);
    expect(sql).toMatch(/END\)\s*\+\s*\(CASE/);
    expect(params).toContain("gildan");
    expect(params).toContain("5000");
  });

  it("never matches a SKU or slug into the score", () => {
    // A SKU-only hit is exactly what buried the shirt; it scores zero.
    const { sql } = render(internals.searchRelevance(["5000"])!);
    expect(sql).not.toMatch(/sku/i);
    expect(sql).not.toMatch(/slug/i);
  });
});

describe("search ordering", () => {
  it("ranks by relevance under the default sort when there is a search", () => {
    const [first] = internals.productOrderBy(undefined, "5000");
    const { sql } = render(first!);
    expect(sql).toMatch(/CASE[\s\S]*desc/i);
  });

  it("leaves an explicit sort alone", () => {
    const [first] = internals.productOrderBy("stock", "5000");
    expect(render(first!).sql).not.toMatch(/CASE/);
  });

  it("stays in brand order when there is no search", () => {
    const [first] = internals.productOrderBy(undefined, "");
    expect(render(first!).sql).not.toMatch(/CASE/);
  });
});

describe("feed noise stays out of the storefront", () => {
  // SanMar's "Unknown Product" placeholders and its own marketing wearables
  // ("Marketing CF Wearable Hoodie", part HOODIECF) were reachable by
  // search, and the hoodie outranked every real one. Hidden from shopper
  // listings; staff views keep them.
  const source = readFileSync(
    resolve(process.cwd(), "src/application/catalog-service.ts"),
    "utf8",
  ).replace(/\/\/.*$/gm, "");

  it("filters the non-garment brands out of storefront queries", () => {
    expect(source).toMatch(/feedNoiseClause = storefrontOnly\s*\?\s*not\(inArray\(ssStyles\.brandName, NON_GARMENT_BRANDS\)\)/);
    expect(source).toMatch(/visibilityClause,\s*feedNoiseClause,\s*stockClause/);
  });

  it("names the placeholders the feed produces", () => {
    for (const brand of ['"Catalogs"', '"Unknown"', '"Unknown Brand"', '"Marketing"']) {
      expect(source).toContain(brand);
    }
  });
});
