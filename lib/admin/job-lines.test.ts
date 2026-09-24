import { describe, expect, it } from "vitest";
import {
  formatSizeBreakdown,
  groupAdminJobLines,
  groupAdminLineGroupsByProduct,
  placementKey,
  productKeyFromStorefrontId,
  sizeSortKey,
  withoutSizeSegment,
  type AdminLineInput,
} from "./job-lines";
import { readJobDetailRouteSource } from "./job-detail-source";

const line = (over: Partial<AdminLineInput> & { id: string }): AdminLineInput => ({
  description: "ATC Everyday Cotton Tee",
  quantity: 10,
  color: "Black",
  ...over,
});

/**
 * Client feedback, 10 September: "should be basic order overview of products,
 * colors, and sizes qty in 1 clean line - don't have multiple lines by size."
 *
 * Orders are stored one line per size because that is how they are priced and
 * picked. Staff need one row per product.
 */
describe("grouping job lines by product", () => {
  it("folds a size run into a single row", () => {
    const groups = groupAdminJobLines([
      line({ id: "1", size: "S", quantity: 10 }),
      line({ id: "2", size: "M", quantity: 25 }),
      line({ id: "3", size: "L", quantity: 35 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.quantity).toBe(70);
    expect(groups[0]!.ids).toEqual(["1", "2", "3"]);
  });

  it("keeps different colours apart", () => {
    const groups = groupAdminJobLines([
      line({ id: "1", size: "M", color: "Black" }),
      line({ id: "2", size: "M", color: "White" }),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.color)).toEqual(["Black", "White"]);
  });

  it("keeps different print placements apart", () => {
    // Same garment and colour but a different placement is a different job,
    // not a size variation.
    const groups = groupAdminJobLines([
      line({ id: "1", size: "M", placement: "Left chest" }),
      line({ id: "2", size: "M", placement: "Full back" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("keeps different products apart even when they share a name", () => {
    const groups = groupAdminJobLines([
      line({ id: "1", size: "M", productKey: "prod-a" }),
      line({ id: "2", size: "M", productKey: "prod-b" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("sums money across the folded lines", () => {
    const groups = groupAdminJobLines([
      line({ id: "1", size: "S", totalMinor: 1000 }),
      line({ id: "2", size: "M", totalMinor: 2500 }),
    ]);
    expect(groups[0]!.totalMinor).toBe(3500);
  });

  it("leaves the total null when no line carried one", () => {
    // Better an absent total than a confident zero.
    const groups = groupAdminJobLines([line({ id: "1", size: "S" })]);
    expect(groups[0]!.totalMinor).toBeNull();
  });

  it("sums a size that appears twice rather than listing it twice", () => {
    // A named roster beside un-named spares produces exactly this.
    const groups = groupAdminJobLines([
      line({ id: "1", size: "M", quantity: 12 }),
      line({ id: "2", size: "M", quantity: 3 }),
    ]);
    expect(groups[0]!.sizes).toEqual([{ size: "M", quantity: 15 }]);
    expect(groups[0]!.quantity).toBe(15);
  });

  it("copes with lines that carry no size at all", () => {
    const groups = groupAdminJobLines([line({ id: "1", size: null })]);
    expect(groups[0]!.sizes).toEqual([]);
    expect(groups[0]!.quantity).toBe(10);
  });
});

describe("size ordering", () => {
  it("reads in garment order, not alphabetical order", () => {
    const groups = groupAdminJobLines([
      line({ id: "1", size: "XL" }),
      line({ id: "2", size: "S" }),
      line({ id: "3", size: "2XL" }),
      line({ id: "4", size: "M" }),
      line({ id: "5", size: "L" }),
    ]);
    expect(groups[0]!.sizes.map((s) => s.size)).toEqual([
      "S",
      "M",
      "L",
      "XL",
      "2XL",
    ]);
  });

  it("is case insensitive", () => {
    expect(sizeSortKey("s")).toBe(sizeSortKey("S"));
    expect(sizeSortKey(" xl ")).toBe(sizeSortKey("XL"));
  });

  it("puts an unrecognised size after the known run", () => {
    expect(sizeSortKey("Tall-3")).toBeGreaterThan(sizeSortKey("6XL"));
  });

  it("renders the breakdown on one line", () => {
    expect(
      formatSizeBreakdown([
        { size: "S", quantity: 10 },
        { size: "M", quantity: 25 },
      ]),
    ).toBe("S 10 · M 25");
  });
});

/**
 * CodSphere UAT V2 row 69 — the written-up version of the 10 September verbal
 * ask: group identical garments, show the size breakdown underneath, then
 * "clearly show which artwork/logo applies" as decoration lines, so the page
 * reads like a production work order.
 */
describe("row 69 — the job page reads like a work order", () => {
  // Reads the whole route — page.tsx, its section components, and the view
  // model that feeds them — not just page.tsx alone. The admin job page
  // rebuild (11-point client note) split what used to be one 876-line file
  // into `lib/admin/job-view.ts` plus eleven section components, so the
  // strings this test pins moved out of page.tsx itself. See
  // job-detail-source.ts for why widening the reader is the right fix here,
  // not loosening what's asserted.
  const page = readJobDetailRouteSource();

  it("lists each decoration as location: method, under the garment", () => {
    expect(page).toContain('data-admin="decoration-lines"');
    expect(page).toContain("portalDecorations(configuration?.pricing)");
  });

  it("reads decoration from the same source the customer portal does", () => {
    // Two readers of the same order must not disagree about it.
    expect(page).toMatch(
      /import \{ portalDecorations \} from "@\/lib\/commerce\/portal-progress"/,
    );
  });
});

/**
 * 15 Sep: an order of one hoodie in S, M and L rendered as three blocks.
 * Two things in the line's configuration carried the size - the storefront
 * id (`product:variant`, and a variant is a size) and the cart's own meta
 * line ("Custom design · Size M · Screen print") - and both were part of
 * the grouping key.
 */
describe("a size run is one block, however the size leaks in", () => {
  it("keys on the product, not the size variant", () => {
    expect(productKeyFromStorefrontId("88b8954a:d70afedb")).toBe("88b8954a");
    expect(productKeyFromStorefrontId("88b8954a:eded4f64")).toBe("88b8954a");
    expect(productKeyFromStorefrontId("plain-id")).toBe("plain-id");
    expect(productKeyFromStorefrontId(undefined)).toBeNull();
    expect(productKeyFromStorefrontId(":only-variant")).toBeNull();
  });

  it("drops the size segment from the meta line, for keying and display", () => {
    expect(withoutSizeSegment("Custom design · Size M · Screen print")).toBe(
      "Custom design · Screen print",
    );
    expect(withoutSizeSegment("Size 2XL")).toBeNull();
    expect(withoutSizeSegment("Front chest · Screen print")).toBe("Front chest · Screen print");
    expect(withoutSizeSegment(undefined)).toBeNull();
  });

  it("keys the placement on the design and its decoration, not the meta", () => {
    const pricing = {
      input: {
        decorations: [{ location: "front", methodKey: "screenPrint", colours: 2 }],
      },
    };
    const small = placementKey({
      designProjectId: "design-1",
      productMetadata: "Custom design · Size S · Screen print",
      pricing,
    });
    const medium = placementKey({
      designProjectId: "design-1",
      productMetadata: "Custom design · Size M · Screen print",
      pricing,
    });
    expect(small).toBe(medium);
  });

  it("still keeps a different design or a different print apart", () => {
    const base = {
      designProjectId: "design-1",
      pricing: { input: { decorations: [{ location: "front", methodKey: "screenPrint", colours: 2 }] } },
    };
    expect(placementKey({ ...base, designProjectId: "design-2" })).not.toBe(placementKey(base));
    expect(
      placementKey({
        ...base,
        pricing: { input: { decorations: [{ location: "back", methodKey: "screenPrint", colours: 2 }] } },
      }),
    ).not.toBe(placementKey(base));
    expect(
      placementKey({
        ...base,
        pricing: { input: { decorations: [{ location: "front", methodKey: "screenPrint", colours: 3 }] } },
      }),
    ).not.toBe(placementKey(base));
  });

  it("folds the reported order into one block with the sizes beneath", () => {
    const configuration = (size: string, variant: string) => ({
      storefrontProductId: `88b8954a:${variant}`,
      productMetadata: `Custom design · Size ${size} · Screen print`,
      designProjectId: "9d4cdb87",
      pricing: { input: { decorations: [{ location: "front", methodKey: "screenPrint", colours: 2 }] } },
    });
    const groups = groupAdminJobLines(
      [
        ["S", "d70afedb", "1"],
        ["M", "eded4f64", "2"],
        ["L", "8de42cfb", "3"],
      ].map(([size, variant, id]) => {
        const config = configuration(size!, variant!);
        return line({
          id: id!,
          description: "Adidas Men's Ultimate365 Elevated Hoodie",
          size,
          quantity: 72,
          productKey: productKeyFromStorefrontId(config.storefrontProductId),
          placement: placementKey(config),
        });
      }),
    );
    expect(groups).toHaveLength(1);
    expect(groups[0]!.quantity).toBe(216);
    expect(formatSizeBreakdown(groups[0]!.sizes)).toBe("S 72 · M 72 · L 72");
  });

  it("is wired that way on the page", () => {
    // See the comment on "row 69" above — same widened reader, same reason.
    const page = readJobDetailRouteSource();
    expect(page).toContain("productKey: productKeyFromStorefrontId(config.storefrontProductId)");
    expect(page).toContain("placement: placementKey(config)");
    expect(page).toContain("withoutSizeSegment(configuration?.productMetadata)");
    expect(page).not.toMatch(/placement: config\.productMetadata/);
  });
});

/**
 * Pavin, once he saw the cart rebuilt as Product → Decoration → Colour →
 * Sizes: "Yeah they should look similar... Product and design / Color then
 * size". The admin job page and the customer portal both wrap
 * `groupAdminJobLines`'s own colour-level fold with this.
 */
describe("groupAdminLineGroupsByProduct", () => {
  // GWG-1034: one garment, three colourways.
  const matcha = { key: "m", ids: ["1"], description: "Allmade Unisex Organic Cotton Tee", color: "Matcha Green", placement: "Front: Screen Print · 1 colour", sizes: [{ size: "XL", quantity: 24 }], quantity: 24, totalMinor: 50060, unitPriceEstimateMinor: 2086 };
  const black = { key: "b", ids: ["2"], description: "Allmade Unisex Organic Cotton Tee", color: "Deep Black", placement: "Front: Screen Print · 1 colour", sizes: [{ size: "M", quantity: 24 }], quantity: 24, totalMinor: 50060, unitPriceEstimateMinor: 2086 };
  const blue = { key: "r", ids: ["3"], description: "Allmade Unisex Organic Cotton Tee", color: "Arctic Blue", placement: "Front: Screen Print · 1 colour", sizes: [{ size: "S", quantity: 15 }], quantity: 15, totalMinor: 37670, unitPriceEstimateMinor: 2511 };

  it("folds every colour of one garment into a single product bucket", () => {
    const products = groupAdminLineGroupsByProduct([matcha, black, blue]);
    expect(products).toHaveLength(1);
    expect(products[0]!.description).toBe("Allmade Unisex Organic Cotton Tee");
    expect(products[0]!.quantity).toBe(63); // 24 + 24 + 15
  });

  it("nests one decoration holding all three colours, since they share the same placement", () => {
    const products = groupAdminLineGroupsByProduct([matcha, black, blue]);
    const decorations = products[0]!.decorations;
    expect(decorations).toHaveLength(1);
    expect(decorations[0]!.colours.map((c) => c.color)).toEqual([
      "Matcha Green",
      "Deep Black",
      "Arctic Blue",
    ]);
  });

  it("sums totalMinor up through decoration and product level — the real GWG-1034 numbers", () => {
    const products = groupAdminLineGroupsByProduct([matcha, black, blue]);
    expect(products[0]!.decorations[0]!.totalMinor).toBe(50060 + 50060 + 37670);
    expect(products[0]!.totalMinor).toBe(137790); // $1,377.90
  });

  it("keeps two genuinely different products apart, even sharing a colour name", () => {
    const otherGarment = { ...matcha, key: "o", description: "Gildan Unisex DryBlend Crewneck" };
    const products = groupAdminLineGroupsByProduct([matcha, otherGarment]);
    expect(products).toHaveLength(2);
  });

  it("keeps two different decorations of the same product apart", () => {
    const embroidered = { ...matcha, key: "e", placement: "Left Chest: Embroidery · Small" };
    const products = groupAdminLineGroupsByProduct([matcha, embroidered]);
    expect(products).toHaveLength(1);
    expect(products[0]!.decorations).toHaveLength(2);
  });

  it("lands on null totalMinor only when every colour's total is null — never invents a number", () => {
    const noPrice = { ...matcha, key: "n", totalMinor: null };
    const products = groupAdminLineGroupsByProduct([noPrice]);
    expect(products[0]!.totalMinor).toBeNull();
  });

  it("sums the totals it does have rather than nulling the whole group over one missing line", () => {
    const noPrice = { ...black, key: "n", totalMinor: null };
    const products = groupAdminLineGroupsByProduct([matcha, noPrice]);
    expect(products[0]!.decorations[0]!.totalMinor).toBe(50060);
  });

  it("returns an empty list for no groups", () => {
    expect(groupAdminLineGroupsByProduct([])).toEqual([]);
  });
});
