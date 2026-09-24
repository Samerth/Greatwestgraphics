import {
  formatSizeBreakdown,
  sizeSortKey,
  withoutSizeSegment,
} from "@/lib/admin/job-lines";
import type { CartItem } from "@/lib/store/cart";

export type CartLineGroup = {
  key: string;
  /**
   * Every cart item folded into this group, in size order. The underlying
   * `CartItem` objects are untouched — grouping is presentation only, so
   * Remove, Edit, the quantity stepper and Save for later all still act on
   * one item's own `(id, color, variantId)` identity, exactly as before
   * grouping existed. Checkout and `computeCartTotals` still see the flat
   * `items` array; nothing about how an order is priced or submitted
   * changes here.
   */
  items: CartItem[];
  /**
   * The first item folded into this group. Safe to read the shared fields
   * (name, image, design, decoration meta, notes) from just this one,
   * because a group is keyed on product + colour — every item inside it was
   * added from the same colour block and therefore shares the same design.
   */
  representative: CartItem;
  quantity: number;
  /** 0 when every item in the group is `priceUnavailable`; never invented. */
  totalMinor: number;
  hasUnpriced: boolean;
};

function groupKeyFor(item: CartItem, rosterIndex: number): string {
  // A roster (team/named) line already carries its own complete breakdown
  // in `item.roster` and is priced as one whole — it never shares a group
  // with another line, even of the same product and colour, so two
  // separate roster orders for the same shirt don't collapse into one
  // confusing block. `rosterIndex` (each roster item's own position among
  // roster items) guarantees a unique key even when two such lines are
  // otherwise identical in every field, which id/variantId alone cannot.
  if (item.roster) return `roster:${rosterIndex}`;
  return `${item.productId ?? item.id}||${item.color}`;
}

/**
 * Folds cart lines that differ *only* by size into one group — one row per
 * product and colour, sizes nested inside — mirroring `groupAdminJobLines`
 * (`lib/admin/job-lines.ts`), the same shape already used on the admin job
 * page and the customer portal.
 *
 * Before this, a design ordered in three colours across four sizes was four
 * separate, near-identical cards in the cart (Pavin: "cart shows different
 * lines for the same product with different size variants — make it clean
 * like the input quantity page"). It is now three groups, one per colour,
 * with the sizes listed inside each — the same shape the Input Quantity
 * page he pointed at already uses.
 */
export function groupCartItems(items: readonly CartItem[]): CartLineGroup[] {
  const groups = new Map<string, CartLineGroup>();
  let rosterIndex = 0;

  for (const item of items) {
    const key = groupKeyFor(item, item.roster ? rosterIndex++ : -1);
    const lineTotalMinor = item.priceUnavailable
      ? 0
      : Math.round(item.qty * item.unit * 100);

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        items: [item],
        representative: item,
        quantity: item.qty,
        totalMinor: lineTotalMinor,
        hasUnpriced: Boolean(item.priceUnavailable),
      });
      continue;
    }

    existing.items.push(item);
    existing.quantity += item.qty;
    existing.totalMinor += lineTotalMinor;
    if (item.priceUnavailable) existing.hasUnpriced = true;
  }

  for (const group of groups.values()) {
    group.items.sort(
      (a, b) =>
        sizeSortKey(a.size ?? "") - sizeSortKey(b.size ?? "") ||
        (a.size ?? "").localeCompare(b.size ?? ""),
    );
  }

  return [...groups.values()];
}

/**
 * "S 10 · M 25" for a group's own items — reuses the admin/portal helper
 * rather than restating the same formatting a third time.
 */
export function cartGroupSizeBreakdown(items: readonly CartItem[]): string {
  return formatSizeBreakdown(
    items
      .filter((item): item is CartItem & { size: string } => Boolean(item.size))
      .map((item) => ({ size: item.size, quantity: item.qty })),
  );
}

export type CartDecorationGroup = {
  key: string;
  /** "Custom design · Screen print" — `representative.meta` with the size
   *  segment stripped, the decoration itself rather than any one colour's
   *  size. */
  label: string;
  representative: CartItem;
  colours: CartLineGroup[];
  quantity: number;
  totalMinor: number;
  hasUnpriced: boolean;
};

export type CartProductGroup = {
  key: string;
  name: string;
  representative: CartItem;
  decorations: CartDecorationGroup[];
  quantity: number;
  totalMinor: number;
  hasUnpriced: boolean;
};

function productKeyFor(item: CartItem): string {
  // The canonical `ss_styles` id when this line came off the live catalog —
  // the one thing every colourway of one garment shares, since each colour
  // is its own `ss_products` row and so its own `productId`. Falls back to
  // whatever identifies the line at all for a custom-quote or roster add
  // that never touched the catalog and so carries no `styleId`.
  return item.styleId ?? item.productId ?? item.id;
}

function decorationKeyFor(item: CartItem): string {
  return withoutSizeSegment(item.meta) ?? item.meta;
}

/**
 * Groups cart lines into the tree Pavin asked for: **Product → Decoration →
 * Colour → Sizes**. One card per garment regardless of how many colours it
 * was ordered in, one decoration heading under that (almost always exactly
 * one — every colour of one design shares the same method and location),
 * and the colour blocks from `groupCartItems` nested inside that, each still
 * carrying its own thumbnail so the photo stays right per colour (the
 * fix for "cart still showing wrong colors of garment" does not regress by
 * folding three colours' worth of garment into one picture at the top).
 *
 * Built directly on `groupCartItems` — the colour-and-size fold it already
 * does is exactly the innermost two levels of this tree, so nothing about
 * that folding, its roster handling, or its tests changes; this only adds
 * the two wrapping levels above it.
 */
export function groupCartItemsByProduct(
  items: readonly CartItem[],
): CartProductGroup[] {
  const colourGroups = groupCartItems(items);

  const products = new Map<
    string,
    { representative: CartItem; decorations: Map<string, CartLineGroup[]> }
  >();

  for (const colourGroup of colourGroups) {
    const rep = colourGroup.representative;
    const pKey = productKeyFor(rep);
    const dKey = decorationKeyFor(rep);

    let product = products.get(pKey);
    if (!product) {
      product = { representative: rep, decorations: new Map() };
      products.set(pKey, product);
    }

    const bucket = product.decorations.get(dKey);
    if (bucket) bucket.push(colourGroup);
    else product.decorations.set(dKey, [colourGroup]);
  }

  const result: CartProductGroup[] = [];
  for (const [pKey, product] of products) {
    const decorations: CartDecorationGroup[] = [];
    for (const [dKey, colours] of product.decorations) {
      const quantity = colours.reduce((sum, c) => sum + c.quantity, 0);
      const totalMinor = colours.reduce((sum, c) => sum + c.totalMinor, 0);
      const hasUnpriced = colours.some((c) => c.hasUnpriced);
      decorations.push({
        key: `${pKey}||${dKey}`,
        label: dKey,
        representative: colours[0]!.representative,
        colours,
        quantity,
        totalMinor,
        hasUnpriced,
      });
    }

    const quantity = decorations.reduce((sum, d) => sum + d.quantity, 0);
    const totalMinor = decorations.reduce((sum, d) => sum + d.totalMinor, 0);
    const hasUnpriced = decorations.some((d) => d.hasUnpriced);

    result.push({
      key: pKey,
      name: product.representative.name,
      representative: product.representative,
      decorations,
      quantity,
      totalMinor,
      hasUnpriced,
    });
  }

  return result;
}
