/**
 * Collapse a job's line items into one row per product.
 *
 * An order is stored with one line per size, because that is how it is
 * priced and picked. Rendered straight out, a 100-piece order across five
 * sizes becomes five near-identical blocks and staff have to read all of them
 * to work out what the order actually is (client feedback, 10 Sep: "should be
 * basic order overview of products, colors, and sizes qty in 1 clean line -
 * don't have multiple lines by size").
 *
 * Only lines that differ *solely* by size are merged. A different colour,
 * placement or product stays its own row, because those are real differences
 * a picker needs to see.
 */

export type AdminLineInput = {
  id: string;
  description: string;
  quantity: number;
  color?: string | null;
  size?: string | null;
  /** Stable product id when the snapshot carried one. */
  productKey?: string | null;
  /** Print placement — a different placement is a different job. */
  placement?: string | null;
  unitPriceEstimateMinor?: number | null;
  totalMinor?: number | null;
};

export type AdminLineGroup = {
  key: string;
  /** Every original line folded into this row, first one first. */
  ids: string[];
  description: string;
  color: string | null;
  placement: string | null;
  sizes: { size: string; quantity: number }[];
  quantity: number;
  /** Null only when no line in the group carried a total. */
  totalMinor: number | null;
  unitPriceEstimateMinor: number | null;
};

/**
 * Garment sizes in the order a person expects them, not alphabetically —
 * "L, M, S, XL" is the sort a picker has to mentally undo every time.
 * Anything unrecognised sorts after the known run, alphabetically.
 */
const SIZE_ORDER = [
  "xxs", "2xs",
  "xs",
  "s", "sm", "small",
  "m", "md", "medium",
  "l", "lg", "large",
  "xl", "1xl", "xlarge",
  "xxl", "2xl",
  "xxxl", "3xl",
  "xxxxl", "4xl",
  "5xl", "6xl",
  "osfa", "os", "one size",
];

export function sizeSortKey(size: string): number {
  const index = SIZE_ORDER.indexOf(size.trim().toLowerCase());
  return index === -1 ? SIZE_ORDER.length : index;
}

function trimmed(value: unknown): string | null {
  const text = typeof value === "string" ? value.trim() : "";
  return text === "" ? null : text;
}

export function groupAdminJobLines(
  lines: readonly AdminLineInput[],
): AdminLineGroup[] {
  const groups = new Map<string, AdminLineGroup>();

  for (const line of lines) {
    const color = trimmed(line.color);
    const placement = trimmed(line.placement);
    const size = trimmed(line.size);
    // Product key first when present; description alone would merge two
    // different products that happen to share a name.
    const key = [
      trimmed(line.productKey) ?? line.description,
      color ?? "",
      placement ?? "",
    ].join("||");

    const existing = groups.get(key);
    if (!existing) {
      groups.set(key, {
        key,
        ids: [line.id],
        description: line.description,
        color,
        placement,
        sizes: size ? [{ size, quantity: line.quantity }] : [],
        quantity: line.quantity,
        totalMinor: line.totalMinor ?? null,
        unitPriceEstimateMinor: line.unitPriceEstimateMinor ?? null,
      });
      continue;
    }

    existing.ids.push(line.id);
    existing.quantity += line.quantity;
    if (line.totalMinor != null) {
      existing.totalMinor = (existing.totalMinor ?? 0) + line.totalMinor;
    }
    if (existing.unitPriceEstimateMinor == null) {
      existing.unitPriceEstimateMinor = line.unitPriceEstimateMinor ?? null;
    }
    if (size) {
      // The same size twice in one order is a real possibility (a re-add, or
      // a named roster beside spares) — sum rather than listing it twice.
      const seen = existing.sizes.find((entry) => entry.size === size);
      if (seen) seen.quantity += line.quantity;
      else existing.sizes.push({ size, quantity: line.quantity });
    }
  }

  for (const group of groups.values()) {
    group.sizes.sort(
      (a, b) => sizeSortKey(a.size) - sizeSortKey(b.size) || a.size.localeCompare(b.size),
    );
  }
  return [...groups.values()];
}

/**
 * The product half of a cart line's id. The storefront files a line as
 * `<productId>:<variantId>`, and a variant is a size - so used raw as the
 * product key it kept every size apart, which is precisely the split the
 * grouping exists to undo (three "Adidas ... Hoodie" blocks for S, M and L,
 * 15 Sep).
 */
export function productKeyFromStorefrontId(id: unknown): string | null {
  const text = trimmed(id);
  if (!text) return null;
  const colon = text.indexOf(":");
  return colon === -1 ? text : text.slice(0, colon) || null;
}

/**
 * The cart's own "meta" line carries the size ("Custom design · Size M ·
 * Screen print"), so it too split a size run into separate blocks. The
 * size segment is dropped for keying and for display; the sizes are on the
 * breakdown line.
 */
export function withoutSizeSegment(meta: unknown): string | null {
  const text = trimmed(meta);
  if (!text) return null;
  const parts = text
    .split(/\s*[·|]\s*/)
    .map((part) => part.trim())
    .filter((part) => part && !/^size\b/i.test(part));
  return parts.length ? parts.join(" · ") : null;
}

/**
 * What makes two lines of the same garment and colour a different job: a
 * different design, or different decoration. Read from the order's pricing
 * snapshot when it has one (location, method, colour count per line) so
 * two lines that print the same way group even if their free-text meta
 * differs; the meta minus its size segment is the fallback for older
 * orders that carried no snapshot.
 */
export function placementKey(configuration: {
  designProjectId?: unknown;
  artworkProofUrl?: unknown;
  productMetadata?: unknown;
  pricing?: unknown;
}): string | null {
  const design =
    trimmed(configuration.designProjectId) ?? trimmed(configuration.artworkProofUrl);
  const input = (configuration.pricing as { input?: { decorations?: unknown } } | null)
    ?.input;
  const decorations = Array.isArray(input?.decorations)
    ? input.decorations
        .map((entry) => {
          const line = (entry ?? {}) as {
            location?: unknown;
            methodKey?: unknown;
            colours?: unknown;
            stitchCount?: unknown;
            optionKey?: unknown;
          };
          return [line.location, line.methodKey, line.colours, line.stitchCount, line.optionKey]
            .map((value) => (value == null ? "" : String(value)))
            .join(":");
        })
        .sort()
        .join(",")
    : null;
  const parts = [design, decorations ?? withoutSizeSegment(configuration.productMetadata)]
    .filter((part): part is string => Boolean(part));
  return parts.length ? parts.join("||") : null;
}

/** "S 10 · M 25 · L 35" — the one-line breakdown staff actually read. */
export function formatSizeBreakdown(
  sizes: readonly { size: string; quantity: number }[],
): string {
  return sizes.map((entry) => `${entry.size} ${entry.quantity}`).join(" · ");
}
